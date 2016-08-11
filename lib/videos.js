var _ = require('underscore'),
    multimatch = require('multimatch'),
    async = require('async'),
    child_process = require('child_process'),
    path = require('path'),
    fs = require('fs'),
    temp = require('temp'),
    metalsmith = require('metalsmith'),
    lessons = require('./lessons.js'),
    flush = require('./flush.js'),
    yamljs = require('yamljs');

var argv = require('minimist')(process.argv.slice(2));

var videoExtensions = ['.MTS']

temp.track();

var videoDataByDirectory = {};
var videoDataList = [];
var videoFiles = [];

var transcode = function(videoData) {
  var workingDir = temp.mkdirSync();
  var concatFile = path.join(workingDir, 'concat');

  fs.writeFileSync(concatFile,
    _.map(videoData.fullFiles, function (filename) {
      return "file '" + filename + "'";
    }).join('\n'));

  var commandLine = 'ffmpeg -i concat -c:v copy -c:a libfdk_aac -ac 1 -ab 128k out.mp4 2>/dev/null';
  child_process.execSync(commandLine, { cwd: workingDir });

  return;
}

var defaults = {
  'verbose': false,
  'videos': '**/videos.yaml'
}

function processConfig(config, src) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

function videos(config) {
  return function (files, metalsmith, done) {

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
              
              _.each(videosData, function (videoData) {
                videoData.videosData = filename;
                videoData.fullFiles = _.map(videoData.files, function (videoFile) {
                  return path.join(metalsmith.source(), path.dirname(filename), videoFile);
                });
                videoData.present = _.every(videoData.fullFiles, function (videoFile) {
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
                transcode(task.videoData);
              } catch (err) {
                errors.push(err);
                if (config.verbose) {
                  console.log('Transcoding ' + task.videoData.fullFiles.join(',') + ' from ' + task.videoData.videosData + ' failed.');
                }
              }
            }
            finished();
          }, 8);
          q.push(_.map(videoDataList, function (videoData) {
            return { operation: 'transcode', videoData: videoData };
          }));
          q.drain = function() {
            if (errors.length == 0) {
              done();
            } else {
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
              var dirname = path.dirname(filename);
              (videoDataByDirectory[dirname] = videoDataByDirectory[dirname] || []).push({
                'files': [ path.basename(filename) ],
                'ready': false
              });
            })

          _.each(videoDataByDirectory, function(videosData, directory) {
            _.each(videosData, function (videoData) {
              delete(videoData['fullFiles']);
              delete(videoData['present']);
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
