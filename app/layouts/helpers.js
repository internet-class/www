var app = require('../app'),
		_ = require('underscore'),
    moment = require('moment-timezone');
		handlebars = require('handlebars');

handlebars.registerHelper('and_list', function (contextList, options) {
	var list = _.map(contextList, function (context) {
		return options.fn(context);
	});
	if (list.length == 1) {
		list = list[0];
	} else if (list.length == 2) {
		list = list.join(" and ");
	} else {
		comma_list = list.slice(0, -1);
		list = comma_list.join(", ") + ", and " + list.slice(-1)[0];
	}
	return new handlebars.SafeString(list);
});

handlebars.registerHelper('format_date', function format_date(datetime, format, utc) {
  var common_formats = {
    normal: "M/D/YYYY",
    name: "DD MMM YYYY",
    proposal: "M/YYYY",
    blog: "DD MMM YYYY [at] HH:mm [EST]",
    xml: "ddd, DD MMM YYYY HH:mm:ss ZZ",
		file: "YYYY-MM-DD",
		deadline: "dddd, M/D/YYYY @ h:mm A"
  };
  format = common_formats[format] || format;
  if (utc === undefined) {
    utc = true;
  }
  if (utc) {
    return moment.utc(datetime).format(format);
  } else {
    return moment.utc(datetime).tz("America/New_York").format(format);
  }
});

// vim: ts=2:sw=2:et
