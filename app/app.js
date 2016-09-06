#!/usr/bin/env node

'use strict';

var express = require('express'),
    jsonfile = require('jsonfile'),
    argv = require('minimist')(process.argv.slice(2)),
    mongo = require('mongodb').MongoClient,
    path = require('path'),
    express_handlebars = require('express-handlebars'),
		passport = require('passport'),
    logger = require('morgan'),
    body_parser = require('body-parser'),
    cookie_parser = require('cookie-parser'),
    session = require('express-session'),
    assert = require('assert'),
    connect_flash = require('connect-flash'),
    http = require('http'),
    common = require('./common.js');

var app = module.exports = express();
app.set('config', jsonfile.readFileSync(argv._[0]));
if (app.get('config').proxy) {
  app.set('trust proxy', 1);
}

mongo.connect(app.get('config').mongo.URI).then(function (db) {
  app.set('db', db)
    .set('staticDir', path.join(__dirname, '../build/static/'))
    .set('courses', jsonfile.readFileSync(argv._[1]))
    .set('secrets', jsonfile.readFileSync(argv._[2]))
    .set('auth0ID', "UwFsZjKr41IigcENM5hDiuQvxILo6CXu");

  var handlebars = express_handlebars.create({
    extname: '.hbt',
    layoutsDir: 'layouts',
    partialsDir: 'layouts/partials'
  });
  app.engine('.hbt', handlebars.engine)
    .set('view engine', '.hbt')
    .set('views', path.join(__dirname, 'layouts'))
    .set('handlebars', handlebars);
  require('./layouts/helpers.js');

  passport.use(require('./passport/auth0.js')(passport, app));

  app.use(logger('dev'))
    .use(express.static(app.get('staticDir')))
    .use(body_parser.json())
    .use(body_parser.urlencoded({ extended: false }))
    .use(cookie_parser(app.get('secrets').auth0));

  var store;
  if (app.get('config').session === 'filesystem') {
    var session_file_store = require('session-file-store')(session);
    store = new session_file_store({
      path: path.join(__dirname, '.sessions')
    });
  } else if (app.get('config').session === 'redis') {
    var redis_store = require('connect-redis')(session);
    store = new redis_store();
  }
  assert(store);

  app.use(session({
      store: store,
      secret: app.get('secrets').auth0,
      resave: false,
      saveUninitialized: false
    }))
    .use(connect_flash())
    .use(passport.initialize())
    .use(passport.session());

  var errors = require('./middleware/errors.js');

  app.use('/', require('./routes/root.js'))
    .use('/', require('./routes/login.js'))
    .use('/courses', require('./routes/courses.js'))
    .use('/api/v0/tracker', require('./routes/tracker.js'))
    .use(errors.notFound)
    .use(errors.errorPage);
  
  var server = http.createServer(app);
  app.use(require('./middleware/shutdown.js')(server, app));
  app.set('port', common.normalizePort(app.get('config').port || '8082'));
  server.listen(app.get('port'));
  server.on('error', function (error) {
    return common.onError(error, app.get('port'));
  });
  server.on('listening', function () {
    return common.onListening(server.address());
  });
}).catch(function (err) {
  console.log(err);
  console.log(err.stack);
  process.exit(-1);
});

// vim: ts=2:sw=2:et
