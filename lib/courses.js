'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    path = require('path'),
    yamljs = require('yamljs'),
    jsonfile = require('jsonfile'),
    lodash = require('lodash'),
    common = require('./common.js');

var convertDefaults = {
  coursePlans: 'courses/**/plan.yaml',
  planName: 'plan.json',
  verbose: false
}

var doConvert = function(file, filename, files, config, src) {
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
  jsonfile.writeFileSync(path.join(src, path.dirname(filename), config.planName),
      course, { spaces: 2 });
}

var convert = function(config) {
  config = common.processConfig(config, convertDefaults);

	return function (files, metalsmith, done) {
    var courses = _.pick(files, function (file, filename) {
      return multimatch(filename, config.coursePlans).length > 0;
    });
    _.each(courses, function (file, filename) {
      doConvert(file, filename, files, config, metalsmith.source());
    });
    return done();
  }
}

var loadDefaults = {
  courseFiles: 'courses/**/index.*',
  planName: 'plan.json',
  verbose: false
}

var load = function(config) {
  config = common.processConfig(config, loadDefaults);

	return function (files, metalsmith, done) {
    var courses = _.pick(files, function (file, filename) {
      return multimatch(filename, config.courseFiles).length > 0;
    });
    metalsmith.metadata().courses = _.each(courses, function (file, filename) {
      var planName = path.join(path.dirname(filename), config.planName);
      _.extend(file, jsonfile.readFileSync(path.join(metalsmith.source(), planName)));
      delete(files[planName]);
    });
    return done();
  }
}

exports.convert = convert
exports.load = load

// vim: ts=2:sw=2:et
