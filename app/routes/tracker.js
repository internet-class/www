'use strict';

var app = require('../app'),
    assert = require('assert'),
		express = require('express'),
    _ = require('underscore'),
    path = require('path'),
    moment = require('moment'),
		protect = require('../middleware/protect.js');

var courses = app.get('courses').courses;
var lessons = app.get('courses').lessons;
var videos = app.get('courses').videos;

var router = express.Router();

router.use(protect.forbidden);
router.use(protect.load);

router.post('/complete',function (req, res) {
  var user = res.locals.user;
  var course = courses[user.courses.current];

  var completedVideo = req.body.youtube;
  assert(completedVideo in videos);
  var completedLesson = videos[completedVideo];
  assert(completedLesson && (completedLesson in course.lessons));
  assert(user.lessons.current.length == 1);
  assert(_.without(user.lessons.current, completedLesson).length == 0);
  var nextLesson = course.lessons[completedLesson].next;
  var currentLessons;
  if (nextLesson) {
    nextLesson = nextLesson.uuid;
    currentLessons = [ nextLesson ];
  } else {
    currentLessons = [];
  }
  var query = {};
  query["lessons.current"] = currentLessons;
  query["lessons.completed." + completedLesson] = moment.utc().toDate();
  var users = app.get('db').collection('users');
  var update = users.updateOne({ _id: req.user.id, }, { $set: query });
  update.then(function (result) {
    assert(result.matchedCount == 1);
    res.status(200).send();
  }).catch(function (reason) {
    console.log(reason);
    res.status(500).send();
  });
});

exports = module.exports = router

// vim: ts=2:sw=2:et
