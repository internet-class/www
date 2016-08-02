var metalsmith = require('metalsmith'),
		ignore = require('metalsmith-ignore'),
    asciidoc = require('./asciidoc.js');

var ignorePatterns = [
	'.gitignore',
	'README*',
	'*.swp',
	'*.swo'
];

metalsmith('.')
  .destination('.build')
	.use(ignore(ignorePatterns))
  .use(asciidoc())
  .clean(true)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });
