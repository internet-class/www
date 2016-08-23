var _ = require('underscore'),
    metalsmith = require('metalsmith'),
    async = require('async'),
    fs = require('fs-extra'),
    path = require('path'),
    chai = require('chai'),
    temp = require('temp'),
    yamljs = require('yamljs'),
    powerAssert = require('power-assert'),
    youtube_credentials = require('../../lib/youtube_credentials.js'),
    html_to_text = require('html-to-text'),
    googleapis = require('googleapis'),
    uuid = require('node-uuid'),
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

var copyFixture = function (src, base, dest) {
  fs.mkdirsSync(path.dirname(path.join(base, 'src', dest)));
  fs.copySync(path.join(__dirname, 'fixtures', src),
      path.join(base, 'src', dest), { preserveTimestamps: true });
  return;
}

var copyFile = function (src, base, dest) {
  fs.mkdirsSync(path.dirname(path.join(base, dest)));
  fs.copySync(path.join(__dirname, 'fixtures', src),
      path.join(base,  dest), { preserveTimestamps: true });
  return;
}

var sameFile = function (base, src, prevHash) {
  newHash = md5(fs.readFileSync(path.join(base, 'src', src)));
  if (prevHash !== undefined) {
    return newHash == prevHash;
  } else {
    return newHash;
  }
}

var fileSearch = function (files, pathEnd) {
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
  noCredentials = !(fs.existsSync(path.join(__dirname, 'fixtures/upload/credentials.json')));
});

describe('videos.js', function() {
  it('should do nothing when there is nothing to do', function (done) {
    metalsmith(metalsmithTempDir())
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(videos.find())
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(Object.keys(files).length == 0);
        return done();
      });
  });
  it('should ignore new videos that fail to match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'short.MTS');

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 0);
        return done();
      })
      .use(videos.find({ videoExtensions: ['**/*.mp4'] }))
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(!(fs.existsSync(path.join(src, 'src/videos.yaml'))));
        assert(Object.keys(files).length == 0);
        return done();
      });
  });
  it('should find new videos that match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'short.MTS');

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 0);
        return done();
      })
      .use(videos.find({ videoExtensions: ['**/*.MTS'] }))
      .use(function (files, metalsmith, done) {
        var videos = metalsmith.metadata().videos;
        assert(Object.keys(videos.byDirectory).length == 1);
        _.each(videos.videoDataByDirectory, function (videoData) {
          assert(videoData.find);
          assert(videoData.find.inputsPresent);
        });
        return done();
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
        assert(Object.keys(files).length == 1);
        return done();
      });
  });
  it('should ignore existing videos that fail to match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/short.yaml', src, 'in/videos.yaml');
    var previousHash = common.md5sum(path.join(src, 'src/in/videos.yaml'));

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 1);
        return done();
      })
      .use(videos.find({ videoMetadata: 'videos.yaml' }))
      .use(function (file, metalsmith, done) {
        var metadata = metalsmith.metadata();
        assert(Object.keys(metadata.videos.byDirectory).length == 0);
        return done();
      })
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        assert(previousHash == common.md5sum(path.join(src, 'src/in/videos.yaml')));
        assert(Object.keys(files).length == 1);
        return done();
      });
  });
  it('should find existing videos that match the pattern', function (done) {
    var src = metalsmithTempDir();
    copyFixture('videos/fake.MTS', src, 'in/short.MTS');
    copyFixture('videos/short.yaml', src, 'in/videos.yaml');
    var previousHash = common.md5sum(path.join(src, 'src/in/videos.yaml'));

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 1);
        return done();
      })
      .use(videos.find())
      .use(function (file, metalsmith, done) {
        var metadata = metalsmith.metadata();
        assert(Object.keys(metadata.videos.byDirectory).length == 1);
        return done();
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
        return done();
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
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 1);
        return done();
      })
      .use(videos.find())
      .use(videos.transcode())
      .use(videos.save())
      .use(function (files, metalsmith, done) {
        assert(metalsmith.metadata().transcode.errors.length == 1);
        assert(metalsmith.metadata().transcode.errors[0].message.startsWith('bogus input'));
        done();
      })
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(!('inputHash' in videoData));
        assert(!('output' in videoData));
        assert(!('durationSec' in videoData));
        assert(!('find' in videoData));
        return done();
      });
  });
  it('should fail fast with bad inputs', function (done) {
    this.slow(500);
    this.timeout(1000);

    var src = metalsmithTempDir();
    copyFixture('videos/short.MTS', src, 'in/short.MTS');
    copyFixture('videos/bad_credits.yaml', src, 'in/videos.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 1);
        return done();
      })
      .use(videos.find())
      .use(videos.transcode({ credits: 'credits' }))
      .use(videos.save())
      .use(function (files, metalsmith, done) {
        assert(metalsmith.metadata().transcode.errors.length == 1);
        console.log(metalsmith.metadata().transcode.errors[0]);
        assert(metalsmith.metadata().transcode.errors[0].message.startsWith('bogus input'));
        done();
      })
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(!('inputHash' in videoData));
        assert(!('output' in videoData));
        assert(!('durationSec' in videoData));
        assert(!('find' in videoData));
        return done();
      });
  });
  it('should transcode real videos', function (done) {
    this.slow(20000);
    this.timeout(30000);

    var src = metalsmithTempDir();
    copyFixture('videos/short.MTS', src, 'in/short.MTS');
    copyFixture('videos/short.yaml', src, 'in/videos.yaml');

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 1);
        return done();
      })
      .use(videos.find())
      .use(videos.transcode({ verbose: true, veryVerbose: true }))
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(Object.keys(files).length == 1);
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.output);
        assert(fs.existsSync(path.join(src, 'src/in/' + videoData.output)));
        assert(videoData.inputHash == '6bcfa870d3fa94798b3f3a2ead8e303f');
        chai.expect(videoData.durationSec).to.be.within(2.05, 2.07);
        assert(!('find' in videoData));
        return done();
      });
  });
  it('should add credits and preroll properly', function (done) {
    this.slow(30000);
    this.timeout(50000);

    var src = metalsmithTempDir();
    copyFixture('videos/short.MTS', src, 'in/short.MTS');
    copyFixture('videos/short.MTS', src, 'credits/credits.MTS');
    copyFixture('videos/preroll.mp4', src, 'preroll/preroll.mp4');
    copyFixture('videos/with_credits.yaml', src, 'in/videos.yaml');

    metalsmith(src)
      .ignore(['**/*.MTS', '**/*.mp4'])
      .use(function (files, metalsmith, done) {
        assert(Object.keys(files).length == 1);
        return done();
      })
      .use(videos.find({
        videoExtensions: ['in/**/*.MTS']
      }))
      .use(videos.transcode({
        credits: 'credits',
        preroll: 'preroll',
        prerollFile: 'preroll.mp4',
      }))
      .use(videos.save())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }
        assert(Object.keys(files).length == 1);
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.output);
        assert(fs.existsSync(path.join(src, 'src/in/' + videoData.output)));
        // fs.copySync(path.join(src, 'src/in/' + videoData.output), '/tmp/out.mp4');
        assert(videoData.inputHash == '6bcfa870d3fa94798b3f3a2ead8e303f');
        chai.expect(videoData.durationSec).to.be.within(11, 12);
        assert(!('find' in videoData));
        assert(!(fs.existsSync(path.join(src, 'src/credits/videos.yaml'))));
        return done();
      });
  });
  it('should upload videos', function (outerDone) {
    if (noCredentials) {
      console.log("SKIP: skipping this test because upload credentials missing");
      return outerDone();
    }

    this.slow(30000);
    this.timeout(50000);

    var src = metalsmithTempDir();
    copyFixture('upload/credentials.json', src, '../youtube/credentials.json');
    try {
      copyFixture('upload/tokens.json', src, '../youtube/tokens.json');
    } catch (err) { };
    copyFixture('videos/test.mp4', src, 'in/cb79677deb19909949665c9151fa446e.mp4');
    copyFixture('videos/to_upload.yaml', src, 'in/videos.yaml');

    async.series([
      function (callback) {
        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(youtube_credentials())
          .use(videos.find())
          .use(videos.transcode())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            return done();
          })
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            _.each(metalsmith.metadata().videos.allVideos, function (videoData) {
              videoData.description = html_to_text.fromString(videoData.description, {
                wordwrap: false,
                ignoreHref: true,
                ignoreImage: true,
                uppercaseHeadings: false
              });
            });
            return done();
          })
          .use(videos.upload({
            verbose: true,
            addCredits: false,
            extraTags: ['internet', 'internet-class.org']
          }))
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().upload.count == 1);
            assert(metalsmith.metadata().upload.errors.length == 0);
            return done();
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            return callback();
          });
      },
      function (callback) {
        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(youtube_credentials())
          .use(videos.find())
          .use(videos.transcode())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            return done();
          })
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().upload.count == 0);
            var videoData = metalsmith.metadata().videos.allVideos[0];
            var youtubeClient = googleapis.youtube({
              version: 'v3',
              auth: metalsmith.metadata().youtube_credentials
            });
            youtubeClient.videos.list({
              part: 'contentDetails, snippet, status',
              id: videoData.youtube
            }, function (err, data) {
              assert(!err);
              assert(data.items.length == 1);
              assert(data.items[0].id == videoData.youtube);
              return done();
            });
          })
          .use(function (files, metalsmith, done) {
            var videoData = metalsmith.metadata().videos.allVideos[0];
            var youtubeClient = googleapis.youtube({
              version: 'v3',
              auth: metalsmith.metadata().youtube_credentials
            });
            youtubeClient.videos.delete({
              id: videoData.youtube
            }, function (err) {
              assert(!err);
              return done();
            });
          })
          .use(function (files, metalsmith, done) {
            var videoData = metalsmith.metadata().videos.allVideos[0];
            var youtubeClient = googleapis.youtube({
              version: 'v3',
              auth: metalsmith.metadata().youtube_credentials
            });
            youtubeClient.videos.list({
              part: 'contentDetails',
              id: videoData.youtube
            }, function (err, data) {
              assert(!err);
              assert(data.items.length == 0);
              return done();
            });
          })
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            return callback();
          });
      }],
      function () {
        return outerDone();
      });
  });
  it('should complete the typical video workflow', function (outerDone) {
    if (noCredentials) {
      console.log("SKIP: skipping this test because upload credentials missing");
      return outerDone();
    }

    var src = metalsmithTempDir();
    copyFixture('upload/credentials.json', src, '../youtube/credentials.json');
    try {
      copyFixture('upload/tokens.json', src, '../youtube/tokens.json');
    } catch (err) { };

    this.slow(50000);
    this.timeout(100000);

    async.series([
      function (callback) {
        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 0);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            assert(metalsmith.metadata().upload.count == 0);
            return done();
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            assert(Object.keys(files).length == 0);
            callback();
          })
      },
      function (callback) {
        copyFixture('videos/short.MTS', src, 'in/short.MTS');
        copyFixture('videos/short.MTS', src, 'credits/credits.MTS');
        var previousFiles = common.walkSync(path.join(src, 'src'));
        assert(previousFiles.length == 2);
        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 0);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            assert(metalsmith.metadata().upload.count == 0);
            return done();
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            assert(Object.keys(files).length == 1);
            assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
            assert(common.walkSync(path.join(src, 'src')).length == 3);
            callback();
          })
      },
      function (callback) {
        var previousFiles = common.walkSync(path.join(src, 'src'));
        assert(previousFiles.length == 3);

        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.transcode === false);
        delete(videoData.transcode);
        fs.writeFileSync(path.join(src, 'src/in/videos.yaml'), yamljs.stringify(videosData, 2, 2));
        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload())
          .use(videos.save())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.errors.length == 1);
            assert(metalsmith.metadata().transcode.errors[0].message.startsWith('video missing transcode'));
            assert(metalsmith.metadata().upload.count == 0);
            return done();
          })
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
            assert(common.walkSync(path.join(src, 'src')).length == 3);
            callback();
          })
      },
      function (callback) {
        var previousFiles = common.walkSync(path.join(src, 'src'));
        assert(previousFiles.length == 3);

        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.transcode === false);
        delete(videoData.transcode);
        videoData.title = 'Test ' + uuid.v4();
        videoData.titleLength = 1
        videoData.authors = [
          { name: "Test Me", credits: "My Credit Info" },
          { name: "Another Test Author", credits: "Long String" }
        ];
        videoData.producers = [
          { name: "Best Producer", credits: "So Great" },
        ];
        videoData.creditsFile = 'credits.MTS';
        videoData.creditsLength = 1;
        fs.writeFileSync(path.join(src, 'src/in/videos.yaml'), yamljs.stringify(videosData, 2, 2));

        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode({ credits: 'credits' }))
          .use(youtube_credentials())
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 1);
            assert(metalsmith.metadata().upload.count == 0);
            assert(metalsmith.metadata().transcode.errors.length == 0);
            return done();
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
            var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
            assert(videosData.length == 1);
            var videoData = videosData[0];
            chai.expect(videoData.durationSec).to.be.within(4.10, 4.15);
            assert(videoData.upload === false);
            assert(common.walkSync(path.join(src, 'src')).length == 4);
            callback();
          })
      },
      function (callback) {
        var previousFiles = common.walkSync(path.join(src, 'src'));
        assert(previousFiles.length == 4);
        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            assert(metalsmith.metadata().upload.count == 0);
            return done();
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            assert(common.walkSync(path.join(src, 'src')).length == 4);
            callback();
          })
      },
      function (callback) {
        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.upload === false);
        delete(videoData.upload);
        fs.writeFileSync(path.join(src, 'src/in/videos.yaml'), yamljs.stringify(videosData, 2, 2));

        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            assert(metalsmith.metadata().upload.count == 1);
            assert(metalsmith.metadata().upload.errors.length == 1);
            return done();
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            callback();
          })
      },
      function (callback) {
        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.upload === false);
        delete(videoData.upload);
        videoData.description = 'Test me.';
        fs.writeFileSync(path.join(src, 'src/in/videos.yaml'), yamljs.stringify(videosData, 2, 2));

        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload({
            verbose: true,
            locationDescription: "Davis Hall, University at Buffalo",
            locationLatitude: 43.0026512146,
            locationLongitude: -78.7873077393,
            extraTags: ['internet', 'internet-class.org']
          }))
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            assert(metalsmith.metadata().upload.count == 1);
            assert(metalsmith.metadata().upload.errors.length == 0);
            return done();
          })
          .use(function (files, metalsmith, done) {
            var videoData = metalsmith.metadata().videos.allVideos[0];
            var youtubeClient = googleapis.youtube({
              version: 'v3',
              auth: metalsmith.metadata().youtube_credentials
            });
            youtubeClient.videos.list({
              part: 'contentDetails, snippet, status',
              id: videoData.youtube
            }, function (err, data) {
              assert(!err);
              assert(data.items.length == 1);
              assert(data.items[0].id == videoData.youtube);
              return done();
            });
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            callback();
          })
      },
      function (callback) {
        assert(fs.existsSync(path.join(src, 'src/in/videos.yaml')));
        var videosData = yamljs.parse(fs.readFileSync(path.join(src, 'src/in/videos.yaml')).toString());
        assert(videosData.length == 1);
        var videoData = videosData[0];
        assert(videoData.upload === false);
        assert(videoData.youtube);

        metalsmith(src)
          .ignore(['**/*.MTS', '**/*.mp4'])
          .use(function (files, metalsmith, done) {
            assert(Object.keys(files).length == 1);
            return done();
          })
          .use(videos.find({ videoExtensions: ['in/**/*.MTS'] }))
          .use(videos.transcode())
          .use(youtube_credentials())
          .use(videos.upload())
          .use(function (files, metalsmith, done) {
            assert(metalsmith.metadata().transcode.count == 0);
            assert(metalsmith.metadata().upload.count == 0);
            return done();
          })
          .use(function (files, metalsmith, done) {
            var videoData = metalsmith.metadata().videos.allVideos[0];
            var youtubeClient = googleapis.youtube({
              version: 'v3',
              auth: metalsmith.metadata().youtube_credentials
            });
            youtubeClient.videos.delete({
              id: videoData.youtube
            }, function (err) {
              assert(!err);
              return done();
            });
          })
          .use(videos.save())
          .build(function (err, files) {
            if (err) {
              return outerDone(err);
            }
            callback();
          })
      }
    ], function () {
      return outerDone();
    });
  });
});

// vim: ts=2:sw=2:et
