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

				assert(_.filter(files, function (file, filename) {
					return (path.basename(filename) == '.uuid.json');
				}).length == 0);
				assert(!('lessons/.lessons.json' in files));
				powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);

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
				powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
				done();
			});
	});
	it('should fail on duplicate UUIDs', function (done) {
		var src = metalsmithTempDir();
		copyFixture('unmarked/01', src, 'lessons/i@i.me/01');
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
						powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
						sameFile(src, lessons.lessonIDsFilename, lessonHash);
						callback();
					});
			}],
			function () {
				done();
			});
	});
});
