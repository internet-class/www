'use strict';

var argv = require('minimist')(process.argv.slice(2)),
    jsonfile = require('jsonfile');

var express = require('express'),
    express_handlebars = require('express-handlebars'),
		passport = require('passport'),
    path = require('path'),
    logger = require('morgan'),
    cookie_parser = require('cookie-parser'),
    body_parser = require('body-parser'),
    session = require('express-session');

var app = module.exports = express();

app.set('staticDir', path.join(__dirname, '../build/static/'));
app.set('config', jsonfile.readFileSync(argv._[0]));
app.set('courses', jsonfile.readFileSync(path.join(__dirname, '../build/courses.json')));
app.set('lessons', jsonfile.readFileSync(path.join(__dirname, '../build/lessons.json')));
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
app.use(session({
  secret: app.get('secrets').auth0,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', require('./routes/root.js'));
app.use('/', require('./routes/login.js'));
app.use('/courses', require('./routes/courses.js'));
require('./routes/errors.js');

// vim: ts=2:sw=2:et
