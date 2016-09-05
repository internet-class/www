'use strict';

var app = require('../app'),
		express = require('express'),
		passport = require('passport');

var router = express.Router();
router.get('/callback',
  passport.authenticate('auth0', { failureRedirect: '/url-if-something-fails' }),
  function(req, res) {
    if (!req.user) {
      throw new Error('user null');
    }
    if (req.query && req.query.returnTo) {
      res.redirect(req.query.returnTo);
    } else {
      res.redirect('/');
    }
  });

router.get('/login', function (req, res) {
  var redirectURL = app.get('config').redirectURL + "/callback";
  if (req.query && req.query.returnTo) {
    redirectURL += "?returnTo=" + req.query.returnTo;
  }
  res.render('login', {
    redirectURL: redirectURL
  })
});

router.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    var returnTo = "";
    if (res.query && res.query.returnTo) {
      returnTo = res.query.returnTo;
    }
    return res.redirect("https://internet-class.auth0.com/v2/logout?returnTo=" +
        app.get('config').redirectURL + "/" + returnTo +
        "&client_id=" + app.get('auth0ID'));
  });
});

exports = module.exports = router

// vim: ts=2:sw=2:et
