var metalsmith = require('metalsmith'),
    path = require('path'),
    _ = require('underscore'),
    chai = require('chai'),
    powerAssert = require('power-assert'),
		lessons = require('../../lib/lessons.js');

chai.use(require('chai-fs'));
var assert = chai.assert;

describe('lessons.js', function() {
	it('should do nothing when there is nothing to do', function (done) {
		var src = path.join(__dirname, 'fixtures/empty');
		
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

				done();
			});
	});
	it('should fail on nested lessons', function (done) {
		var src = path.join(__dirname, 'fixtures/nested');
		
		metalsmith(src)
			.use(lessons())
			.build(function (err, files) {
				if (!err) {
					return done(new Error("should fail"));
				}
				done();
			});
	});
});
