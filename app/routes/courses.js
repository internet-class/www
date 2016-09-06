'use strict';

var app = require('../app'),
    assert = require('assert'),
		express = require('express'),
    _ = require('underscore'),
    path = require('path'),
		protect = require('../middleware/protect.js');

var courses = app.get('courses').courses;
var lessons = app.get('courses').lessons;

var routeCourse = function (course) {
	var router = express.Router()
		.use(protect.redirect)
		.use(protect.load)
		.get('/', function (req, res) {
			renderIndex(course, req, res, false);
		})
    .get('/review/', function (req, res) {
      renderIndex(course, req, res, true);
    });

	_.each(course.lessons, function (lesson) {
		router.get('/' + lesson.path, function (req, res) {
			renderLesson(course, lesson, req, res);
		});
	});

	return router;
}

var renderIndex = function (course, req, res, review) {
	var user = res.locals.user;
	var lessonIndex = _.map(course.orderedLessons, function (lesson) {
		var listLesson = _.extend({}, lessons[lesson.uuid]);
    var courseLessons = user.lessons[user.courses.current];
    assert(courseLessons);
		if (courseLessons.current.indexOf(lesson.uuid) !== -1) {
			listLesson.active = true;
		} else if (lesson.uuid in user.lessons.completed) {
			listLesson.completed = true;
		}
		listLesson.dolink = listLesson.active || listLesson.completed;
		listLesson.path = path.join(course.slug, lesson.path);
		return listLesson;
	});
  if (!review) {
    lessonIndex = _.filter(lessonIndex, function (lesson) {
      return (!(lesson.completed));
    });
  }
  var context = {
    title: course.title,
		course: course,
		lessons: lessonIndex,
	};
  if (review) {
    context['review'] = 'active';
  } else {
    context['learn'] = 'active';
  }
	res.render('index', context);
}

var renderLesson = function (course, lesson, req, res) {
	var user = res.locals.user;
	lesson = _.extend({}, lesson, lessons[lesson.uuid]);
  var courseLessons = user.lessons[user.courses.current];
  assert(courseLessons);
	if (courseLessons.current.indexOf(lesson.uuid) !== -1) {
		lesson.current = true;
	} else if (lesson.uuid in user.lessons.completed) {
		lesson.completed = true;
	} else {
		// TODO : Add a flash message here.
		return res.redirect(res.locals.user.slug)
	}
	lesson.videos = _.shuffle(lesson.videos);

	var previous, next;
	if (lesson.previous) {
		previous = lessons[lesson.previous.uuid];
		previous.path = lesson.previous.path;
    lesson.previous = previous;
	}
	if (lesson.next) {
		next = lessons[lesson.next.uuid];
		next.path = lesson.next.path;
    lesson.next = next;
	}
	res.render('lesson', {
    title: lesson.title,
		course: course,
		lesson: lesson,
		origin: app.get('config').origin
	});
}

var router = express.Router();
_.each(courses.slug_to_uuid, function (uuid, slug) {
	router.use('/' + slug, routeCourse(courses[uuid]));
});

exports = module.exports = router

// vim: ts=2:sw=2:et
