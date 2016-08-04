var metalsmith = require('metalsmith'),
    drafts = require('metalsmith-drafts'),
    ignore = require('metalsmith-ignore'),
    asciidoc = require('./asciidoc.js'),
    concat_convention = require('metalsmith-concat-convention'),
    msif = require('metalsmith-if'),
    clean_css = require('metalsmith-clean-css'),
    uglify = require('metalsmith-uglify'),
    rename = require('metalsmith-rename');

var argv = require('minimist')(process.argv.slice(2));

var ignorePatterns = [
  '.gitignore',
  'README*',
  '*.swp',
  '*.swo'
];

metalsmith('.')
  .destination('.build')
  .use(drafts())
  .use(ignore(ignorePatterns))
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
