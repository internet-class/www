var path = require('path'),
    _ = require('underscore'),
    child_process = require('child_process'),
    moment = require('moment-timezone');

function md5sum(filename) {
  if (/^darwin/.test(process.platform)) {
    var command = 'md5 -r ';
  } else {
    var command = 'md5sum ';
  }
  if (!(Array.isArray(filename))) {
    return child_process.execSync(command + filename).toString().split(' ')[0].trim();
  } else {
    return child_process.execSync('cat ' + filename.join(' ') + ' | ' + command).toString().split(' ')[0].trim();
  }
}

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

var andList = function(list) {
  if (!(Array.isArray(list))) {
    return list;
  }
  if (list.length == 1) {
    return list[0];
  } else if (list.length == 2) {
    return list[0] + ' and ' + list[1];
  } else {
    return list.slice(0, -1).join(', ') + ', and ' + list.slice(-1)[0];
  }
}


exports.htmlfiles = htmlfiles;
exports.lessonfiles = lessonfiles;
exports.format_date = format_date;
exports.walkSync = walkSync;
exports.md5sum = md5sum;
exports.andList = andList;

// vim: ts=2:sw=2:et
