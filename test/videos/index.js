var _ = require('underscore'),
    metalsmith = require('metalsmith'),
    fs = require('fs-extra'),
    path = require('path'),
    chai = require('chai'),
    temp = require('temp'),
    yamljs = require('yamljs'),
    powerAssert = require('power-assert'),
    common = require('../../lib/common.js'),
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

beforeEach(function() {
  noShortVideo = !(fs.existsSync(path.join(__dirname, 'fixtures/videos/short.MTS')));
});

describe('videos.js', function() {
  it('should do nothing when there is nothing to do', function (done) {
    metalsmith(metalsmithTempDir())
      .ignore(['*.MTS'])
      .use(videos.find())
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(Object.keys(files).length == 0);
        done();
      });
  });
  it('should ignore new videos that fail to match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'short.MTS');

    metalsmith(src)
      .ignore(['*.MTS'])
      .use(videos.find({ videoExtensions: ['**/*.mp4'] }))
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(!(fs.existsSync(path.join(src, 'src/videos.yaml'))));
        assert(Object.keys(files).length == 0);
        done();
      });
  });
  it('should find new videos that match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'short.MTS');

    metalsmith(src)
      .ignore(['*.MTS'])
      .use(videos.find({ videoExtensions: ['**/*.MTS'] }))
      .use(function (files, metalsmith, done) {
        var videos = metalsmith.metadata().videos;
        assert(Object.keys(videos.byDirectory).length == 1);
        _.each(videos.videoDataByDirectory, function (videoData) {
          assert(videoData.find);
          assert(videoData.find.inputsPresent);
        });
        done();
      })
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(fs.existsSync(path.join(src, 'src/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.files.length == 1);
        assert(videoData.files[0] == 'short.MTS');
        assert(videoData.transcode == false);
        assert(Object.keys(files).length == 0);
        done();
      });
  });
  it('should ignore existing videos that fail to match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/short.yaml', src, 'in/videos.yaml');
    var previousHash = common.md5sum(path.join(src, 'src/in/videos.yaml'));

    metalsmith(src)
      .ignore(['*.MTS'])
      .use(videos.find({ videoMetadata: 'videos.yaml' }))
      .use(function (file, metalsmith, done) {
        var metadata = metalsmith.metadata();
        assert(Object.keys(metadata.videos.byDirectory).length == 0);
        done();
      })
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        assert(previousHash == common.md5sum(path.join(src, 'src/in/videos.yaml')));
        assert(Object.keys(files).length == 1);
        done();
      });
  });
  it('should find existing videos that match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'short.MTS');
    copyFixture('videos/short.yaml', src, 'in/videos.yaml');
    var previousHash = common.md5sum(path.join(src, 'src/in/videos.yaml'));

    metalsmith(src)
      .ignore(['*.MTS'])
      .use(videos.find())
      .use(function (file, metalsmith, done) {
        var metadata = metalsmith.metadata();
        assert(Object.keys(metadata.videos.byDirectory).length == 1);
        done();
      })
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.files.length == 1);
        assert(videoData.files[0] == 'short.MTS');
        assert(Object.keys(files).length == 1);
        done();
      });
  });
  it('should not transcode bogus videos', function (done) {
    this.slow(500);
    this.timeout(1000);

    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'in/short.MTS');
    copyFixture('videos/short.yaml', src, 'in/videos.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .ignore(['*.MTS'])
      .use(videos.find())
      .use(videos.transcode())
      .use(videos.save())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("Should fail"));
        }
        assert(err.message.startsWith("bogus input"));
        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(!('inputHash' in videoData));
        assert(!('output' in videoData));
        assert(!('durationSec' in videoData));
        assert(!('tmp' in videoData));
        done();
      });
  });
//  it('should transcode real videos', function (done) {
//    if (noShortVideo) {
//      console.log("SKIP: skipping this test because short input missing");
//      return done();
//    }
//
//    this.slow(10000);
//    this.timeout(20000);
//    
//    var src = metalsmithTempDir();
//    copyFixture('videos/short.MTS', src, 'in/short.MTS');
//    copyFixture('videos/short.yaml', src, 'in/videos.yaml');
//
//    metalsmith(src)
//      .ignore(['*.MTS'])
//      .use(videos())
//      .build(function (err, files) {
//        if (err) {
//          return done(err);
//        }
//        assert(Object.keys(files).length == 1);
//        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
//        assert(videosData.length == 1);
//        var videoData = videosData[0];
//        assert(videoData.present);
//        assert(videoData.output);
//        assert(fs.existsSync(path.join(src, 'src/in/' + videoData.output)));
//        assert(videoData.inputHash == '6bcfa870d3fa94798b3f3a2ead8e303f');
//        chai.expect(videoData.durationSec).to.be.within(2.05, 2.07);
//        assert(!('tmp' in videoData));
//        done();
//      });
//  });
//  it('should add credits properly', function (done) {
//    if (noShortVideo) {
//      console.log("SKIP: skipping this test because short input missing");
//      return done();
//    }
//
//    this.slow(10000);
//    this.timeout(20000);
//
//    var src = metalsmithTempDir();
//    copyFixture('videos/short.MTS', src, 'in/short.MTS');
//    copyFixture('videos/short.MTS', src, 'credits/credits.MTS');
//    copyFixture('videos/with_credits.yaml', src, 'in/videos.yaml');
//
//    metalsmith(src)
//      .ignore(['*.MTS'])
//      .use(videos({
//        credits: path.join(src, 'src/credits')
//      }))
//      .build(function (err, files) {
//        if (err) {
//          return done(err);
//        }
//        assert(Object.keys(files).length == 1);
//        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
//        assert(videosData.length == 1);
//        var videoData = videosData[0];
//        assert(videoData.present);
//        assert(videoData.output);
//        assert(fs.existsSync(path.join(src, 'src/in/' + videoData.output)));
//        assert(videoData.inputHash == '6bcfa870d3fa94798b3f3a2ead8e303f');
//        chai.expect(videoData.durationSec).to.be.within(3.10, 3.12);
//        assert(!('tmp' in videoData));
//        done();
//      });
//  });
});

// vim: ts=2:sw=2:et
