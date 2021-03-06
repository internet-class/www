'use strict';

var metalsmith = require('metalsmith'),
    async = require('async'),
    fs = require('fs-extra'),
    jsonfile = require('jsonfile'),
    path = require('path'),
    _ = require('underscore'),
    chai = require('chai'),
    powerAssert = require('power-assert'),
    md5 = require('md5'),
    deepcopy = require('deepcopy'),
    temp = require('temp'),
    common = require('../../lib/common.js'),
    lessons = require('../../lib/lessons.js');

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
  var newHash = md5(fs.readFileSync(path.join(base, 'src', src)));
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

describe('lessons.js', function() {
  it('should do nothing when there is nothing to do', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, '01');
    copyFixture('unmarked/01', src, '02');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);

        done();
      });
  });
  it('should do nothing when a lesson file is in the lessons directory', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01/lesson.adoc', src, 'lesson.adoc');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);

        done();
      });
  });
  it('should do nothing when lessons are not in email subdirectories', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/not_email/01');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        done();
      });
  });
  it('should fail on nested lessons', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01/01');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("should fail"));
        }
        assert(err.message.startsWith("Nested lessons."));

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);

        done();
      });
  });
  it('should fail on new duplicate UUIDs', function (done) {
    var src = metalsmithTempDir();
    copyFixture('marked/01', src, 'lessons/i@i.me/01');
    copyFixture('marked/01', src, 'lessons/i@i.me/02');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("should fail"));
        }
        assert(err.message.startsWith("Duplicate UUIDs."), err.message);

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 2);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        done();
      });
  });
  it('should fail on duplicate UUIDs', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('authors/included.yaml', src, 'lessons/authors.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    var previousLessonHash;
    var lessonHash;

    async.series([
      function(callback) {
        metalsmith(src)
          .use(lessons())
          .build(function (err, files) {
            if (err) {
              return done(err);
            }
            assert.pathExists(path.join(src, 'src', lessons.defaults.lessonIDsFilename));
            lessonHash = sameFile(src, lessons.defaults.lessonIDsFilename);

            assert(fileSearch(files, '.uuid.json') == 0);
            assert(fileSearch(files, 'lessons/.lessons.json') == 0);

            var afterFiles = common.walkSync(path.join(src, 'src'));
            assert(fileSearch(afterFiles, '.uuid.json') == 1);
            assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 1);

            assert(files['lessons/i@i.me/01/lesson.adoc'].is_lesson);
            assert(files['lessons/i@i.me/01/lesson.adoc'].owner = 'i@i.me');

            assert(afterFiles.length + 1, previousFiles.length);

            callback();
          });
      },
      function(callback) {
        fs.copySync(path.join(src, 'src/lessons/i@i.me/01'),
          path.join(src, 'src/lessons/i@i.me/02'));
        var previousFiles = common.walkSync(path.join(src, 'src'));

        metalsmith(src)
          .use(lessons())
          .build(function (err, files) {
            if (!err) {
              return done(new Error("should fail"));
            }
            assert(err.message.startsWith("Duplicate UUIDs."));

            assert(fileSearch(files, '.uuid.json') == 0);
            assert(fileSearch(files, 'lessons/.lessons.json') == 0);

            var afterFiles = common.walkSync(path.join(src, 'src'));
            assert(fileSearch(afterFiles, '.uuid.json') == 2);
            assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 1);

            powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
            assert(sameFile(src, lessons.defaults.lessonIDsFilename, lessonHash));
            callback();
          });
      }],
      function () {
        done();
      });
  });
  it('should fail on missing contributors', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('authors/missing.yaml', src, 'lessons/authors.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("should fail"));
        }
        assert(err.message.startsWith("Missing author."));

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        done();
      });
  });
  it('should fail on malformed contributors', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('authors/missingemail.yaml', src, 'lessons/authors.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("should fail"));
        }
        assert(err.message.startsWith("Missing author email."));

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        done();
      });
  });
  it('should fail on duplicate contributors', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('authors/duplicate.yaml', src, 'lessons/authors.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (!err) {
          return done(new Error("should fail"));
        }
        assert(err.message.startsWith("Duplicate author email."));

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 0);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 0);

        powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
        done();
      });
  });
  it('should work properly with existing lessons', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('authors/included.yaml', src, 'lessons/authors.yaml');

    var previousFiles = common.walkSync(path.join(src, 'src'));

    metalsmith(src)
      .use(lessons())
      .build(function (err, files) {
        if (err) {
          return done(err);
        }

        assert(fileSearch(files, '.uuid.json') == 0);
        assert(fileSearch(files, 'lessons/.lessons.json') == 0);

        var afterFiles = common.walkSync(path.join(src, 'src'));
        assert(fileSearch(afterFiles, '.uuid.json') == 1);
        assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 1);

        assert(files['lessons/i@i.me/01/lesson.adoc'].is_lesson);
        assert(files['lessons/i@i.me/01/lesson.adoc'].owner = 'i@i.me');

        assert(afterFiles.length + 2, previousFiles.length);
        
        var lessonHash = lessons.loadLessons(jsonfile.readFileSync(path.join(src, 'src', lessons.defaults.lessonIDsFilename)));
        assert((files['lessons/i@i.me/01/lesson.adoc'].uuid in lessonHash));
        assert(lessonHash[files['lessons/i@i.me/01/lesson.adoc'].uuid] == 'lessons/i@i.me/01/lesson.adoc');

        done();
      });
  });
  it('should work properly with adding lessons', function (done) {
    var src = metalsmithTempDir();
    copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
    copyFixture('authors/included.yaml', src, 'lessons/authors.yaml');
    var previousFiles = common.walkSync(path.join(src, 'src'));

    var previousLessonHash;
    var lessonHash;

    async.series([
      function(callback) {
        metalsmith(src)
          .use(lessons())
          .build(function (err, files) {
            if (err) {
              return done(err);
            }
            assert.pathExists(path.join(src, 'src', lessons.defaults.lessonIDsFilename));
            lessonHash = sameFile(src, lessons.defaults.lessonIDsFilename);

            assert(fileSearch(files, '.uuid.json') == 0);
            assert(fileSearch(files, 'lessons/.lessons.json') == 0);

            var afterFiles = common.walkSync(path.join(src, 'src'));
            assert(fileSearch(afterFiles, '.uuid.json') == 1);
            assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 1);

            assert(files['lessons/i@i.me/01/lesson.adoc'].is_lesson);
            assert(files['lessons/i@i.me/01/lesson.adoc'].author.email == 'i@i.me');

            assert(afterFiles.length + 1, previousFiles.length);
            
            var newHash = lessons.loadLessons(jsonfile.readFileSync(path.join(src, 'src', lessons.defaults.lessonIDsFilename)));
            assert((files['lessons/i@i.me/01/lesson.adoc'].uuid in newHash));
            assert(newHash[files['lessons/i@i.me/01/lesson.adoc'].uuid] == 'lessons/i@i.me/01/lesson.adoc');

            callback();
          });
      },
      function(callback) {
        copyFixture('unmarked/02', src, 'lessons/challen@buffalo.edu/02');
        var previousFiles = common.walkSync(path.join(src, 'src'));

        metalsmith(src)
          .use(lessons())
          .build(function (err, files) {
            if (err) {
              return done(err);
            }
            assert.pathExists(path.join(src, 'src', lessons.defaults.lessonIDsFilename));

            assert(fileSearch(files, '.uuid.json') == 0);
            assert(fileSearch(files, 'lessons/.lessons.json') == 0);

            var afterFiles = common.walkSync(path.join(src, 'src'));
            assert(fileSearch(afterFiles, '.uuid.json') == 2);
            assert(fileSearch(afterFiles, 'lessons/.lessons.json') == 1);

            assert(files['lessons/i@i.me/01/lesson.adoc'].is_lesson);
            assert(files['lessons/i@i.me/01/lesson.adoc'].author.email == 'i@i.me');
            assert(files['lessons/challen@buffalo.edu/02/lesson.adoc'].is_lesson);
            assert(files['lessons/challen@buffalo.edu/02/lesson.adoc'].author.email == 'challen@buffalo.edu');

            assert(afterFiles.length + 1, previousFiles.length);
            assert(!(sameFile(src, lessons.defaults.lessonIDsFilename, lessonHash)));

            var newHash = lessons.loadLessons(jsonfile.readFileSync(path.join(src, 'src', lessons.defaults.lessonIDsFilename)));

            assert((files['lessons/i@i.me/01/lesson.adoc'].uuid in newHash));
            assert(newHash[files['lessons/i@i.me/01/lesson.adoc'].uuid] == 'lessons/i@i.me/01/lesson.adoc');
            assert((files['lessons/challen@buffalo.edu/02/lesson.adoc'].uuid in newHash));
            assert(newHash[files['lessons/challen@buffalo.edu/02/lesson.adoc'].uuid] == 'lessons/challen@buffalo.edu/02/lesson.adoc');

            callback();
          });
      }],
      function () {
        done();
      });
  });
});

// vim: ts=2:sw=2:et
