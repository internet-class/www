var app = require('../app'),
		_ = require('underscore'),
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
