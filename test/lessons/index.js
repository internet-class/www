var metalsmith = require('metalsmith'),
    async = require('async'),
		fs = require('fs-extra'),
    path = require('path'),
    _ = require('underscore'),
    chai = require('chai'),
    powerAssert = require('power-assert'),
    md5 = require('md5'),
		deepcopy = require('deepcopy'),
		common = require('../../lib/common.js'),
		lessons = require('../../lib/lessons.js');

chai.use(require('chai-fs'));
var assert = chai.assert;

describe('lessons.js', function() {
	it('should do nothing when there is nothing to do', function (done) {
		var src = path.join(__dirname, 'fixtures/empty');
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
		var src = path.join(__dirname, 'fixtures/nested');
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
		var src = path.join(__dirname, 'fixtures/newduplicate');
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
		var src = path.join(__dirname, 'fixtures/duplicate');
		
		fs.removeSync(path.join(src, 'src/lessons/challen@buffalo.edu/02_why_internet'))
		
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
						previousLessonHash = md5(fs.readFileSync(path.join(src, 'src', lessons.lessonIDsFilename)));
						callback();
					});
			},
			function(callback) {
				var previousFiles = common.walkSync(path.join(src, 'src'));
				fs.copySync(path.join(src, 'src/lessons/challen@buffalo.edu/01_why_internet'),
					path.join(src, 'src/lessons/challen@buffalo.edu/02_why_internet'));

				metalsmith(src)
					.use(lessons())
					.build(function (err, files) {
						if (!err) {
							return done(new Error("should fail"));
						}
						assert(err.message.startsWith("Duplicate UUIDs."));
						fs.removeSync(path.join(src, 'src/lessons/challen@buffalo.edu/02_why_internet'))
						powerAssert.deepEqual(common.walkSync(path.join(src, 'src')), previousFiles);
						assert(md5(fs.readFileSync(path.join(src, 'src', lessons.lessonIDsFilename))) == previousLessonHash);
						callback();
					});
			}],
			function () {
				done();
			});
	});
});
