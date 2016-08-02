var metalsmith = require('metalsmith'),
		ignore = require('metalsmith-ignore');

var ignorePatterns = [
	'.gitignore',
	'README*',
	'*.swp',
	'*.swo'
];

metalsmith('.')
  .destination('.build')
	.use(ignore(ignorePatterns))
  .clean(true)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });
