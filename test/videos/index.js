var metalsmith = require('metalsmith'),
    fs = require('fs-extra'),
    path = require('path'),
    chai = require('chai'),
    temp = require('temp'),
    videos = require('../../lib/videos.js');

chai.use(require('chai-fs'));
temp.track();
var assert = chai.assert;

var metalsmithTempDir = function() {
  var src = temp.mkdirSync();
  fs.mkdirsSync(path.join(src, 'src'));
  return src;
}

var copyFixture = function(src, base, dest) {
  fs.mkdirsSync(path.dirname(path.join(base, 'src', dest)));
  fs.copySync(path.join(__dirname, 'fixtures', src),
      path.join(base, 'src', dest), { preserveTimestamps: true });
  return;
}

var sameFile = function(base, src, prevHash) {
  newHash = md5(fs.readFileSync(path.join(base, 'src', src)));
  if (prevHash !== undefined) {
    return newHash == prevHash;
  } else {
    return newHash;
  }
}

var fileSearch = function(files, pathEnd) {
  if (Array.isArray(files)) {
    return _.filter(files, function (filename) {
      return filename.endsWith(pathEnd);
    }).length;
  } else {
    return _.filter(files, function (file, filename) {
      return filename.endsWith(pathEnd);
    }).length;
  }
}

describe('videos.js', function() {
  it('should do nothing when there is nothing to do', function (done) {
    metalsmith(metalsmithTempDir())
      .use(videos())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(Object.keys(files).length == 0);
        done();
      });
  });
  it('should ignore videos that fail to match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'video.MTS');
    copyFixture('videos/videos.yaml', src, 'videos.yaml');

    metalsmith(src)
      .use(videos({ videos: '**/lessons/**/videos.yaml' }))
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(Object.keys(files).length == 2);
        done();
      });
  });
  it('should fail on bogus videos', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'lessons/i@i.me/01/video.MTS');
    copyFixture('videos/videos.yaml', src, 'lessons/i@i.me/01/videos.yaml');

    metalsmith(src)
      .use(videos())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("Should fail"));
        }
        done();
      });
  });
});

// vim: ts=2:sw=2:et