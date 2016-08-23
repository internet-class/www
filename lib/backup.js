'use strict';

var argv = require('minimist')(process.argv.slice(2)),
		_ = require('underscore'),
    child_process = require('child_process'),
    jsonfile = require('jsonfile');

var src = argv._[0];
var dests = jsonfile.readFileSync(argv._[1]);

var handlebars = require('handlebars');

var unisonTemplate = handlebars.compile(`
unison {{ src }} {{ dest }} -prefer {{ src }} -nodeletion {{ src }} -nodeletion {{ dest }} -auto -batch -fastcheck true -silent -times`);

_.each(dests, function (dest) {
	var command = unisonTemplate({ src: src, dest: dest }).trim();
	child_process.execSync(command);
});


