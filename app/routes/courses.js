'use strict';

var app = require('../app'),
		express = require('express'),
    _ = require('underscore'),
    path = require('path'),
		protect = require('../middleware/protect.js'),
    jsonfile = require('jsonfile');

var routeCourse = function (course) {
	var router = express.Router();
	router.use(protect.redirect),
	router.use(protect.load),
	router.get('/', function (req, res) {
		renderIndex(course, req, res);
	});
	_.each(course.lessons, function (lesson) {
		router.get('/' + lesson.path, function (req, res) {
			renderLesson(course, lesson, req, res);
		});
	});

	return router;
}

var renderIndex = function (course, req, res) {
	var lessonIndex = _.map(course.orderedLessons, function (lesson) {
		var listLesson = lessons[lesson.uuid];
		if (res.locals.user.lessons.current.indexOf(lesson.uuid) !== -1) {
			listLesson.active = true;
		}
		listLesson.firstVideo = listLesson.videos[0];
		listLesson.path = path.join(course.slug, lesson.path);
		return listLesson;
	});
	res.render('index', {
		course: course,
		lessons: lessonIndex
	});
}

var renderLesson = function (course, lesson, req, res) {
	lesson = _.extend(lesson, lessons[lesson.uuid]);
	var lessonStatus;
	if (res.locals.user.lessons.current.indexOf(lesson.uuid) !== -1) {
		lesson.current = true;
	} else if (res.locals.user.lessons.completed.indexOf(lesson.uuid) !== -1) {
		lesson.completed = true;
	} else {
		return res.redirect(res.locals.user.slug)
	}

	var previous, next;
	if (lesson.previous) {
		previous = lessons[lesson.previous.uuid];
		previous.path = lesson.previous.path;
	}
	if (lesson.next) {
		next = lessons[lesson.next.uuid];
		next.path = lesson.next.path;
	}
	res.render('lesson', {
		course: course,
		lesson: lesson,
		previous: previous,
		next: next
	});
}

var courses = app.get('courses').courses;
var lessons = app.get('courses').lessons;

var router = express.Router();
_.each(courses.slug_to_uuid, function (uuid, slug) {
	router.use('/' + slug, routeCourse(courses[uuid]));
});

exports = module.exports = router
