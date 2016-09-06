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
      return new Error("Can't find user.");
    }
    user = res.locals.user = doc;
    user.slug = path.join('/courses', app.get('courses').courses[user.courses.current].slug);
    var currentLessons = user.lessons[user.courses.current];
    if (currentLessons.current.length == 0 && currentLessons.previous) {
      var nextLesson = app.get('courses').courses[user.courses.current].lessons[currentLessons.previous].next;
      if (nextLesson) {
        user.lessons[user.courses.current].current = [ nextLesson.uuid ];
        var query = {};
        query["lessons." + user.courses.current + ".current"] = [ nextLesson.uuid ];
        return users.updateOne({ _id: userId }, { $set: query });
      }
    }
    return Promise.resolve();
  }).then(function (result) {
    if (result && result.matchedCount == 0) {
      req.session.destroy(function (err) {
        // TODO : Add flash message here.
        return res.redirect("https://internet-class.auth0.com/v2/logout?returnTo=" +
            app.get('config').origin + "/login" + "&client_id=" + app.get('auth0ID'));
        });
    } else {
      return next();
    }
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
