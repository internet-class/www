'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    async = require('async'),
    child_process = require('child_process'),
    path = require('path'),
    fs = require('fs-extra'),
    temp = require('temp'),
    metalsmith = require('metalsmith'),
    lessons = require('./lessons.js'),
    flush = require('./flush.js'),
    yamljs = require('yamljs'),
    handlebars = require('handlebars'),
    common = require('./common.js');

temp.track();

handlebars.registerHelper('pluralize', function(number, singular, plural) {
  if (number === 1) {
    return singular;
  } else {
    return plural;
  }
});

var titleTemplate = handlebars.compile(`
<span size='larger'><b>{{ title }}</b></span>
{{ authors }}`);

var creditsTemplate = handlebars.compile(`
<span size='larger'><b>Talking</b></span>
{{#each authorInfo}}{{ name }} ({{ credits }}){{/each}}

<span size='larger'><b>Producing</b></span>
{{#each producers}}{{ name }} ({{ credits }}){{/each}}`);

var getTranscodeInfo = function(videoData, config) {
  var transcode = {};
  var transcodeConfig = config.transcode;
  
  try { 
    transcode.title = videoData.title || videoData.lesson.title;
    assert(transcode.title);
    transcode.authorInfo = videoData.authors || transcodeConfig.defaultAuthors;
    assert(transcode.authorInfo);
    transcode.authors = common.andList(_.pluck(transcode.authorInfo, 'name'));
    assert(transcode.authors);
    transcode.titleLength = videoData.titleLength || transcodeConfig.titleLength;
    assert(transcode.titleLength);
    transcode.creditsFile = videoData.creditsFile || transcodeConfig.creditsFile;
    if (transcode.creditsFile) {
      transcode.creditsFile = path.join(config.credits, transcode.creditsFile);
      assert(fs.existsSync(transcode.creditsFile));
      transcode.producers = videoData.producers || transcodeConfig.defaultProducers;
      assert(transcode.producers);
      transcode.creditsLength = videoData.creditsLength || transcodeConfig.creditsLength;
      assert(transcode.creditsLength);
    }
  } catch (err) {
    console.log(videoData);
    throw new Error("video missing transcode metadata: " + err);
  }

  return transcode;
}

var transcode = function(videoData, config, finished) {
  var workingDir = temp.mkdirSync();
  var transcodeInfo = getTranscodeInfo(videoData, config);
  
  var fonts = config.fonts;
  var georgia = path.join(fonts, 'Georgia.ttf');
  var georgiaBold = path.join(fonts, 'Georgia_Bold.ttf');
  var consolas = path.join(fonts, 'Consolas.ttf');
  assert(fs.existsSync(georgia));
  assert(fs.existsSync(georgiaBold));
  assert(fs.existsSync(consolas));
  _.each(videoData.tmp.fullFiles, function (filename) {
    try {
      child_process.execSync('ffprobe ' + filename + ' > /dev/null 2>&1');
    } catch (err) {
      throw new Error("bogus input file: " + err);
      finished();
      return;
    }
  });
 
  var titleContent = titleTemplate(transcodeInfo); 
  var titleImageCommandLine = 'convert -matte -background "rgba(256,256,256,0.0)" -font ' +
    georgia + ' -pointsize 48 -size 1600x -fill black pango:"' + titleContent + '" title_large.png';
  try {
    if (config.veryVerbose) {
      console.log(titleImageCommandLine);
    } 
    child_process.execSync(titleImageCommandLine + '> output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'title_large.png')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("title image creation failed");
    finished();
    return;
  }
  var titleImageCommandLine = 'convert title_large.png -matte -trim ' + 
    '-background "rgba(256,256,256,0.5)" -bordercolor "rgba(256,256,256,0.5)" ' + 
    '-layers merge -compose Copy -border 20x20 title.png'
  try {
    if (config.veryVerbose) {
      console.log(titleImageCommandLine);
    } 
    child_process.execSync(titleImageCommandLine + '> output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'title.png')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("title image creation failed");
    finished();
    return;
  }
  
  var titleMovieCommandLine = 'ffmpeg -loop 1 -i title.png -t ' + (transcodeInfo.titleLength + 1) +
    ' -vcodec png -vf "fade=out:st=' + transcodeInfo.titleLength + ':d=0.5:alpha=1" title.mov'
  try {
    if (config.veryVerbose) {
      console.log(titleMovieCommandLine);
    } 
    child_process.execSync(titleMovieCommandLine + '> output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'title.mov')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("title movie creation failed");
    finished();
    return;
  }

  var concatFile = path.join(workingDir, 'concat');
  fs.writeFileSync(concatFile,
    _.map(videoData.tmp.fullFiles, function (filename) {
      return "file '" + filename + "'";
    }).join('\n') + '\n');
  var encodeCommandLine = 'ffmpeg -f concat -safe 0 -i concat -i title.mov -filter_complex ' +
    '"overlay=x=20 : y=main_h-overlay_h-20, ' +
    'drawtext=fontfile=' + consolas + ' : text=\'internet-class.org\' : fontcolor=white : ' +
    'fontsize=40 : x=w-tw-20 : y=20" -c:a libmp3lame -ac 1 -ab 128k content.mp4';
  try {
    child_process.execSync(encodeCommandLine + '> output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'content.mp4')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("ffmpeg transcode failed");
    finished();
    return;
  }

  if (transcodeInfo.creditsFile) {
    var creditsContent = creditsTemplate(transcodeInfo); 
    var creditsImageCommandLine = 'convert -matte -background "rgba(256,256,256,0.0)" -font ' +
      georgia + ' -pointsize 24 -size 1600x -gravity center -fill black pango:"' +
      creditsContent + '" credits_large.png';
    try {
      if (config.veryVerbose) {
        console.log(creditsImageCommandLine);
      } 
      child_process.execSync(creditsImageCommandLine + '> output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'credits_large.png')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("credit image creation failed");
      finished();
      return;
    }
    var creditsImageCommandLine = 'convert credits_large.png -matte -trim ' + 
      '-background "rgba(256,256,256,0.5)" -bordercolor "rgba(256,256,256,0.5)" ' + 
      '-layers merge -compose Copy -border 20x20 credits.png'
    try {
      if (config.veryVerbose) {
        console.log(creditsImageCommandLine);
      } 
      child_process.execSync(creditsImageCommandLine + '> output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'credits.png')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("credit image creation failed");
      finished();
      return;
    }

    var encodeCreditsCommandLine = 'ffmpeg -i ' + transcodeInfo.creditsFile + ' -i credits.png ' +
      '-filter_complex "overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2" ' +
      '-t ' + transcodeInfo.creditsLength + ' -c:a libmp3lame -ac 1 -ab 128k credits.mp4';
    try {
      child_process.execSync(encodeCreditsCommandLine + '> output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'credits.mp4')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("ffmpeg credits transcode failed");
      finished();
      return;
    }

    var concatFile = path.join(workingDir, 'concat');
    fs.writeFileSync(concatFile, "file 'content.mp4'\nfile 'credits.mp4'");
    var combineCreditsCommandLine = 'ffmpeg -f concat -i concat -c copy out.mp4';
    try {
      child_process.execSync(combineCreditsCommandLine + '> output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'out.mp4')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("ffmpeg combining credits transcode failed");
      finished();
      return;
    }
  } else {
    fs.renameSync(path.join(workingDir, 'content.mp4'), path.join(workingDir, 'out.mp4'));
  }

  var probeCommandLine = 'ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 out.mp4';
  var durationSec = child_process.execSync(probeCommandLine, { cwd: workingDir }).toString();
  videoData.durationSec = parseFloat(durationSec);

  var name = common.md5sum(path.join(workingDir, 'out.mp4')) + '.mp4';
  var renamePath = path.join(path.dirname(videoData.tmp.videosData), name);
  if (fs.existsSync(renamePath)) {
    console.log("not replacing output with the correct hash");
  } else {
    videoData.inputHash = common.md5sum(videoData.tmp.fullFiles);
    videoData.output = path.basename(renamePath);
    fs.copySync(path.join(workingDir, 'out.mp4'), '/tmp/out.mp4');
    fs.renameSync(path.join(workingDir, 'out.mp4'), renamePath);
  }

  finished();
  return;
}

var upload = function(videoData, youtubeClient) {

  var uploadRequest = youtubeClient.videos.insert({
    resource: {
      snippet: {
        title: videoData.title || videoData.lesson.title,
        description: videoData.description || videoData.lesson.description,
        defaultLanguage: videoData.defaultLanguage,
        categoryId: videoData.categoryId
      },
      status: {
        privacyStatus: videoData.privacyStatus,
        embeddable: videoData.embeddable,
        license: videoData.license,
        notifySubscribers: videoData.notifySubscribers
      }
    },
    part: "contentDetails, snippet, status",
    autoLevels: videoData.autoLevels,
    stabilize: videoData.stabilize,
    media: {
      body: fs.createReadStream(videoData.output)
    }
  }, topCallback);
}

var defaults = {
  failAny: true,
  verbose: false,
  veryVerbose: false,
  videos: '**/videos.yaml',
  transcode: true,
  upload: true,
  fonts: path.join(__dirname, 'fonts'),
  credits: path.join(__dirname, 'credits'),
  transcode: {
    titleLength: 10,
    creditsLength: 5
  }
}

function processConfig(config, src) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

function videos(config) {
  return function (files, metalsmith, done) {

    var videoExtensions = ['.MTS']
    var videoDataByDirectory = {};
    var videoDataList = [];
    var videoFiles = [];

    config = processConfig(config);

    async.series([
        function (callback) {
          _.chain(files)
            .pick(function(file, filename) {
              return (multimatch(filename, config.videos).length > 0);
            })
            .each(function(file, filename) {
              var videosData = yamljs.parse(file.contents.toString());
              videoDataByDirectory[path.dirname(filename)] = videosData;

              _.each(videosData, function (videoData, index) {
                videoData.tmp = {};
                videoData.tmp.index = index;
                videoData.tmp.videosData = path.join(metalsmith.source(), filename);
                videoData.tmp.fullFiles = _.map(videoData.files, function (videoFile) {
                  return path.join(metalsmith.source(), path.dirname(filename), videoFile);
                });
                videoData.present = _.every(videoData.tmp.fullFiles, function (videoFile) {
                  if (fs.existsSync(videoFile)) {
                    videoFiles.push(videoFile);
                    return true;
                  } else {
                    return false;
                  }
                });
                videoDataList.push(videoData);
              });
            })
          callback();
        },
        function (callback) {
          var errors = [];
          var q = async.queue(function(task, finished) {
            if (task.operation == 'transcode') {
              try {
                transcode(task.videoData, config, finished);
              } catch (err) {
                errors.push(err);
                if (config.verbose) {
                  console.log('Transcoding ' + task.videoData.tmp.fullFiles.join(',') + ' from ' + task.videoData.tmp.videosData + ' failed.');
                }
                finished();
              }
            }
          }, 8);
          q.push(_.map(videoDataList, function (videoData) {
            return { operation: 'transcode', videoData: videoData };
          }));
          q.drain = function() {
            if (errors.length == 0) {
              callback();
            } else if (config.failAny) {
              done(errors[0]);
            }
          };
        },
        function (callback) {
          _.chain(files)
            .pick(function(file, filename) {
              return videoFiles.indexOf(path.join(metalsmith.source(), filename)) == -1 &&
                videoExtensions.indexOf(path.extname(filename)) !== -1 && file.lesson !== undefined;
            })
            .each(function(file, filename) {
              delete(files[filename]);
              var dirname = path.dirname(filename);
              (videoDataByDirectory[dirname] = videoDataByDirectory[dirname] || []).push({
                'files': [ path.basename(filename) ],
                'ready': false
              });
            })

          _.each(videoDataByDirectory, function(videosData, directory) {
            _.each(videosData, function (videoData) {
              delete(videoData['tmp']);
            });
            fs.writeFileSync(path.join(metalsmith.source(), directory, 'videos.yaml'), yamljs.stringify(videosData, 2, 2));
          });
          callback();
        }],
        function () {
          done();
        })
  }
}

exports = module.exports = videos

// vim: ts=2:sw=2:et
