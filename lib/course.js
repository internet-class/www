'use strict';

var convertDefaults = {
  coursePlans = 'courses/**/plan.yaml',
  verbose: false
}

var convert = function(config) {
  config = common.processConfig(config, convertDefaults);

	return function (files, metalsmith, done) {
    done();
  }
}

// vim: ts=2:sw=2:et
