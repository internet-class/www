var metalsmith = require('metalsmith'),
    fs = require('fs-extra'),
    path = require('path'),
    chai = require('chai'),
    tmp = require('tmp'),
    yamljs = require('yamljs'),
    common = require('../../lib/common.js'),
    videos = require('../../lib/videos.js');

chai.use(require('chai-fs'));
tmp.setGracefulCleanup();
var assert = chai.assert;

var metalsmithTempDir = function() {
  var src = tmp.dirSync().name;
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

beforeEach(function() {
  noShortVideo = !(fs.existsSync(path.join(__dirname, 'fixtures/videos/short.MTS')));
});

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
  it('should not transcode bogus videos', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'lessons/i@i.me/01/video.MTS');
    copyFixture('videos/videos.yaml', src, 'lessons/i@i.me/01/videos.yaml');

    metalsmith(src)
      .use(videos())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("Should fail"));
        }
        assert(!(fs.existsSync(path.join(src, 'src', 'lessons/i@i.me/01/01.mp4'))));
        done();
      });
  });
  it('should transcode real videos', function (done) {
    if (noShortVideo) {
      console.log("SKIP: skipping this test because short input missing");
      return done();
    }
    var src = metalsmithTempDir();
    copyFixture('videos/short.MTS', src, 'lessons/i@i.me/01/video.MTS');
    copyFixture('videos/videos.yaml', src, 'lessons/i@i.me/01/videos.yaml');

    metalsmith(src)
      .use(videos())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(fs.existsSync(path.join(src, 'src/lessons/i@i.me/01/cb79677deb19909949665c9151fa446e.mp4')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/lessons/i@i.me/01/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.present);
        assert(videoData.inputHash == '6bcfa870d3fa94798b3f3a2ead8e303f');
        assert(videoData.output == 'cb79677deb19909949665c9151fa446e.mp4');
        chai.expect(videoData.durationSec).to.be.within(1.518177, 1.518179);
        assert(!('tmp' in videoData));
        done();
      });
  });
});

// vim: ts=2:sw=2:et
