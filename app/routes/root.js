'use strict';

var app = require('../app'),
		express = require('express'),
    protect = require('../middleware/protect.js');

var router = express.Router()
  .get('/', protect.load, function (req, res) {
    var redirectURL = app.get('config').origin + "/callback";
    var login = true, slug;
    if (req.user) {
      login = false;
      slug = res.locals.user !== undefined ? res.locals.user.slug : undefined;
    }
    res.render('root', {
      title: 'Learn the Internet on the Internet',
      description: 'Learn about the internet through short, fun videos.',
      login: login,
      slug: slug,
      redirectURL: redirectURL
    });
  });

exports = module.exports = router

// vim: ts=2:sw=2:et
