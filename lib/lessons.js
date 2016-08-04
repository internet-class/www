var async = require('async'),
    path = require('path'),
    common = require('./common.js');

module.exports = function(config) {
  return function(files, metalsmith, done) {
    lessonDirectories = [];
    async.forEachOf(common.lessonfiles(files), function(file, filename, finished) {
      lessonDirectories += path.dirname(filename);
      finished();
    }, function () {
      console.log(lessonDirectories);
      done();
    });
  }
};

// vim: ts=2:sw=2:et
