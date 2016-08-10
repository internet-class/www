var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    temp = require('temp'),
    metalsmith = require('metalsmith'),
    lessons = require('./lessons.js'),
    yamljs = require('yamljs');

var argv = require('minimist')(process.argv.slice(2));

var videoExtensions = ['.MTS']

temp.track();

var videoDataByDirectory = {};
var videoDataList = [];
var videoFiles = [];

metalsmith('.')
  .destination(temp.mkdirSync())
  .use(lessons())
  .use(function(files, metalsmith, done) {
    _.chain(files)
      .pick(function(file, filename) {
        return path.basename(filename) === 'videos.yaml' && file.lesson !== undefined;
      })
      .each(function(file, filename) {
        var videosData = yamljs.parse(file.contents.toString());
        videoDataByDirectory[path.dirname(filename)] = videosData;
        
        _.each(videosData, function (videoData) {
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
    done();
  })
  .use(function(files, metalsmith, done) {
    _.chain(files)
      .pick(function(file, filename) {
        return videoFiles.indexOf(path.join(metalsmith.source(), filename)) == -1 &&
          videoExtensions.indexOf(path.extname(filename)) !== -1 && file.lesson !== undefined;
      })
      .each(function(file, filename) {
        var dirname = path.dirname(filename);
        (videoDataByDirectory[dirname] = videoDataByDirectory[dirname] || []).push({ 'files': [ path.basename(filename) ] });
      })

    _.each(videoDataByDirectory, function(videosData, directory) {
      _.each(videosData, function (videoData) {
        delete(videoData['fullFiles']);
        delete(videoData['present']);
      });
      fs.writeFileSync(path.join(metalsmith.source(), directory, 'videos.yaml'), yamljs.stringify(videosData, 2, 2));
    });
    done();
  })
  .use(function(files, metalsmith, done) {
    for (var file in files) {
      delete(files[file]);
    }
    done();
  })
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
