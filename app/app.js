#!/usr/bin/env node

'use strict';

var argv = require('minimist')(process.argv.slice(2)),
    jsonfile = require('jsonfile');

var express = require('express'),
    express_handlebars = require('express-handlebars'),
		passport = require('passport'),
    path = require('path'),
    logger = require('morgan'),
    body_parser = require('body-parser'),
    session = require('express-session'),
    cookie_parser = require('cookie-parser'),
    connect_flash = require('connect-flash'),
    assert = require('assert'),
    mongo = require('mongodb').MongoClient,
    common = require('./common.js'),
    http = require('http'),
    shutdown = require('./middleware/shutdown.js');

var app = module.exports = express();
app.set('config', jsonfile.readFileSync(argv._[0]));

mongo.connect(app.get('config').mongo.URI).then(function (db) {
  app.set('db', db);
  app.set('staticDir', path.join(__dirname, '../build/static/'));
  app.set('courses', jsonfile.readFileSync(path.join(__dirname, '../build/courses.json')));
  app.set('secrets', jsonfile.readFileSync(path.join(__dirname, 'secrets.json')));
  app.set('auth0ID', "UwFsZjKr41IigcENM5hDiuQvxILo6CXu");

  var handlebars = express_handlebars.create({
    extname: '.hbt',
    layoutsDir: 'layouts',
    partialsDir: 'layouts/partials'
  });
  app.engine('.hbt', handlebars.engine);
  app.set('view engine', '.hbt');
  app.set('views', path.join(__dirname, 'layouts'));

  passport.use(require('./passport/auth0.js')(passport, app));

  app.use(logger('dev'));
  app.use(express.static(app.get('staticDir')));
  app.use(body_parser.json());
  app.use(body_parser.urlencoded({ extended: false }));
  app.use(cookie_parser(app.get('secrets').auth0));
  app.use(session({
    secret: app.get('secrets').auth0,
    resave: false,
    saveUninitialized: false
  }));
  app.use(connect_flash());
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/', require('./routes/root.js'));
  app.use('/', require('./routes/login.js'));
  app.use('/courses', require('./routes/courses.js'));
  app.use('/api/v0/tracker', require('./routes/tracker.js'));
  require('./middleware/errors.js');
  
  var server = http.createServer(app);
  app.use(shutdown(server, app));
  app.set('port', common.normalizePort(app.get('config').port || '8082'));
  server.listen(app.get('port'));
  server.on('error', function (error) {
    return common.onError(error, app.get('port'));
  });
  server.on('listening', function () {
    return common.onListening(server.address());
  });
}, function (err) {
  console.log(err);
}).catch(function (err) {
  console.log(err);
  console.log(err.stack);
});

// vim: ts=2:sw=2:et
