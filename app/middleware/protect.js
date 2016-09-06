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

var loadUser = function(res, userId, next) {
  var user;
  var users = app.get('db').collection('users');
  var findUser = users.findOne({ _id: userId });
  findUser.then(function(doc) {
    if (!doc) {
      res.redirect('/logout');
      return Promise.resolve();
    }
    user = res.locals.user = doc;
    user.slug = path.join('/courses', app.get('courses').courses[user.courses.current].slug);
    if (user.lessons.current.length == 0 && user.lessons.previous) {
      var nextLesson = app.get('courses').courses[user.courses.current].lessons[user.lessons.previous].next;
      if (nextLesson) {
        user.lessons.current = [ nextLesson.uuid ];
        return users.updateOne({ _id: userId }, {
          $set: { "lessons.current": user.lessons.current }
        });
      }
    }
    return Promise.resolve();
  }).then(function (result) {
    if (result) {
      assert(result.matchedCount == 1);
    }
    return next();
  }).catch(next);
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
