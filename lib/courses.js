'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    yamljs = require('yamljs'),
    common = require('./common.js');

var convertDefaults = {
  coursePlans: 'courses/**/plan.yaml',
  verbose: false
}

var doConvert = function(file, filename, files) {
  var course = yamljs.parse(file.contents.toString());
  assert(course.lessons.path);
  var lessons = _.pick(files, function (file, filename) {
    return file.is_lesson && multimatch(filename, course.lessons.path);
  });
  var uuidCheck = {};
  var pathCheck = {};
  course.lessonList = [];
  _.each(common.pathsort(_.keys(lessons)), function (filename) {
    var lesson = lessons[filename];
    assert (!(lesson.uuid in uuidCheck));
    assert (!(lesson.lessonPath in pathCheck));
    uuidCheck[lesson.uuid] = true;
    pathCheck[lesson.lessonPath] = true;
    course.lessonList.push({
      uuid: lesson.uuid,
      path: lesson.lessonPath
    });
  });
  console.log(course.lessonList);
}

var convert = function(config) {
  config = common.processConfig(config, convertDefaults);

	return function (files, metalsmith, done) {
    var courses = _.pick(files, function (file, filename) {
      return (multimatch(filename, config.coursePlans).length > 0);
    });
    _.each(courses, function (file, filename) {
      doConvert(file, filename, files);
    });
    return done();
  }
}

exports.convert = convert

// vim: ts=2:sw=2:et
