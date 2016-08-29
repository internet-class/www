var async = require('async'),
		common = require('./common.js'),
    cheerio = require('cheerio');

module.exports = function(config) {
	return function(files, metalsmith, done) {
		async.forEachOf(common.htmlfiles(files), function(file, filename, finished) {
			if (file.flowtext) {
				$ = cheerio.load(file.contents);
				$("h1, h2, p, ol, ul").each(function() {
          if ($(this).parents('.no-flow-text').length == 0) {
            $(this).addClass('flow-text');
          }
				});
				file.contents = new Buffer($.html());
			}
			finished();
		});
		done();
	}
}

// vim: ts=2:sw=2:et
