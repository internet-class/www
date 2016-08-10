var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    temp = require('temp'),
    metalsmith = require('metalsmith'),
    lessons = require('./lessons.js'),
    yamljs = require('yamljs');

var argv = require('minimist')(process.argv.slice(2));

temp.track();

metalsmith('.')
  .destination(temp.mkdirSync())
  .use(lessons())
  .use(function(files, metalsmith, done) {
    var videoMetadata = [];
    var fileToMetadata = {};
    _.chain(files)
      .pick(function(file, filename) {
        return path.basename(filename) === 'videos.yaml' && file.lesson !== undefined;
      })
      .each(function(file, filename) {
        _.each(yamljs.parse(file.contents.toString()), function (videoData) {
          if (_.every(videoData.files, function (videoFile) {
            return fs.existsSync(path.join(metalsmith.source(), path.dirname(filename), videoFile));
          })) {
            videoData.files = _.map(videoData.files, function (videoFile) {
              return path.join(metalsmith.source(), path.dirname(filename), videoFile);
            });
            _.each(videoData.files, function (filename) {
              fileToMetadata[filename] = videoData;
            });
            videoMetadata.push(videoData);
          }
        });
      })
      console.log(videoMetadata.length);
      console.log(Object.keys(fileToMetadata).length);
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
