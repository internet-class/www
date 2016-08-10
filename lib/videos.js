var metalsmith = require('metalsmith'),
		temp = require('temp');

var argv = require('minimist')(process.argv.slice(2));

temp.track();

metalsmith('.')
  .destination(temp.mkdirSync())
  .use(function(files, metalsmith, done) {
    for (var file in files) {
      delete(files[file]);
    }
    done();
  })
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
