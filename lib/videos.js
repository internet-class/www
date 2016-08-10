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
   
var videoFiles = [];
var videoMetadata = {};
var fileToMetadata = {};

metalsmith('.')
  .destination(temp.mkdirSync())
  .use(lessons())
  .use(function(files, metalsmith, done) {
    _.chain(files)
      .pick(function(file, filename) {
        return path.basename(filename) === 'videos.yaml' && file.lesson !== undefined;
      })
      .each(function(file, filename) {
        videoMetadata[path.dirname(filename)] = yamljs.parse(file.contents.toString());
        _.each(videoMetadata[path.dirname(filename)], function (videoData) {
          if (_.every(videoData.files, function (videoFile) {
            if (fs.existsSync(metalsmith.source(), path.dirname(filename), videoFile)) {
              videoFiles.push(path.join(metalsmith.source(), path.dirname(filename), videoFile));
              return true;
            } else {
              return false;
            }
          })) {
            _.each(videoData.files, function (filename) {
              fileToMetadata[filename] = videoData;
            });
          }
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
      (videoMetadata[path.dirname(filename)] = videoMetadata[path.dirname(filename)] || []).push({ 'files': [ path.basename(filename) ] });
    })
    _.each(videoMetadata, function(metadata, directory) {
      fs.writeFileSync(path.join(metalsmith.source(), directory, 'videos.yaml'), yamljs.stringify(metadata, 2, 2));
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
