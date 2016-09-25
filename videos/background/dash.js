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

temp.track();

var input = argv._[0];
var lengthCommandLine =
  'ffprobe -v error -select_streams v:0 -show_entries format=duration ' + 
  '-of default=noprint_wrappers=1:nokey=1 ' + input;
var inputDurationSec = parseFloat(child_process.execSync(lengthCommandLine));

var rates = yamljs.parse(fs.readFileSync(argv._[1]).toString());
var outputDir = temp.mkdirSync();

var videoTemplate = handlebars.compile(
  'ffmpeg ' + input + ' -c:v libvpx-vp9 -filter:v fps=29.97 ' +
  '-s {{{ size }}} -b:v {{{ bandwidth }}} ' +
  '-keyint_min 150 -g 150 -tile-columns 4 -frame-parallel 1 ' +
  '-an -f webm -dash 1 ' + outputDir + '/{{{ output }}}'
);
var audioTemplate = handlebars.compile(
  'ffmpeg ' + input + ' -c:a libvorbis -b:a {{{ rate }}}k -vn -f webm -dash 1 ' +
  outputDir + '/{{{ output }}}'
);

var allTranscodes = [];
_.each(rates.video, function (rate) {
  _.each(rate.sizes, function (size) {
    var targetRate = Math.floor((parseInt(size) * (1024 * 8)) / inputDurationSec / 1024);
    var output = "video_" + rate.resolution + "_" + targetRate + "k.webm"
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
  allTranscodes.push({
    output: output,
    command: audioTemplate({
      rate: rate,
      output: output
    })
  });
});
console.log(allTranscodes);

process.exit(0);

async.eachLimit(rates, 1, function (rate, callback) {
  var targetRate = (parseInt(rate.size) * (1024 * 1024 * 8)) / inputDurationSec;
  console.log(targetRate);
  return callback();
});

// vim: ts=2:sw=2:et:ft=javascript
