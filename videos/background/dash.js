#!/usr/bin/env node

'use strict';

var argv = require('minimist')(process.argv.slice(2)),
    jsonfile = require('jsonfile'),
    async = require('async'),
    child_process = require('child_process'),
    temp = require('temp'),
    assert = require('assert');

temp.track();

var input = argv._[0];
var rates = jsonfile.readFileSync(argv._[1]);

// vim: ts=2:sw=2:et:ft=javascript
