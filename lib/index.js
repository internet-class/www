'use strict';

var metalsmith = require('metalsmith'),
    _ = require('underscore'),
    common = require('./common.js'),
    drafts = require('metalsmith-drafts'),
    lessons = require('./lessons.js'),
    videos = require('./videos.js'),
    courses = require('./courses.js'),
    asciidoc = require('./asciidoc.js'),
		inplace = require('metalsmith-in-place'),
    layouts = require('metalsmith-layouts'),
    ignore = require('metalsmith-ignore'),
		sass = require('metalsmith-sass'),
    concat_convention = require('metalsmith-concat-convention'),
    msif = require('metalsmith-if'),
    clean_css = require('metalsmith-clean-css'),
    html_minifier = require('metalsmith-html-minifier'),
    beautify = require('metalsmith-beautify'),
    uglify = require('metalsmith-uglify'),
    rename = require('metalsmith-rename');

var argv = require('minimist')(process.argv.slice(2));

metalsmith('.')
  .ignore(common.ignorePatterns)
  .destination('.build')
  .use(drafts())
  .use(lessons())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(videos.link())
  .use(courses.load())
  .use(asciidoc())
	.use(inplace({
		engine: 'handlebars',
		pattern: '**/*.hbs',
		rename: true
	}))
  .use(layouts({
    engine: 'handlebars',
    directory: 'layouts/static/',
    partials: 'layouts/static/partials'
   }))
	.use(sass({
    outputDir: function(originalPath) { 
      return originalPath.replace("sass", "css");
    },
    sourceMap: true,
    sourceMapContents: true
  }))
  .use(concat_convention({
    extname: '.concat'
  }))
  .use(ignore(['**/*.yaml', '**/*.json']))
  .use(html_minifier({
    collapseWhitespace: false
  }))
  .use(msif((argv['deploy'] == true), clean_css({ files: 'css/*.css' })))
  .use(msif((argv['deploy'] == true), uglify()))
  .use(msif((argv['deploy'] == true), rename([[/\.min\.js$/, ".js"]])))
  .use(msif((argv['deploy'] == true), beautify({'indent_size': 1, 'css': false, 'js': false})))
  .clean(true)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
