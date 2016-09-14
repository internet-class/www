'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    multimatch = require('multimatch'),
    minimatch = require('minimatch'),
    path = require('path'),
    yamljs = require('yamljs'),
    jsonfile = require('jsonfile'),
    lodash = require('lodash'),
    moment = require('moment'),
    common = require('./common.js');

var defaults = {
  coursePlans: 'courses/**/plan.yaml',
  outputFile: 'courses.json',
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
          return { path: lessons[lessonname].lessonPath, uuid: lessons[lessonname].uuid };
        });

        course.first_lesson = lessons[orderedLessons[0]].uuid;
        var skip = [];

        if (course.deadlines) {
          _.each(course.deadlines, function (deadline) {
            deadline.time = moment(deadline.time, "YYYY-MM-DD HH:mm:ss");
            assert(_.filter(orderedLessons, function (lessonname) {
              return minimatch(lessonname, deadline.start);
            }).length == 1, deadline.start);
          });
          course.deadlines = _.sortBy(course.deadlines, 'time');
        }
        
        var currentDeadlineIndex = -1;
        var lastLesson;

        _.each(orderedLessons, function (lessonname, index) {
          var lesson = lessons[lessonname];
          assert(!(lesson.uuid in course.lessons));
          assert(!(lesson.lessonPath in course.path_to_uuid));
          if (course.picker.skip && multimatch(lessonname, course.picker.skip).length > 0) {
            skip.push(lesson.uuid);
            course.first_lesson = lessons[orderedLessons[index + 1]].uuid;
          }
          var previous, next;
          if (index > 0) {
            previous = course.orderedLessons[index - 1];
          }
          if (index < course.orderedLessons.length - 1) {
            next = course.orderedLessons[index + 1];
          }
          course.lessons[lesson.uuid] = {
            previous: previous,
            next: next,
            path: lesson.lessonPath,
            uuid: lesson.uuid
          };
          if (course.deadlines) {
            if (currentDeadlineIndex + 1 < course.deadlines.length) {
              if (minimatch(lessonname, course.deadlines[currentDeadlineIndex + 1].start)) {
                currentDeadlineIndex += 1;
                lesson.newDeadline = true;
                if (lastLesson && lastLesson.deadline) {
                  lastLesson.lastDeadline = true;
                }
              }
            }
            if (currentDeadlineIndex >= 0) {
              lesson.deadline = course.deadlines[currentDeadlineIndex].time;
            }
          }

          lesson.extension = path.extname(lessonname);
          coursesLessons[lesson.uuid] = lesson;
          lastLesson = lesson;
        });
        if (lastLesson.deadline) {
          lastLesson.lastDeadline = true;
        }
        course.lessons.skip = skip;
        course.path = path.join('/courses', course.slug);
        courses.slug_to_uuid[course.slug] = course.uuid;
        courses[course.uuid] = course;
        delete(files[planname]);
        _.each(files, function (file, filename) {
          if (filename.indexOf(path.dirname(planname)) === 0) {
            file.course = course;
            files[filename.replace(path.dirname(planname), course.path)] = file;
            delete(files[filename]);
          }
        });
      })

    coursesLessons = _.mapObject(coursesLessons, function (file, uuid) {
      var videos = _.filter(file.videos, function (video) {
        return video.youtube
      });
      assert(videos.length > 0, file.videos);
      videos = _.map(videos, function (video) {
        return _.pick(video, 'created', 'youtube', 'durationSec', 'skip', 'authors');
      });
      return _.extend(_.pick(file, 'title', 'author', 'deadline', 'newDeadline', 'lastDeadline'), {
        videos: videos,
        contents: file.contents.toString()
      });
    });
    var videos = {};
    _.each(coursesLessons, function (lesson, uuid) {
      _.each(lesson.videos, function (video) {
        assert(!(video.youtube in videos));
        videos[video.youtube] = uuid;
      })
    });

    _.chain(_.keys(files))
      .filter(function (filename) {
        return files[filename].is_lesson === true;
      })
      .each(function (filename) {
        delete(files[filename]);
      })

    files[config.outputFile] = {
      not_static: true,
      contents: JSON.stringify({
        courses: courses,
        lessons: coursesLessons,
        videos: videos
      }, null, 2)
    };

    return done();
  }
}

exports = module.exports = courses
exports.defaults = defaults

// vim: ts=2:sw=2:et
