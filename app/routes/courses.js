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
		videoIndex(course, req, res);
	});
	return router;
}

var videoIndex = function (course, req, res) {
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

exports = module.exports = routeCourses
