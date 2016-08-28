var async = require('async'),
		common = require('./common.js'),
    cheerio = require('cheerio');

module.exports = function(config) {
	return function(files, metalsmith, done) {
		async.forEachOf(common.htmlfiles(files), function(file, filename, finished) {
			if (file.flowtext) {
				$ = cheerio.load(file.contents);
				$("p").each(function() {
					$(this).addClass('flow-text');
				});
				file.contents = new Buffer($.html());
			}
			finished();
		});
		done();
	}
}

// vim: ts=2:sw=2:et
