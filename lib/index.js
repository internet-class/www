'use strict';

var metalsmith = require('metalsmith'),
    _ = require('underscore'),
    common = require('./common.js'),
    drafts = require('metalsmith-drafts'),
    lessons = require('./lessons.js'),
    videos = require('./videos.js'),
    asciidoc = require('./asciidoc.js'),
    concat_convention = require('metalsmith-concat-convention'),
    msif = require('metalsmith-if'),
    clean_css = require('metalsmith-clean-css'),
    uglify = require('metalsmith-uglify'),
    rename = require('metalsmith-rename');

var argv = require('minimist')(process.argv.slice(2));

var linkVideos = function(config) {
  return function(files, metalsmith, done) {
    _.each(metalsmith.metadata().videos.allVideos, function (videoData) {
      var lesson = videoData.find.metalsmith.lesson;
      (lesson.videos = lesson.videos || []).push(videoData);
    })
    return done();
  }
}
    
metalsmith('.')
  .ignore(common.ignorePatterns)
  .destination('.build')
  .use(drafts())
  .use(lessons())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(linkVideos())
  .use(asciidoc())
  .use(concat_convention({
    extname: '.concat'
  }))
  .use(msif((argv['deploy'] == true), clean_css({ files: 'css/*.css' })))
  .use(msif((argv['deploy'] == true), uglify()))
  .use(msif((argv['deploy'] == true), rename([[/\.min\.js$/, ".js"]])))
  .clean(true)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
