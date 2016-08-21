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
    common = require('./common.js');

temp.track();

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
  
  try { 
    transcode.title = videoData.title;
    assert(transcode.title);
    transcode.authorInfo = videoData.authors || config.defaultAuthors;
    assert(transcode.authorInfo);
    transcode.authors = common.andList(_.pluck(transcode.authorInfo, 'name'));
    assert(transcode.authors);
    transcode.titleLength = videoData.titleLength || config.titleLength;
    assert(transcode.titleLength);
    transcode.creditsFile = videoData.creditsFile || config.creditsFile;
    if (transcode.creditsFile) {
      transcode.creditsFile = path.join(config.credits, transcode.creditsFile);
      assert(fs.existsSync(transcode.creditsFile));
      transcode.producers = videoData.producers || config.defaultProducers;
      assert(transcode.producers);
      transcode.creditsLength = videoData.creditsLength || config.creditsLength;
      assert(transcode.creditsLength);
    }
  } catch (err) {
    videoData.transcode = false;
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
  assert(fs.existsSync(georgia));
  assert(fs.existsSync(georgiaBold));
  assert(fs.existsSync(consolas));
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
    child_process.execSync(titleImageCommandLine + '> output.txt 2>&1', { cwd: workingDir });
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
    child_process.execSync(titleImageCommandLine + '> output.txt 2>&1', { cwd: workingDir });
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
    child_process.execSync(titleMovieCommandLine + '> output.txt 2>&1', { cwd: workingDir });
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
    'fontsize=40 : x=w-tw-20 : y=20" -c:a libmp3lame -ac 1 -ab 128k content.mp4';
  try {
    child_process.execSync(encodeCommandLine + '> output.txt 2>&1', { cwd: workingDir });
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
    }
  } else {
    fs.renameSync(path.join(workingDir, 'content.mp4'), path.join(workingDir, 'out.mp4'));
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

function processConfig(config, defaults, src) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

var findDefaults = {
  videoMetadata: '**/videos.yaml',
	videoExtensions: ['**/*.MTS']
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
							videoData.find = {
								directory: fullDirectory,
								metadata: path.join(metalsmith.source(), filename),
								fullFiles: _.map(videoData.files, function (videoFile) {
									return path.join(metalsmith.source(), path.dirname(filename), videoFile);
								})
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
							videoData.find.outputPresent = videoData.output && 
								fs.existsSync(path.join(videoData.find.directory), videoData.output);
							videoDataList.push(videoData);
						});
					})
				callback();
			},
			function (callback) {
        var videoFilename = path.basename(config.videoMetadata);
				_.chain(common.walkSync(metalsmith.source()))
					.filter(function(filename) {
						return videoFiles.indexOf(filename) == -1 &&
							multimatch(path.relative(metalsmith.source(), filename),
                config.videoExtensions).length > 0;
					})
					.each(function(filename) {
						try {
							delete(files[path.relative(metalsmith.source(), filename)]);
						} catch (err) { };
						var dirname = path.dirname(filename);
            if (fs.existsSync(path.join(dirname, videoFilename)) &&
                (!(videoDataByDirectory[dirname]))) {
              return;
            }
						(videoDataByDirectory[dirname] = videoDataByDirectory[dirname] || []).push({
							'files': [ path.basename(filename) ],
							'transcode': false
						});
					})
        var metadata = metalsmith.metadata();
        metadata.videos = {
          filename: videoFilename,
          byDirectory: videoDataByDirectory
        };
        done();
			}]
    );
  }
}

var transcodeDefaults = {
  failAny: true,
  verbose: false,
  veryVerbose: false,
  fonts: path.join(__dirname, 'fonts'),
  credits: path.join(__dirname, 'credits'),
  titleLength: 10,
  creditsLength: 5
}

var transcode = function(config) {
  config = processConfig(config, transcodeDefaults);
  
  return function(files, metalsmith, done) {
    var tasks = [];
    _.each(metalsmith.metadata().videos.byDirectory, function (videosData) {
      _.chain(videosData)
        .filter(function (videoData) {
          return videoData.transcode !== false;
        })
        .each(function (videoData) {
          tasks.push(videoData);
        })
    });
    if (tasks.length == 0) {
      return done();
    }
    var errors = [];
    var q = async.queue(function(videoData, finished) {
      try {
        doTranscode(videoData, config);
      } catch (err) {
        errors.push(err);
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
      if (errors.length == 0) {
        return done();
      } else if (config.failAny) {
        return done(errors[0]);
      } else {
        return done();
      }
    };
  }
}

var save = function(config) {
  return function (files, metalsmith, done) {
    var metadata = metalsmith.metadata();
    assert(metadata.videos.byDirectory);
    _.each(metadata.videos.byDirectory, function(videosData, directory) {
      _.each(videosData, function (videoData) {
        delete(videoData['find']);
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
exports.save = save

// vim: ts=2:sw=2:et
