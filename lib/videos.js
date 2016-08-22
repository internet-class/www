'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    async = require('async'),
    child_process = require('child_process'),
    path = require('path'),
    fs = require('fs-extra'),
    temp = require('temp'),
    yamljs = require('yamljs'),
    handlebars = require('handlebars'),
    moment_timezone = require('moment-timezone'),
    googleapis = require('googleapis'),
    common = require('./common.js');

temp.track();

var titleTemplate = handlebars.compile(`
<span size='larger'><b>{{ title }}</b></span>
{{ authors }}`);

var creditsTemplate = handlebars.compile(`
<span size='larger'><b>{{ title }}</b></span>

<span size='larger'><b>Talking</b></span>
{{#each authorInfo}}{{ name }} ({{ credits }})
{{/each}}

<span size='larger'><b>Producing</b></span>
{{#each producers}}{{ name }} ({{ credits }})
{{/each}}

internet-class.org is a blue Systems Research Group (blue.cse.buffalo.edu) production.`);

var getTranscodeInfo = function(videoData, config) {
  var transcode = {};

  try {
    transcode.title = videoData.title;
    assert(transcode.title);
    transcode.authorInfo = videoData.authors;
    assert(transcode.authorInfo);
    transcode.authors = common.andList(_.pluck(transcode.authorInfo, 'name'));
    assert(transcode.authors);
    transcode.titleLength = videoData.titleLength || config.titleLength;
    assert(transcode.titleLength);
    transcode.creditsFile = videoData.creditsFile || config.creditsFile;
    if (transcode.creditsFile) {
      transcode.creditsFile = path.join(config.credits, transcode.creditsFile);
      assert(fs.existsSync(transcode.creditsFile));
      transcode.producers = videoData.producers;
      assert(transcode.producers);
      transcode.creditsLength = videoData.creditsLength || config.creditsLength;
      assert(transcode.creditsLength);
    }
    transcode.prerollFile = videoData.prerollFile || config.prerollFile;
    if (transcode.prerollFile) {
      transcode.prerollFile = path.join(config.preroll, transcode.prerollFile);
      assert(fs.existsSync(transcode.prerollFile));
    }
  } catch (err) {
    throw new Error("video missing transcode metadata: " + err);
  }

  return transcode;
}

var doTranscode = function(videoData, config) {
  var workingDir = temp.mkdirSync();
  var transcodeInfo = getTranscodeInfo(videoData, config);

  var fonts = config.fonts;
  var georgia = path.join(fonts, 'Georgia.ttf');
  var georgiaBold = path.join(fonts, 'Georgia_Bold.ttf');
  var consolas = path.join(fonts, 'Consolas.ttf');
  try {
    assert(fs.existsSync(georgia));
    assert(fs.existsSync(georgiaBold));
    assert(fs.existsSync(consolas));
  } catch (err) {
    throw new Error("missing fonts: " + err);
  }

  _.each(videoData.find.fullFiles, function (filename) {
    try {
      child_process.execSync('ffprobe ' + filename + ' > /dev/null 2>&1');
    } catch (err) {
      throw new Error("bogus input file: " + err);
    }
  });

  var titleContent = titleTemplate(transcodeInfo);
  var titleImageCommandLine = 'convert -matte -background "rgba(256,256,256,0.0)" -font ' +
    georgia + ' -pointsize 48 -size 1600x -fill black pango:"' + titleContent + '" title_large.png';
  try {
    if (config.veryVerbose) {
      console.log(titleImageCommandLine);
    }
    child_process.execSync(titleImageCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'title_large.png')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("title image creation failed");
  }
  var titleImageCommandLine = 'convert title_large.png -matte -trim ' +
    '-background "rgba(256,256,256,0.5)" -bordercolor "rgba(256,256,256,0.5)" ' +
    '-layers merge -compose Copy -border 20x20 title.png'
  try {
    if (config.veryVerbose) {
      console.log(titleImageCommandLine);
    }
    child_process.execSync(titleImageCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'title.png')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("title image creation failed");
  }

  var titleMovieCommandLine = 'ffmpeg -loop 1 -i title.png -t ' + (transcodeInfo.titleLength + 1) +
    ' -vcodec png -vf "fade=out:st=' + transcodeInfo.titleLength + ':d=0.5:alpha=1" title.mov'
  try {
    if (config.veryVerbose) {
      console.log(titleMovieCommandLine);
    }
    child_process.execSync(titleMovieCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'title.mov')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("title movie creation failed");
  }

  var concatFile = path.join(workingDir, 'concat');
  fs.writeFileSync(concatFile,
    _.map(videoData.find.fullFiles, function (filename) {
      return "file '" + filename + "'";
    }).join('\n') + '\n');
  var encodeCommandLine = 'ffmpeg -f concat -safe 0 -i concat -i title.mov -filter_complex ' +
    '"overlay=x=20 : y=main_h-overlay_h-20, ' +
    'drawtext=fontfile=' + consolas + ' : text=\'internet-class.org\' : fontcolor=white : ' +
    'fontsize=40 : x=w-tw-20 : y=20" -vcodec libx264 -vbr 8000k -s hd1080 -qscale 0 -movflags +faststart -deinterlace -c:a aac -ac 1 -ab 128k content.mp4';
  try {
    child_process.execSync(encodeCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
    assert(fs.existsSync(path.join(workingDir, 'content.mp4')));
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("ffmpeg transcode failed");
  }

  if (transcodeInfo.creditsFile) {
    var creditsContent = creditsTemplate(transcodeInfo);
    var creditsImageCommandLine = 'convert -matte -background "rgba(256,256,256,0.0)" -font ' +
      georgia + ' -pointsize 30 -size 1600x -gravity center -fill black pango:"' +
      creditsContent + '" credits_large.png';
    try {
      if (config.veryVerbose) {
        console.log(creditsImageCommandLine);
      }
      child_process.execSync(creditsImageCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'credits_large.png')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("credit image creation failed");
    }
    var creditsImageCommandLine = 'convert credits_large.png -matte -trim ' +
      '-background "rgba(256,256,256,0.5)" -bordercolor "rgba(256,256,256,0.5)" ' +
      '-layers merge -compose Copy -border 20x20 credits.png'
    try {
      if (config.veryVerbose) {
        console.log(creditsImageCommandLine);
      }
      child_process.execSync(creditsImageCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'credits.png')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("credit image creation failed");
    }

    var encodeCreditsCommandLine = 'ffmpeg -i ' + transcodeInfo.creditsFile + ' -i credits.png ' +
      '-filter_complex "overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2" ' +
      '-t ' + transcodeInfo.creditsLength + ' -vcodec libx264 -vbr 8000k -s hd1080 -deinterlace -c:a aac -ac 1 -ab 128k credits.mp4';
    try {
      child_process.execSync(encodeCreditsCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'credits.mp4')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("ffmpeg credits transcode failed");
    }

    var concatFile = path.join(workingDir, 'concat');
    fs.writeFileSync(concatFile, "file 'content.mp4'\nfile 'credits.mp4'");
    var combineCreditsCommandLine = 'ffmpeg -f concat -i concat -c copy main.mp4';
    try {
      child_process.execSync(combineCreditsCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'main.mp4')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("ffmpeg combining credits transcode failed");
    }
  } else {
    fs.renameSync(path.join(workingDir, 'content.mp4'), path.join(workingDir, 'main.mp4'));
  }
  
  if (transcodeInfo.prerollFile) {
    var addPrerollCommandLine = 'ffmpeg -i ' + transcodeInfo.prerollFile + ' -i main.mp4 ' + 
      '-filter_complex "[0:v:0] [0:a:0] [1:v:0] [1:a:0] concat=n=2:v=1:a=1 [v] [a]" ' +
      '-map "[v]" -map "[a]" -vcodec libx264 -vbr 8000k -qscale 0 -movflags +faststart -s hd1080 ' +
      '-deinterlace out.mp4';
    try {
      child_process.execSync(addPrerollCommandLine + ' > output.txt 2>&1', { cwd: workingDir });
      assert(fs.existsSync(path.join(workingDir, 'out.mp4')));
    } catch (err) {
      if (config.veryVerbose) {
        console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
      }
      throw new Error("ffmpeg adding preroll failed");
    }
  } else {
    fs.renameSync(path.join(workingDir, 'main.mp4'), path.join(workingDir, 'out.mp4'));
  }

  var probeCommandLine = 'ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 out.mp4';
  var durationSec = child_process.execSync(probeCommandLine, { cwd: workingDir }).toString();
  videoData.durationSec = parseFloat(durationSec);

  var name = common.md5sum(path.join(workingDir, 'out.mp4')) + '.mp4';
  var renamePath = path.join(videoData.find.directory, name);
  if (fs.existsSync(renamePath)) {
    if (config.veryVerbose) {
      console.log("not replacing output with the correct hash");
    }
  } else {
    videoData.inputHash = common.md5sum(videoData.find.fullFiles);
    videoData.output = path.basename(renamePath);
    fs.renameSync(path.join(workingDir, 'out.mp4'), renamePath);
  }

  return;
}

var getUploadInfo = function(videoData, config) {
  var upload = {};

  try {
    upload.output = path.join(videoData.find.directory, videoData.output);
    assert(fs.existsSync(upload.output));
    upload.title = videoData.title;
    assert(upload.title);
    upload.authorInfo = videoData.authors;
    assert(upload.authorInfo);
    upload.authors = common.andList(_.map(upload.authorInfo, function (author) {
      return author.name + " (" + author.credits + ")";
    }));
    assert(upload.authors);
    upload.description = videoData.description;
    assert(upload.description);
    upload.addCredits = videoData.addCredits;
    if (upload.addCredits === undefined) {
      upload.addCredits = config.addCredits;
    }
    assert(upload.addCredits !== undefined);
    if (upload.addCredits) {
      assert(videoData.producers);
      upload.producerList = common.andList(_.map(videoData.producers, function (author) {
        return author.name + " (" + author.credits + ")";
      }));
      assert(upload.producerList);
    }
    if (videoData.created) {
      upload.recordingDate = moment_timezone(new Date(videoData.created));
      assert(upload.recordingDate.tz('utc').toISOString() != 'Invalid date');
    } else {
      upload.recordingDate = moment_timezone();
    }
    assert(upload.recordingDate);

    upload.locationDescription = videoData.locationDescription || config.locationDescription;
    upload.locationLatitude = videoData.locationLatitude || config.locationLatitude;
    upload.locationLongitude = videoData.locationLongitude || config.locationLongitude;
    if (upload.locationDescription) {
      assert(upload.locationLatitude);
      assert(upload.locationLongitude);
    }
    if (upload.locationLatitude) {
      assert(upload.locationLongitude);
    }

    upload.tags = videoData.tags || [];
    if (config.extraTags) {
      upload.tags = Array.from(new Set(upload.tags.concat(config.extraTags)));
    }

    upload.defaultLanguage = videoData.defaultLanguage || config.defaultLanguage;
    assert(upload.defaultLanguage);
    upload.categoryId = videoData.categoryId || config.categoryId;
    assert(upload.categoryId);
    upload.privacyStatus = videoData.privacyStatus || config.privacyStatus;
    assert(upload.privacyStatus);


    upload.embeddable = videoData.embeddable;
    if (upload.embeddable === undefined) {
      upload.embeddable = config.embeddable;
    }
    assert(upload.embeddable !== undefined);
    upload.license = videoData.license || config.license;
    assert(upload.license);
    if (upload.notifySubscribers === undefined) {
      upload.notifySubscribers = config.notifySubscribers;
    }
    assert(upload.notifySubscribers !== undefined);
    if (upload.autoLevels === undefined) {
      upload.autoLevels = config.autoLevels;
    }
    assert(upload.autoLevels !== undefined);
    if (upload.stabilize === undefined) {
      upload.stabilize = config.stabilize;
    }
    assert(upload.stabilize !== undefined);

  } catch (err) {
    throw new Error("video missing upload metadata: " + err);
  }

  return upload;
}

var uploadCreditsTemplate = handlebars.compile(`
{{ description }}

Credits: Talking: {{ authors }}. Producing: {{ producerList }}.

Part of the https:\/\/www.internet-class.org online internet course. A blue Systems Research Group (https:\/\/blue.cse.buffalo.edu) production.`);

var doUpload = function(videoData, youtubeClient, config, callback) {
  var uploadInfo = getUploadInfo(videoData, config);

  var description = uploadInfo.description;
  if (uploadInfo.addCredits) {
    description = uploadCreditsTemplate(uploadInfo);
  }
  var resource = {
    snippet: {
      title: uploadInfo.title,
      description: description,
      defaultLanguage: uploadInfo.defaultLanguage,
      categoryId: uploadInfo.categoryId,
      tags: uploadInfo.tags
    },
    status: {
      privacyStatus: uploadInfo.privacyStatus,
      embeddable: uploadInfo.embeddable,
      license: uploadInfo.license,
    },
    recordingDetails: {
      recordingDate: uploadInfo.recordingDate.tz('utc').toISOString()
    }
  }
  if (uploadInfo.locationLatitude) {
    resource.recordingDetails.location = {
      latitude: uploadInfo.locationLatitude,
      longitude: uploadInfo.locationLongitude
    }
  }
  if (uploadInfo.locationDescription) {
    resource.recordingDetails.locationDescription = uploadInfo.locationDescription;
  }
  var request = {
    resource: resource,
    part: "contentDetails, snippet, status, recordingDetails",
    notifySubscribers: uploadInfo.notifySubscribers,
    media: {
      body: fs.createReadStream(uploadInfo.output)
    }
  };
  if (uploadInfo.autoLevels === true) {
    request.autoLevels = true;
  }
  if (uploadInfo.stabilize === true) {
    request.stabilize = true;
  }
  var uploadRequest = youtubeClient.videos.insert(request, callback);
}

function processConfig(config, defaults, src) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

var findDefaults = {
  videoMetadata: '**/videos.yaml',
  videoExtensions: ['**/*.MTS'],
  timezone: 'America/New_York'
}

var find = function(config) {
  return function (files, metalsmith, done) {

    var videoDataByDirectory = {};
    var videoDataList = [];
    var videoFiles = [];

    config = processConfig(config, findDefaults);

    async.series([
      function (callback) {
        _.chain(files)
          .pick(function(file, filename) {
            return (multimatch(filename, config.videoMetadata).length > 0);
          })
          .each(function(file, filename) {
            var videosData = yamljs.parse(file.contents.toString());
            var fullDirectory = path.dirname(path.join(metalsmith.source(), filename));
            videoDataByDirectory[fullDirectory] = videosData;

            _.each(videosData, function (videoData) {
              videoData.remove = [];
              videoData.find = {
                directory: fullDirectory,
                metadata: path.join(metalsmith.source(), filename),
                fullFiles: _.map(videoData.files, function (videoFile) {
                  return path.join(metalsmith.source(), path.dirname(filename), videoFile);
                }),
                metalsmith: file
              };
              videoData.find.inputsPresent = _.every(videoData.find.fullFiles,
                  function (videoFile) {
                    if (fs.existsSync(videoFile)) {
                      videoFiles.push(videoFile);
                      return true;
                    } else {
                      return false;
                    }
                  });
              if (videoData.output) {
                videoData.find.outputPresent =
                  fs.existsSync(path.join(videoData.find.directory), videoData.output);
              } else {
                videoData.find.outputPresent = false;
              }
              videoDataList.push(videoData);
            });
          })
        callback();
      },
      function (callback) {
        var videoFilename = path.basename(config.videoMetadata);
        var updateContents = {};
        _.chain(common.walkSync(metalsmith.source()))
          .filter(function(filename) {
            return videoFiles.indexOf(filename) == -1 &&
              multimatch(path.relative(metalsmith.source(), filename),
                config.videoExtensions).length > 0;
          })
          .each(function(filename) {
            try {
              delete(files[path.relative(metalsmith.source(), filename)].contents);
            } catch (err) { };
            var dirname = path.dirname(filename);
            if (fs.existsSync(path.join(dirname, videoFilename)) &&
                (!(videoDataByDirectory[dirname]))) {
              return;
            }
            var newVideoData = {
              files: [ path.basename(filename) ],
              created: moment_timezone.tz(fs.statSync(filename).birthtime, config.timezone).toString(),
              transcode: false,
              remove: [],
              find: {
                directory: path.join(metalsmith.source(), dirname),
                metadata: path.join(metalsmith.source(), dirname, path.basename(config.videoMetadata)),
                fullFiles: [ path.join(metalsmith.source(), filename) ],
                inputsPresent: true,
                outputPresent: false
              }
            };
            (videoDataByDirectory[dirname] = videoDataByDirectory[dirname] || []).push(newVideoData);
            updateContents[dirname] = true;
          })
        _.each(updateContents, function (unused, dirname) {
          var newFilename = path.join(path.relative(metalsmith.source(), dirname),
              path.basename(config.videoMetadata));
          if (newFilename in files) {
            assert(!(content in files[newFilename]));
          }
          files[newFilename] = {
            contents: yamljs.stringify(videoDataByDirectory[dirname])
          };
          _.each(videoDataByDirectory[dirname], function (videoData) {
            videoData.find.metalsmith = files[newFilename];
          });
        });
        var metadata = metalsmith.metadata();
        var allVideos = [];
        _.each(videoDataByDirectory, function (videosData) {
          allVideos = allVideos.concat(videosData);
        });
        metadata.videos = {
          filename: videoFilename,
          byDirectory: videoDataByDirectory,
          allVideos: allVideos
        };
        done();
      }]
    );
  }
}

var transcodeDefaults = {
  progress: true,
  verbose: false,
  veryVerbose: false,
  fonts: path.join(__dirname, 'fonts'),
  credits: path.join(__dirname, 'credits'),
  preroll: path.join(__dirname, 'preroll'),
  titleLength: 10,
  creditsLength: 5
}

var transcode = function(config) {
  config = processConfig(config, transcodeDefaults);

  return function(files, metalsmith, done) {
    config.credits = path.join(metalsmith.source(), config.credits);
    config.preroll = path.join(metalsmith.source(), config.preroll);

    var metadata = metalsmith.metadata();
    var tasks = [];
    _.each(metalsmith.metadata().videos.byDirectory, function (videosData) {
      _.chain(videosData)
        .filter(function (videoData) {
          return videoData.transcode !== false && videoData.output === undefined;
        })
        .each(function (videoData, index) {
          videoData.transcodeTmp = {
            index: index
          }
          tasks.push(videoData);
        })
    });
    metadata.transcode = {
      count: tasks.length,
      errors: []
    };
    if (tasks.length == 0) {
      return done();
    }
    var errors = [];
    var q = async.queue(function(videoData, finished) {
      try {
        if (config.progress) {
          console.log("Transcoding " + (videoData.transcodeTmp.index + 1) + "/" + tasks.length);
        }
        doTranscode(videoData, config);
        videoData.transcode = false;
        videoData.upload = false;
        videoData.find.outputPresent = true;
      } catch (err) {
        errors.push(err);
        videoData.transcode = false;
        if (config.verbose) {
          console.log('Transcoding ' + videoData.find.fullFiles.join(',') +
              ' from ' + videoData.find.videosData + ' failed.');
        }
      } finally {
        finished();
      }
    }, 8);
    q.push(tasks);
    q.drain = function() {
      metadata.transcode.errors = errors;
      return done();
    };
  }
}

var uploadDefaults = {
  progress: true,
  verbose: false,
  veryVerbose: false,
  addCredits: true,
  defaultLanguage: 'en',
  extraTags: [],
  categoryId: '27',
  privacyStatus: "public",
  embeddable: true,
  license: "creativeCommon",
  notifySubscribers: false,
  autoLevels: true,
  stabilize: false
}

var upload = function(config) {
  config = processConfig(config, uploadDefaults);

  return function(files, metalsmith, done) {
    var metadata = metalsmith.metadata();
    assert(metalsmith.metadata().youtube_credentials);

    var youtubeClient = googleapis.youtube({
      version: 'v3',
      auth: metalsmith.metadata().youtube_credentials
    });

    var tasks = [];
    _.each(metalsmith.metadata().videos.byDirectory, function (videosData) {
      _.chain(videosData)
        .filter(function (videoData) {
          return videoData.upload !== false &&
            videoData.find &&
            videoData.find.outputPresent &&
            videoData.youtube === undefined;
        })
        .each(function (videoData, index) {
          videoData.uploadTmp = {
            index: index
          }
          tasks.push(videoData);
        })
    });
    metadata.upload = {
      count: tasks.length,
      errors: []
    };
    if (tasks.length == 0) {
      return done();
    }
    var errors = [];
    var q = async.queue(function(videoData, finished) {
      try {
        if (config.progress) {
          console.log("Uploading " + (videoData.uploadTmp.index + 1) + "/" + tasks.length);
        }
        doUpload(videoData, youtubeClient,
            config, function (err, data) {
              if (err) {
                videoData.upload = false;
                errors.push(err);
                if (config.verbose) {
                  console.log('Uploading ' + videoData.output +' failed: ' + err);
                }
              } else {
                videoData.upload = false;
                if (config.veryVerbose) {
                  console.log(data);
                }
                videoData.youtube = data.id;
              }
              finished();
            });
      } catch (err) {
        errors.push(err);
        videoData.upload = false;
        if (config.verbose) {
          console.log('Uploading ' + videoData.output +' failed: ' + err);
        }
        finished();
      }
    }, 8);
    q.push(tasks);
    q.drain = function() {
      metadata.upload.errors = errors;
      return done();
    };
  }
}

var save = function(config) {
  return function (files, metalsmith, done) {
    var metadata = metalsmith.metadata();
    assert(metadata.videos.byDirectory);
    _.each(metadata.videos.byDirectory, function(videosData, directory) {
      _.each(videosData, function (videoData) {
        delete(videoData.find);
        delete(videoData.uploadTmp);
        delete(videoData.transcodeTmp);
        _.each(videoData.remove, function (key) {
          delete(videoData[key]);
        });
        delete(videoData.remove);
      });
      fs.writeFileSync(path.join(directory, metadata.videos.filename),
          yamljs.stringify(videosData, 2, 2));
    });
    done();
  }
}

exports.find = find
exports.findDefaults = findDefaults
exports.transcode = transcode
exports.transcodeDefaults = transcodeDefaults
exports.upload = upload
exports.uploadDefaults = uploadDefaults
exports.save = save

// vim: ts=2:sw=2:et
