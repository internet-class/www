'use strict';

var app = require('../app'),
		express = require('express'),
    _ = require('underscore'),
    path = require('path'),
		protect = require('../middleware/protect.js');

var videos = app.get('courses').videos;

var router = express.Router();

router.use(protect.forbidden);
router.use(protect.load);

router.post('/complete',function (req, res) {
	console.log(req.body);
	res.status(200).send();
});

exports = module.exports = router

// vim: ts=2:sw=2:et
