'use strict';

var _ = require('underscore'),
    path = require('path'),
    drafts = require('metalsmith-drafts'),
    assert = require('assert'),
    branch = require('metalsmith-branch'),
    layouts = require('metalsmith-layouts'),
    metalsmith = require('metalsmith'),
    temp = require('temp'),
    html_to_text = require('html-to-text'),
    msif = require('metalsmith-if'),
    lessons = require('./lessons.js'),
    asciidoc = require('./asciidoc.js'),
    spellcheck = require('metalsmith-spellcheck'),
    youtube_credentials = require('./youtube_credentials.js'),
    videos = require('./videos.js'),
    flush = require('./flush.js');

temp.track();

var argv = require('minimist')(process.argv.slice(2));

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

var isLesson = function(filename, file, i) {
  if (file.is_lesson) {
    file.layout = 'spellcheck/blank.hbt';
    return true;
  } else {
    return false;
  }
};

metalsmith('.')
  .ignore(ignorePatterns)
  .destination(temp.mkdirSync())
  .use(drafts())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(lessons())
  .use(asciidoc())
  .use(branch(isLesson)
    .use(layouts({ engine: 'handlebars' }))
  )
  .use(getAuthors())
  .use(getTitles())
  .use(spellcheck({
    dicFile: 'dicts/en_US.dic',
    affFile: 'dicts/en_US.aff',
    exceptionFile: 'dicts/spelling_exceptions.json',
    checkedPart: "div#content",
    failErrors: true,
    verbose: true
  }))
  .use(msif((argv['transcode'] == true), videos.transcode({
    extras: '../videos/extras/',
    creditsFile: "black.mp4",
    prerollFile: "typing.mp4",
    postrollFile: "static.mp4",
    progress: true,
    verbose: true,
    veryVerbose: true
  })))
  .use(msif((argv['upload'] == true), youtube_credentials()))
  .use(msif((argv['upload'] == true), videos.upload({
    locationDescription: "Davis Hall, University at Buffalo",
    locationLatitude: 43.0026512146,
    locationLongitude: -78.7873077393,
    extraTags: ['internet', 'internet-class.org']
  })))
  .use(videos.save())
  .use(flush())
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
