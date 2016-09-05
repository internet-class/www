var app = require('../app'),
		path = require('path'),
    assert = require('assert');

var redirect = function(req, res, next) {
	if (!req.isAuthenticated()) {
		return res.redirect('/login?returnTo=' + req.originalUrl);
	} else {
    return next();
  }
}

var forbidden = function(req, res, next) {
	if (!req.isAuthenticated()) {
		return res.status(401).send();
	} else {
    return next();
  }
}

var loadUser = function(res, userId, callback) {
  app.get('db').collection('users').findOne({
    _id: userId
  }, function (err, doc) {
    assert(!err);
    assert(doc);
    res.locals.user = doc;
    res.locals.user.slug = path.join('/courses',
        app.get('courses').courses[doc.courses.current].slug);
    return callback();
  });
}

var load = function(req, res, next) {
	if (req.isAuthenticated()) {
    loadUser(res, req.user.id, next);
	} else {
		return next();
	}
}

module.exports.redirect = redirect
module.exports.forbidden = forbidden
module.exports.loadUser = loadUser
module.exports.load = load

// vim: ts=2:sw=2:et
