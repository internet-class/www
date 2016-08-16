'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    async = require('async'),
    child_process = require('child_process'),
    path = require('path'),
    fs = require('fs-extra'),
    tmp = require('tmp'),
    metalsmith = require('metalsmith'),
    lessons = require('./lessons.js'),
    flush = require('./flush.js'),
    yamljs = require('yamljs'),
    handlebars = require('handlebars'),
    common = require('./common.js');

tmp.setGracefulCleanup();

var titleTemplate = handlebars.compile(`
<span size="larger"><b>{{ title }}</b></span>
{{ authors }}`);

var creditsTemplate = handlebars.compile(`
<span size="larger"><b>Presenters</b></span>
{{#each presenters}}
{{ name }} ({{ title }}, {{ affiliation }})
{{/each}}

<span size="larger"><b>Camera</b></span>
{{#each camera}}
{{ name }} ({{ title }}, {{ affiliation }})
{{/each}}`);

var getTranscodeInfo = function(videoData) {
  var transcode = {};
  
  try { 
    transcode.title = videoData.title || videoData.lesson.title;
    assert(transcode.title);

    transcode.authorInfo = videoData.authors || videoData.lesson.author.name;
    assert(transcode.authorInfo);
    transcode.authors = common.andList(transcode.authorInfo);
    assert(transcode.authors);
  } catch (err) {
    console.log(videoData);
    throw new Error("video missing transcode metadata: " + err);
  }

  return transcode;
}

var transcode = function(videoData, config, finished) {
  var workingDir = tmp.dirSync().name;
  var transcodeInfo = getTranscodeInfo(videoData);

  var titleFile = path.join(workingDir, 'title.txt');
  fs.writeFileSync(titleFile, titleTemplate(transcodeInfo));
  finished();
  return;

  var concatFile = path.join(workingDir, 'concat');
  
  try {
    var title = videoData.title || videoData.lesson.title;
    var authors = videoData.authors || videoData.lesson.author.name;
  } catch (err) {
    throw new Error("video missing metadata: " + err);
    return;
  }
  var authorNames = common.andList(authors);


  
  fs.writeFileSync(concatFile,
    _.map(videoData.tmp.fullFiles, function (filename) {
      return "file '" + filename + "'";
    }).join('\n') + '\n');
  
  fs.writeFileSync(path.join(workingDir, 'title.txt'), title);
  fs.writeFileSync(path.join(workingDir, 'authors.txt'), authorNames);
  
  var fonts = config.fonts;
  assert(fs.existsSync(path.join(fonts, 'Georgia.ttf')));
  assert(fs.existsSync(path.join(fonts, 'Consolas.ttf')));
  assert(fs.existsSync(path.join(fonts, 'Georgia_Bold.ttf')));

  var encodeCommandLine = "ffmpeg -f concat -safe 0 -i concat -vf " + 
    "\"drawtext=enable='between(t,0,10)':fontfile=" + fonts + "/Georgia_Bold.ttf:textfile=title.txt:" +
    "fontcolor=white:bordercolor=black:borderw=1:fontsize=60:x=20:y=h-160:fix_bounds=true, " +
    "drawtext=enable='between(t,0,10)':fontfile=" + fonts + "/Georgia.ttf:textfile=authors.txt:" + 
    "fontcolor=white:bordercolor=black:borderw=1:fontsize=40:x=20:y=h-90:fix_bounds=true, " +
    "drawtext=fontfile=" + fonts + "/Consolas.ttf:text='internet-class.org':" +
    "fontcolor=white:fontsize=40:x=w-tw-20:y=20:fix_bounds=true\" " +
    "-c:a libmp3lame -ac 1 -ab 128k out.mp4 > output.txt 2>&1";

  try {
    child_process.execSync(encodeCommandLine, { cwd: workingDir });
  } catch (err) {
    if (config.veryVerbose) {
      console.log(fs.readFileSync(path.join(workingDir, 'output.txt')).toString());
    }
    throw new Error("ffmpeg transcode failed");
    return;
  }
  if (!(fs.existsSync(path.join(workingDir, 'out.mp4')))) {
    throw new Error("no output file created");
    return;
  }

  var probeCommandLine = 'ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 out.mp4';
  console.log(probeCommandLine);
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
  'failAny': true,
  'veryVerbose': false,
  'veryverbose': false,
  'videos': '**/videos.yaml',
  'transcode': true,
  'upload': true,
  'fonts': path.join(__dirname, 'fonts')
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
