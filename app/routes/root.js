'use strict';

var app = require('../app'),
		express = require('express');

var router = express.Router();
router.get('/', function (req, res) {
  var redirectURL = app.get('config').redirectURL;
  res.render('root', {
    title: 'Learn the Internet on the Internet',
    description: 'Learn about the internet through short, fun videos.',
    login: (req.user === undefined),
    redirectURL: redirectURL
  });
});

exports = module.exports = router

// vim: ts=2:sw=2:et
