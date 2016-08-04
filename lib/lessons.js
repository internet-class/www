var async = require('async'),
    common = require('./common.js');

module.exports = function(config) {
  return function(files, metalsmith, done) {
    async.forEachOf(common.lessonfiles(files), function(file, filename, finished) {
			console.log(filename);
      finished();
    }, function () {
      done();
    });
  }
};

// vim: ts=2:sw=2:et
