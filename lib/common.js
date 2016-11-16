var path = require('path'),
    assert = require('assert'),
    _ = require('underscore'),
    child_process = require('child_process'),
    handlebars = require('handlebars'),
    moment = require('moment-timezone'),
    natural_sort = require('javascript-natural-sort');

var ffmpegTemplate = handlebars.compile(
  'ffmpeg {{{ inputs }}} -filter_complex "{{{ filters }}}" ' +
  '-map "[v]" -map "[a]" ' +
  '-c:v libx264 -s hd1080 -crf 18 -movflags +faststart -deinterlace ' +
  '-c:a aac -ac 1 -b:a 128k -y {{{ output }}}'
);

function transcodeCommand(options) {
  assert(options.content.length > 0);

  var inputs = [];
  var resizeContent = _.map(options.content, function (file, index) {
    inputs.push(file);
    return "[" + index + ":v:0] scale=1920:1080,setsar=1:1 [c" + index + "]";
  }).join("; ");
  var filters = resizeContent + "; " + _.map(options.content, function (file, index) {
    return "[c" + index + "] [" + index + ":a:0]";
  }).join(" ") + " concat=n=" + options.content.length + ":v=1:a=1 [vcontent] [acontent]; ";
  var contentName = "vcontent";
  if (options.title) {
    filters += "[vcontent] [" + inputs.length + ":v:0] overlay=x=20:y=main_h-overlay_h-20," +
      "drawtext=fontfile=" + options.font + ":text='" + options.banner + "':fontcolor=white:" +
      "fontsize=40:x=w-tw-20:y=20 [vtitle]; ";
    contentName = "vtitle";
    inputs.push(options.title);
  }
  var totalConcat = "[" + contentName + "] [acontent]";
  var totalLength = 1;
  if (options.preroll) {
    filters += "[" + inputs.length + ":v:0] scale=1920:1080,setsar=1:1 [pv]; ";
    totalConcat = "[pv] [" + inputs.length + ":a:0] " + totalConcat;
    inputs.push(options.preroll);
    totalLength += 1;
  } 
  if (options.postroll) {
    filters += "[" + inputs.length + ":v:0] scale=1920:1080,setsar=1:1 [av]; ";
    totalConcat = totalConcat + "[av] [" + inputs.length + ":a:0]";
    inputs.push(options.postroll);
    totalLength += 1;
  } 
  filters += totalConcat + " concat=n=" + totalLength + ":v=1:a=1 [v] [a]"

  var inputs = _.map(inputs, function (input) {
    return "-i " + input;
  }).join(" ");

  return ffmpegTemplate({ inputs: inputs, filters: filters, output: options.output });
}


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

var ignorePatterns = [
  '**/.gitignore',
  '**/README*',
  '**/*.swp',
  '**/.*.swp',
  '**/*.swo',
  '**/.*.swo',
  '**/*.MTS',
  '**/*.mp4',
  '**/*.webm'
];

function processConfig(config, defaults, src) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

function pathsort(paths) {
  return paths.map(function (path) {
      return path.split('/');
    }).sort(function (a, b) {
      for (var i = 0; i < Math.max(a.length, b.length); i += 1) {
        if (!(i in a)) {
          return -1;
        }
        if (!(i in b)) {
          return +1;
        }
        return natural_sort(a, b);
      }
    }).map(function (path) {
      return path.join('/');
    });
}

exports.htmlfiles = htmlfiles;
exports.lessonfiles = lessonfiles;
exports.format_date = format_date;
exports.walkSync = walkSync;
exports.md5sum = md5sum;
exports.andList = andList;
exports.transcodeCommand = transcodeCommand;
exports.ignorePatterns = ignorePatterns;
exports.processConfig = processConfig
exports.pathsort = pathsort

// vim: ts=2:sw=2:et
