'use strict';

var _ = require('underscore'),
    path = require('path'),
    drafts = require('metalsmith-drafts'),
    assert = require('assert'),
    metalsmith = require('metalsmith'),
    temp = require('temp'),
    html_to_text = require('html-to-text'),
    lessons = require('./lessons.js'),
    asciidoc = require('./asciidoc.js'),
    youtube_credentials = require('./youtube_credentials.js'),
    videos = require('./videos.js'),
    flush = require('./flush.js');

temp.track();

var defaultAuthors = [{
  name: "Geoffrey Challen",
  credits: "Assistant Professor, Computer Science and Engineering, University at Buffalo"
}]
var defaultProducers = [{
  name: "Greg Bunyea",
  credits: "Undergraduate, Computer Science and Engineering, University at Buffalo"
}]

var getAuthors = function(config) {
  return function(files, metalsmith, done) {
    _.each(metalsmith.metadata().videos.allVideos, function (videoData) {
      if (!(videoData.authors)) {
        videoData.authors = defaultAuthors;
        videoData.remove.push('authors');
      }
      if (!(videoData.producers)) {
        videoData.producers = defaultProducers;
        videoData.remove.push('producers');
      }
    });
    done();
  }
}

var getTitles = function(config) {
  return function(files, metalsmith, done) {
    _.each(metalsmith.metadata().videos.allVideos, function (videoData) {
      if (!(videoData.title)) {
        videoData.title = videoData.find.metalsmith.lesson.title;
        videoData.remove.push('title');
      }
      if (!(videoData.description)) {
        videoData.description = html_to_text.fromString(videoData.find.metalsmith.lesson.contents.toString(), {
            wordwrap: false,
            ignoreHref: true,
            ignoreImage: true,
            uppercaseHeadings: false
          });
        videoData.remove.push('description');
      }
    });
    done();
  }
}

var ignorePatterns = [
  '**/.gitignore',
  '**/README*',
  '**/*.swp',
  '**/.swo',
  '**/*.MTS',
  '**/*.mp4'
];

metalsmith('.')
  .ignore(ignorePatterns)
  .destination(temp.mkdirSync())
  .use(drafts())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(lessons())
  .use(asciidoc())
  .use(getAuthors())
  .use(getTitles())
  .use(videos.transcode({
    credits: '../videos/credits/',
    preroll: '../videos/preroll/',
    creditsFile: "black.mp4",
    prerollFile: "typing.mp4",
    progress: true
  }))
  .use(youtube_credentials())
  .use(videos.upload({
    locationDescription: "Davis Hall, University at Buffalo",
    locationLatitude: 43.0026512146,
    locationLongitude: -78.7873077393,
    extraTags: ['internet', 'internet-class.org']
  }))
  .use(videos.save())
  .use(flush())
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
