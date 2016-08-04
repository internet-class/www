var path = require('path'),
    _ = require('underscore'),
    moment = require('moment-timezone');

function htmlfiles(files) {
  return _.pick(files, function(file, filename) {
    return (path.extname(filename) === '.html');
  });
}

function lessonfiles(files) {
  return _.pick(files, function(file, filename) {
    return file.is_lesson;
  });
}

function format_date(datetime, format, utc) {
  var common_formats = {
    normal: "M/D/YYYY",
    name: "DD MMM YYYY",
    proposal: "M/YYYY",
    blog: "DD MMM YYYY [at] HH:mm [EST]",
    xml: "ddd, DD MMM YYYY HH:mm:ss ZZ",
    file: "YYYY-MM-DD"
  };
  format = common_formats[format] || format;
  if (utc === undefined) {
    utc = true;
  }
  if (utc) {
    return moment.utc(datetime).format(format);
  } else {
    return moment.utc(datetime).tz("America/New_York").format(format);
  }
}

var walkSync = function(dir, filelist) {
  var fs = fs || require('fs'), files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir + '/' + file).isDirectory()) {
      filelist = walkSync(dir + '/' + file, filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

exports.htmlfiles = htmlfiles;
exports.lessonfiles = lessonfiles;
exports.format_date = format_date;
exports.walkSync = walkSync;

// vim: ts=2:sw=2:et
