var async = require('async'),
    cheerio = require('cheerio'),
    common = require('./common.js');

function doSections(file) {
	if (!file.doSections) {
		return;
	}
  var $ = cheerio.load(file.contents);
	file.sections = [];
	
	$('h2').each(function (i, elem) {
		var children = [];
		$(elem).parent().find('h3').each(function (i, child) {
			children.push({ text: $(child).text(), id: $(child).attr('id') });
		});
		file.sections.push({ text: $(elem).text(), id: $(elem).attr('id'), children: children });
	});
	$('h2, h3').each(function (i, elem) {
		var id = $(elem).attr('id');
		if (!id) {
			return;
		}
		$(id).addClass('test');
		var section = $(elem).closest('.sect1, .sect2');
		$(section).attr('id', id);
		$(section).addClass('section');
		$(section).addClass('scrollspy');
		$(elem).removeAttr('id');
	});
  file.contents = new Buffer($.html());
	return;
};

exports = module.exports = function(config) {
  return function(files, metalsmith, done) {
    async.forEachOf(common.htmlfiles(files), function(file, filename, finished) {
      doSections(file);
      finished();
    }, function () {
      done();
    });
  }
};
exports.doSections = doSections
