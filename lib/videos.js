'use strict';

var _ = require('underscore'),
    multimatch = require('multimatch'),
    async = require('async'),
    child_process = require('child_process'),
    path = require('path'),
    fs = require('fs'),
    tmp = require('tmp'),
    metalsmith = require('metalsmith'),
    lessons = require('./lessons.js'),
    flush = require('./flush.js'),
    yamljs = require('yamljs'),
    common = require('./common.js');

tmp.setGracefulCleanup();

var transcode = function(videoData, finished) {
  var workingDir = tmp.dirSync().name;
  var concatFile = path.join(workingDir, 'concat');

  fs.writeFileSync(concatFile,
    _.map(videoData.tmp.fullFiles, function (filename) {
      return "file '" + filename + "'";
    }).join('\n') + '\n');

  var encodeCommandLine = 'ffmpeg -f concat -safe 0 -i concat -c:v copy -c:a libmp3lame -ac 1 -ab 128k out.mp4 > output.txt 2>&1';
  try {
    child_process.execSync(encodeCommandLine, { cwd: workingDir });
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("ffmpeg transcode failed");
  }
  if (!(fs.existsSync(path.join(workingDir, 'out.mp4')))) {
    throw new Error("no output file created");
  }

  var probeCommandLine = 'ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 out.mp4';
  var durationSec = child_process.execSync(probeCommandLine, { cwd: workingDir }).toString();
  videoData.durationSec = parseFloat(durationSec);

  var name = common.md5sum(path.join(workingDir, 'out.mp4')) + '.mp4';
  var renamePath = path.join(path.dirname(videoData.tmp.videosData), name);
  if (fs.existsSync(renamePath)) {
    console.log("not replacing output with the correct hash");
  } else {
    videoData.inputHash = common.md5sum(videoData.tmp.fullFiles);
    videoData.output = path.basename(renamePath);
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
  'failAny': true,
  'veryVerbose': false,
  'veryverbose': false,
  'videos': '**/videos.yaml',
  'transcode': true,
  'upload': true
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
                transcode(task.videoData, finished);
              } catch (err) {
                errors.push(err);
                if (config.verbose) {
                  console.log('Transcoding ' + task.videoData.tmp.fullFiles.join(',') + ' from ' + task.videoData.videosData + ' failed.');
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
