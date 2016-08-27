'use strict';

var metalsmith = require('metalsmith'),
    _ = require('underscore'),
    temp = require('temp'),
    common = require('./common.js'),
    drafts = require('metalsmith-drafts'),
    lessons = require('./lessons.js'),
    videos = require('./videos.js'),
    courses = require('./courses.js');

metalsmith('.')
  .ignore(common.ignorePatterns)
  .destination(temp.mkdirSync())
  .use(drafts())
  .use(lessons())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(videos.link())
  .use(courses.convert())
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
