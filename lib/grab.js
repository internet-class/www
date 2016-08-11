var argv = require('minimist')(process.argv.slice(2)),
    _ = require('underscore'),
    async = require('async'),
    child_process = require('child_process'),
    common = require('./common.js'),
    path = require('path'),
    fs = require('fs-extra');

var input = argv._[0];
var output = argv._[1];
var newoutput = argv._[2];

if (!input || !output || !newoutput) {
  console.log('Usage grab.js <input> <backup> <newoutput>');
  process.exit(1);
}

if (!(fs.existsSync(input))) {
  console.log('Directory ' + input + ' does not exist.');
  process.exit(1);
}
if (!(fs.existsSync(output))) {
  console.log('Directory ' + output + ' does not exist.');
  process.exit(1);
}
if (!(fs.existsSync(newoutput))) {
  console.log('Directory ' + newoutput + ' does not exist.');
  process.exit(1);
}

var cameraFiles = _.filter(common.walkSync(input), function (filename) {
  return (path.extname(filename) === '.MTS');
});

async.forEachOf(cameraFiles, function (filename, index, finished) {
  child_process.exec('md5sum ' + filename, function (err, stdout, stderr) {
    if (err) {
      console.log('Checksum failed for ' + filename);
      process.exit(1);
    } else {
      var hash = stdout.split(' ')[0];
      var target = path.join(output, hash + path.extname(filename));
      var targetExists = fs.existsSync(target);

      if (targetExists && (fs.statSync(target)['size'] == fs.statSync(filename)['size'])) {
        process.stderr.write('s');
        finished();
      } else {
        fs.copy(filename, target, { preserveTimestamps: true }, function (err) {
          if (err) {
            console.log('Copy failed from ' + filename + ' to ' + target);
            process.exit(1);
          } else {
            var newTarget = path.join(newoutput, hash + path.extname(filename));
            fs.copy(target, newTarget, { preserveTimestamps: true }, function (err) {
              if (err) {
                console.log('Copy failed from ' + target + ' to ' + newTarget);
                process.exit(1);
              } else {
                if (targetExists) {
                  process.stderr.write('r');
                } else {
                  process.stderr.write('.');
                }
                finished();
              }
            });
          }
        });
      }
    }
  });
}, function () {
  process.stderr.write('\n');
});

// vim: ts=2:sw=2:et
