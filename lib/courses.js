'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    path = require('path'),
    yamljs = require('yamljs'),
    jsonfile = require('jsonfile'),
    lodash = require('lodash'),
    common = require('./common.js');

var loadDefaults = {
  courseFiles: 'courses/**/syllabus.*',
  planName: 'plan.json',
  verbose: false
}

var load = function(config) {
  config = common.processConfig(config, loadDefaults);

	return function (files, metalsmith, done) {
    var courses = _.pick(files, function (file, filename) {
      return multimatch(filename, config.courseFiles).length > 0;
    });
    _.each(courses, function (file, filename) {
      var planName = path.join(path.dirname(filename), config.planName);
      _.extend(file, jsonfile.readFileSync(path.join(metalsmith.source(), planName)));
      delete(files[planName]);
    });
    var lessonsByUUID = metalsmith.metadata().lessonsByUUID;
    _.each(courses, function (file, filename) {
      _.each(common.walkSync(path.join(metalsmith.source(), path.dirname(filename))),
          function (courseFile) {
            var relativeFile = path.relative(metalsmith.source(), courseFile);
            if (relativeFile in files) {
              files[relativeFile].course = path.join('/courses', file.slug) + '/';
              if (file.slug) {
                var newFilename = relativeFile.replace(path.dirname(filename),
                    path.join('courses', file.slug));
                files[newFilename] = files[relativeFile];
                delete(files[relativeFile]);
              }
            }
          });
      file.lessons = _.map(file.lessons, function (lesson) {
        var lessonFile = lessonsByUUID[lesson.uuid];
        var lessonName = path.basename(lessonFile.originalFilename);
        var newPath = path.join('courses', file.slug, lesson.path,
          "index" + path.extname(lessonFile.originalFilename));
        files[newPath] = lodash.cloneDeep(lessonFile, function (value) {
            if (value instanceof Buffer) {
              return new Buffer(value);
            }
          });
        return files[newPath];
      });
      _.each(file.lessons, function (lesson, i) {
        assert(lesson.videos.length > 0);
        lesson.firstVideo = lesson.videos[0];
        lesson.layout = 'course/video.hbt';
        if (i > 0) {
          lesson.previous = file.lessons[i - 1];
        }
        if (i < (file.lessons.length - 1)) {
          lesson.next = file.lessons[i + 1];
        }
        lesson.course = file;
      });
    });
    metalsmith.metadata().courses = courses;
    return done();
  }
}

var coursesDefaults = {
  coursePlans: 'courses/**/plan.yaml',
  coursesFile: 'courses.json',
  verbose: false
}

var doCourses = function (config) {
  config = common.processConfig(config, coursesDefaults);
  
  return function (files, metalsmith, done) {
    var courses = {
      slug_to_uuid: {},
      lessons: []
    }
    _.chain(files)
      .pick(function (file, filename) {
        return multimatch(filename, config.coursePlans).length > 0;
      })
      .each(function (file, filename) {
        var course = yamljs.parse(file.contents.toString());
        assert(!(course.uuid in courses));
        assert(!(course.slug in courses.slug_to_uuid));

        assert(course.picker.path);
        var lessons = _.pick(files, function (file, filename) {
          return file.is_lesson && multimatch(filename, course.picker.path).length > 0;
        });

        course.path_to_uuid = {};
        course.lessons = {};
        var orderedLessons = common.pathsort(_.keys(lessons));
        assert(orderedLessons.length > 0);
        course.orderedLessons = _.map(orderedLessons, function (filename) {
          return lessons[filename].uuid;
        });

        _.each(orderedLessons, function (filename, index) {
          var lesson = lessons[filename];
          assert(!(lesson.uuid in course.lessons));
          assert(!(lesson.lessonPath in course.path_to_uuid));
          var previous, next;
          if (index > 0) {
            previous = course.orderedLessons[index - 1];
          } 
          if (index < course.orderedLessons.length - 1) {
            next = course.orderedLessons[index + 1];
          }
          course.lessons[lesson.uuid] = { previous: previous, next: next };
          course.path_to_uuid[lesson.lessonPath] = lesson.uuid;
          courses.lessons.push(lesson.uuid);
        });
        courses.slug_to_uuid[course.slug] = course.uuid;
        courses[course.uuid] = course;
        delete(files[filename]);
      })

    courses.lessons = _.uniq(courses.lessons);
    files[config.coursesFile] = {
      not_static: true,
      contents: JSON.stringify(courses, null, 2)
    };

    return done();
  }
}

exports.convert = convert
exports.load = load
exports.doCourses = doCourses

// vim: ts=2:sw=2:et
