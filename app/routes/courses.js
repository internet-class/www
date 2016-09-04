'use strict';

var express = require('express'),
    _ = require('underscore'),
    path = require('path'),
    jsonfile = require('jsonfile');

var courses = {};
var lessons = {};

var routeCourses = function (coursesFile, lessonsFile) {
	courses = jsonfile.readFileSync(coursesFile);
	lessons = jsonfile.readFileSync(lessonsFile);
	
	var router = express.Router();
	_.each(courses.slug_to_uuid, function (uuid, slug) {
		router.use('/' + slug, routeCourse(courses[uuid]));
	});

	return router;
}

var routeCourse = function (course) {
	var router = express.Router();
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
	var previous, next;
	if (lesson.previous) {
		previous = lessons[lesson.previous.uuid];
		previous.path = lesson.previous.path;
	}
	if (lesson.next) {
		next = lessons[lesson.next.uuid];
		next.path = lesson.next.path;
	}
	console.log(lesson);
	res.render('lesson', {
		course: course,
		lesson: lesson,
		previous: previous,
		next: next
	});
}

exports = module.exports = routeCourses
