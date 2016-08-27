'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    minimatch = require('minimatch'),
    path = require('path'),
    common = require('./common.js'),
    fs = require('fs'),
    jsonfile = require('jsonfile'),
    uuid = require('node-uuid'),
    yamljs = require('yamljs');

const lessonOwnerPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

var defaults = {
  verbose: false,
  lessonIDsFilename: 'lessons/.lessons.json',
  lessonsPattern: 'lessons/**/lesson.*'
}

function processConfig(config) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

function lessons(config) {

  return function(files, metalsmith, done) {

    config = processConfig(config);

    var previousLessonIDsFile = path.join(metalsmith.source(), config.lessonIDsFilename);
    var byDirectory = {};

    var lessonDirectories = [];
    _.each(files, function (file, filename) {
      if (minimatch(filename, config.lessonsPattern)) {
        var authorEmail = filename.split(path.sep)[1];
        file.is_lesson = lessonOwnerPattern.test(authorEmail);
        if (file.is_lesson) {
          file.author = authorEmail;
          file.lessonPath = filename.split(path.sep).slice(2, -1).join(path.sep);
          lessonDirectories.push(path.dirname(filename));
          byDirectory[path.dirname(filename)] = file;
        }
      }
    });

    if (lessonDirectories.length == 0) {
      delete(files[config.lessonIDsFilename]);
      done();
      return;
    }
    
    var previousLessonIDs = {}; 
    if (config.lessonIDsFilename in files) {
      previousLessonIDs = loadLessons(JSON.parse(files[config.lessonIDsFilename].contents));
      delete(files[config.lessonIDsFilename]);
    } 

    var currentLessonIDs = {};
    try {
      _.each(files, function (file, filename) {
        // This seems to happen sometimes in testing. No clue why.
        if (!(file)) {
          return;
        }
        var containingLessons = _.filter(lessonDirectories, function (prefix) {
          return path.dirname(filename).startsWith(prefix);
        });
        if (containingLessons.length > 1 && file.is_lesson) {
          throw new Error("Nested lessons. " + filename + " is in two lesson subdirectories: " + containingLessons);
        } else if (containingLessons.length == 1) {
          if (file.lesson) {
            throw new Error(filename + " already contains a lesson attribute. It should not.");
          }
          if (!(file.is_lesson)) {
            file.lesson = byDirectory[containingLessons[0]];
          } else {
            try {
              file.uuid = JSON.parse(files[path.join(path.dirname(filename), '.uuid.json')].contents).uuid;
              (currentLessonIDs[file.uuid] = currentLessonIDs[file.uuid] || []).push(filename);
              delete(files[path.join(path.dirname(filename), '.uuid.json')]);
            } catch (err) {};
          }
        }
      });
    } catch (err) {
      done(err);
      return;
    }

    try {
      _.each(currentLessonIDs, function (filenames, uuid) {
        if (filenames.length > 1) {
          var errorText = "Duplicate UUIDs. ";
          if (uuid in previousLessonIDs) {
            var previousFilename = previousLessonIDs[uuid];
            if (previousFilename in filenames) {
              errorText += "I've seen this UUID before as " + previousFilename + " Was it copied? ";
              errorText += "If so, please remove .uuid.json from ";
              errorText += _.difference(filenames, [previousFilename]).join(',');
            } else {
              errorText += "I've seen this UUID before as " + previousFilename + " before. Was it moved? ";
              errorText += "The duplicates are in " + filenames.join(',');
            }
          } else {
            errorText += "These are all new. I don't know what to do. ";
            errorText += "The problems are in " + filenames.join(',');
          }
          throw new Error(errorText);
        } else {
          currentLessonIDs[uuid] = filenames[0];
        }
      });
    } catch (err) {
      done(err);
      return;
    }

    var authors = yamljs.load(path.join(metalsmith.source(), 'lessons/authors.yaml'));
    var authorMap = {};
    try {
      _.each(authors, function (author) {
        if (!('email' in author)) {
          throw new Error("Missing author email. All authors must have email addresses in authors.yaml matching their author directory.");
        }
        if (!('name' in author)) {
          throw new Error("Missing author name.");
        }
        if (author.email in authorMap) {
          throw new Error("Duplicate author email. " + author.email + " is duplicated.");
        }
        authorMap[author.email] = author;
      });
      _.each(common.lessonfiles(files), function (file, filename) {
        if (!(file.author in authorMap)) {
          throw new Error("Missing author. No information for " + file.author);
        }
        file.author = authorMap[file.author];
        return;
      });
    } catch (err) {
      done(err);
      return;
    }

    var newLessons = _.pick(common.lessonfiles(files), function (file, filename) {
      return (!('uuid' in file));
    });
    _.each(newLessons, function (file, filename) {
      file.uuid = uuid.v4();
      jsonfile.writeFileSync(path.join(metalsmith.source(), path.dirname(filename), '.uuid.json'), {
        'uuid': file.uuid,
        'note': "This file is autogenerated. " +
        "It uniquely identifies this lesson. " +
        "Do not change or delete it. " +
        "If you move this lesson, move this file along with it. " +
        "Please see src/content/README.adoc for more details."
      });
      currentLessonIDs[file.uuid] = filename;
      file.is_lesson = true;
    });

    if (_.size(newLessons) > 0) {
      if (config.verbose) {
        console.log("Identified and uniquely labeled " + newLessons.length + " new lesson(s).");
        console.log("New .uuid.json files have been created. " +
            "They should be kept with their lesson.adoc file.");
        console.log("Please see src/content/README.adoc for more details.");
      }
    }
    
    saveLessons(currentLessonIDs, path.join(metalsmith.source(), config.lessonIDsFilename));    
    metalsmith.metadata().lessons = _.filter(files, function (file) { return file.is_lesson });
    return done();
  }
};

var saveLessons = function (currentLessonIDs, path) {
  var lessonsAsList = _.sortBy(_.map(currentLessonIDs, function (lessonFile, lessonID) {
    return { id: lessonID, file: lessonFile };
  }), 'id');
  jsonfile.writeFileSync(path, lessonsAsList, {spaces: 2});
}

var loadLessons = function (lessonList) {
  var previousLessonIDs = {};
  _.each(lessonList, function (lesson) {
    assert(!(lesson.id in previousLessonIDs));
    previousLessonIDs[lesson.id] = lesson.file;
  });
  return previousLessonIDs;
}

exports = module.exports = lessons
exports.defaults = defaults
exports.processConfig = processConfig
exports.saveLessons = saveLessons
exports.loadLessons = loadLessons

// vim: ts=2:sw=2:et
