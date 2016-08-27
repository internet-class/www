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
    uglify = require('metalsmith-uglify'),
    rename = require('metalsmith-rename'),
    spellcheck = require('metalsmith-spellcheck'),
    formatcheck = require('metalsmith-formatcheck'),
    linkcheck = require('metalsmith-linkcheck');

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
		rename: true,
    directory: 'layouts/static/',
    partials: 'layouts/static/partials'
	}))
  .use(layouts({
    engine: 'handlebars',
    directory: 'layouts/static/',
    partials: 'layouts/static/partials'
   }))
	.use(sass({
    outputDir: function(originalPath) { 
      return originalPath.replace("sass", "css");
    }
  }))
  .use(concat_convention({
    extname: '.concat'
  }))
  .use(ignore(['**/*.yaml', 'lessons/**/*.json', 'courses/**/*.json', 'materialize/**']))
  .use(html_minifier({
    collapseWhitespace: false
  }))
  .use(msif((argv['deploy'] == true), clean_css({ files: 'css/*.css' })))
  .use(msif((argv['deploy'] == true), uglify()))
  .use(msif((argv['deploy'] == true), rename([[/\.min\.js$/, ".js"]])))
  .use(msif((argv['deploy'] == true), html_minifier()))
  .use(msif((argv['deploy'] == false), html_minifier({ collapseWhitespace: false })))
  .use(msif((argv['check'] == true),
    spellcheck({ dicFile: 'dicts/en_US.dic',
                 affFile: 'dicts/en_US.aff',
                 exceptionFile: 'dicts/spelling_exceptions.json',
                 checkedPart: "div#content",
                 failErrors: false,
                 verbose: true})))
  .use(msif((argv['check'] == true),
    formatcheck({ verbose: true , checkedPart: "div#content", failWithoutNetwork: false })))
  .use(msif((argv['check'] == true),
    linkcheck({ verbose: true , failWithoutNetwork: false })))
  .use(ignore(['.*.json', 'dicts/*']))
  .clean(true)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
