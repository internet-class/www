var app = require('../app'),
    assert = require('assert');

var redirect = function(req, res, next) {
	if (!req.isAuthenticated()) {
		return res.redirect('/login?returnTo=' + req.originalUrl);
	}
	next();
}

var load = function(req, res, next) {
	if (req.isAuthenticated()) {
		app.get('db').collection('users').findOne({
			_id: req.user.id
		}, function (err, doc) {
			assert(!err);
			assert(doc);
			res.locals.user = doc;
			next();
		});
	} else {
		next();
	}
}

module.exports.redirect = redirect
module.exports.load = load
