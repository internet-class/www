'use strict';

var _ = require('underscore'),
    path = require('path'),
    drafts = require('metalsmith-drafts'),
    assert = require('assert'),
    metalsmith = require('metalsmith'),
    temp = require('temp'),
    html_to_text = require('html-to-text'),
    lessons = require('./lessons.js'),
    asciidoc = require('metalsmith-asciidoc'),
    youtube_credentials = require('./youtube_credentials.js'),
    videos = require('./videos.js'),
    flush = require('./flush.js');

temp.track();

var ignorePatterns = [
  '**/.gitignore',
  '**/README*',
  '**/*.swp',
  '**/*.swo',
  '**/*.MTS',
  '**/*.mp4'
];

metalsmith('.')
  .ignore(ignorePatterns)
  .destination(temp.mkdirSync())
  .use(drafts())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(videos.sync({ verbose: true, backup: '../videos/backup/' }))
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(videos.save())
  .use(flush())
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
