var metalsmith = require('metalsmith'),
    async = require('async'),
		fs = require('fs-extra'),
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
	newHash = md5(fs.readFileSync(path.join(base, 'src', src)));
	if (prevHash !== undefined) {
		assert(newHash == prevHash, path.join(base, 'src', src) + ' has changed')
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
				assert(err.message.startsWith("Duplicate UUIDs."));
				
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
		async.series([
			function(callback) {
				metalsmith(src)
					.use(lessons())
					.build(function (err, files) {
						if (err) {
							return done(err);
						}
						assert.pathExists(path.join(src, 'src', lessons.lessonIDsFilename));
						lessonHash = sameFile(src, lessons.lessonIDsFilename);

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
						sameFile(src, lessons.lessonIDsFilename, lessonHash);
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

				done();
			});
	});
});
