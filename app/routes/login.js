'use strict';

var app = require('../app'),
     _ = require('underscore'),
    assert = require('assert'),
		express = require('express'),
		passport = require('passport'),
    moment = require('moment'),
    protect = require('../middleware/protect.js');

function returnToRedirect(req, res) {
  if (req.query && req.query.returnTo) {
    res.redirect(req.query.returnTo);
  } else if (res.locals.user && res.locals.user.slug) {
    res.redirect(res.locals.user.slug);
  } else {
    res.redirect("/");
  }
}

var router = express.Router()
  .get('/callback',
    passport.authenticate('auth0', { failureRedirect: '/login' }),
    function(req, res, next) {
      if (!req.user) {
        throw new Error('user null');
      }

      var users = app.get('db').collection('users');
      var update = users.updateOne({ _id: req.user.id, },
        { $set: { lastLogin: moment.utc().toDate() } },
        { upsert: true });

      update.then(function (result) {
        assert(result.matchedCount == 1);

        if (result.upsertedCount == 1) {
          var assignedCourse = req.user._json.user_metadata.assignedCourse;
          assert(assignedCourse);
          var courseInfo = app.get('courses').courses[assignedCourse];
          assert(courseInfo);
          assert(courseInfo.first_lesson);
          var completed = {};
          if (courseInfo.lessons.skip && courseInfo.lessons.skip.length > 0) {
            _.each(courseInfo.lessons.skip, function (skip) {
              completed[skip] = moment.utc().toDate();
            });
          }
          return users.updateOne({ _id: req.user.id, }, {
            $set: {
              courses: {
                current: assignedCourse
              },
              lessons: {
                current: [ courseInfo.first_lesson ],
                completed: completed
              }
            }
          });
        } else {
          return Promise.resolve();
        }
      }).then(function (result) {
        protect.loadUser(res, req.user.id, function () {
          returnToRedirect(req, res);
        });
      }).catch(next);
    }, function (err, req, res) {
      // TODO : Add flash message here.
      if (req.query && req.query.returnTo) {
        res.redirect('/login?returnTo=' + req.query.returnTo);
      } else {
        res.redirect('/login');
      }
    })
  .get('/login', function (req, res) {
    var redirectURL = app.get('config').origin + "/callback";
    if (req.query && req.query.returnTo) {
      redirectURL += "?returnTo=" + req.query.returnTo;
    }
    res.render('login', { redirectURL: redirectURL });
  })
  .get('/logout', function (req, res) {
    req.session.destroy(function (err) {
      var returnTo = "";
      if (res.query && res.query.returnTo) {
        returnTo = res.query.returnTo;
      }
      return res.redirect("https://internet-class.auth0.com/v2/logout?returnTo=" +
          app.get('config').origin + "/" + returnTo +
          "&client_id=" + app.get('auth0ID'));
    });
  });

exports = module.exports = router

// vim: ts=2:sw=2:et
