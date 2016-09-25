#!/usr/bin/env node

'use strict';

var argv = require('minimist')(process.argv.slice(2)),
    yamljs = require('yamljs'),
    fs = require('fs-extra'),
    handlebars = require('handlebars'),
    _ = require('underscore'),
    async = require('async'),
    child_process = require('child_process'),
    temp = require('temp'),
    assert = require('assert');

var input = argv._[0];
var lengthCommandLine =
  'ffprobe -v error -select_streams v:0 -show_entries format=duration ' + 
  '-of default=noprint_wrappers=1:nokey=1 ' + input;
var inputDurationSec = parseFloat(child_process.execSync(lengthCommandLine));

var rates = yamljs.parse(fs.readFileSync(argv._[1]).toString());
var outputDir = temp.mkdirSync();

var videoTemplate = handlebars.compile(
  'ffmpeg -i ' + input + ' -c:v libvpx-vp9 -filter:v fps=29.97 -s {{{ size }}} ' +
  '-b:v {{{ bandwidth }}}k -minrate {{{ bandwidth }}}k -maxrate {{{ bandwidth }}}k ' +
  '-keyint_min 150 -g 150 -tile-columns 4 -frame-parallel 1 ' +
  '-an -f webm -dash 1 ' + outputDir + '/{{{ output }}}'
);
var audioTemplate = handlebars.compile(
  'ffmpeg -i ' + input + ' -c:a libvorbis -b:a {{{ rate }}}k -vn -f webm -dash 1 ' +
  outputDir + '/{{{ output }}}'
);
var manifestTemplate = handlebars.compile(
  'ffmpeg ' + 
  '{{#each video}} -f webm_dash_manifest -i ' + outputDir + '/{{ this }} {{/each}} ' +
  '{{#each audio}} -f webm_dash_manifest -i ' + outputDir + '/{{ this }} {{/each }} ' +
  '-c copy {{ maps }} -f webm_dash_manifest -adaptation_sets "{{{ streams }}}" ' +
  outputDir + '/{{ output }}'
);

var video = [];
var audio = [];

var allTranscodes = [];
_.each(rates.video, function (rate) {
  _.each(rate.sizes, function (size) {
    var targetRate = Math.floor((parseInt(size) * (1024 * 8)) / inputDurationSec / 1024);
    var output = "video_" + rate.resolution + "_" + targetRate + "k.webm";
    video.push(output);
    allTranscodes.push({
      output: output,
      command: videoTemplate({
        size: rate.resolution,
        bandwidth: targetRate,
        output: output
      })
    });
  });
});
_.each(rates.audio.rates, function (rate) {
  var output = "audio_" + rate + "k.webm";
  audio.push(output);
  allTranscodes.push({
    output: output,
    command: audioTemplate({
      rate: rate,
      output: output
    })
  });
});

async.eachLimit(allTranscodes, 8, function (transcode, callback) {
  if (argv.dry_run) {
    console.log(transcode.command);
    return callback();
  } else {
    child_process.exec(transcode.command, function (err, stdout, stderr) {
      return callback(err);
    });
  }
}, function () {
  var maps = _.map(allTranscodes, function (unused, index) {
    return "-map " + index;
  }).join(" ");
  var streams = "id=0,streams=" + _.map(video, function (unused, index) {
    return index;
  }).join(",") + " id=1,streams=" + _.map(audio, function (unused, index) {
    return video.length + index;
  }).join(",");
  var command = manifestTemplate({
    video: video,
    audio: audio,
    maps: maps,
    streams: streams,
    output: "manifest.mpd"
  });
  if (argv.dry_run) {
    console.log(command);
  } else {
    child_process.execSync(command);
    console.log(outputDir);
  }
});

// vim: ts=2:sw=2:et:ft=javascript
