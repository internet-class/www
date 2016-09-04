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

var defaults = {
  coursePlans: 'courses/**/plan.yaml',
  coursesFile: 'courses.json',
  lessonsFile: 'lessons.json',
  verbose: false
}

var courses = function (config) {
  config = common.processConfig(config, defaults);
  
  return function (files, metalsmith, done) {
    var courses = {
      slug_to_uuid: {},
    }
    var coursesLessons = {};
    _.chain(files)
      .pick(function (file, filename) {
        return multimatch(filename, config.coursePlans).length > 0;
      })
      .each(function (file, planname) {
        var course = yamljs.parse(file.contents.toString());
        assert(!(course.uuid in courses));
        assert(!(course.slug in courses.slug_to_uuid));

        assert(course.picker.path);
        var lessons = _.pick(files, function (file, planname) {
          return file.is_lesson && multimatch(planname, course.picker.path).length > 0;
        });

        course.path_to_uuid = {};
        course.lessons = {};
        var orderedLessons = common.pathsort(_.keys(lessons));
        assert(orderedLessons.length > 0);
        course.orderedLessons = _.map(orderedLessons, function (lessonname) {
          return lessons[lessonname].uuid;
        });

        _.each(orderedLessons, function (lessonname, index) {
          var lesson = lessons[lessonname];
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
          coursesLessons[lesson.uuid] = lesson;
        });
        courses.slug_to_uuid[course.slug] = course.uuid;
        courses[course.uuid] = course;
        delete(files[planname]);
      })

    coursesLessons = _.mapObject(coursesLessons, function (file, filename) {
      var videos = _.filter(file.videos, function (video) {
        return video.youtube
      });
      assert(videos.length > 0);
      videos = _.map(videos, function (video) {
        return _.pick(video, 'created', 'youtube', 'skip', 'authors');
      });
      return _.extend(_.pick(file, 'title'), {
        videos: videos
      });
    });

    files[config.coursesFile] = {
      not_static: true,
      contents: JSON.stringify(courses, null, 2)
    };
    files[config.lessonsFile] = {
      not_static: true,
      contents: JSON.stringify(coursesLessons, null, 2)
    };

    return done();
  }
}

exports = module.exports = courses
exports.defaults = defaults

// vim: ts=2:sw=2:et
