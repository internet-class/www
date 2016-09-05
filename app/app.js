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
app.use(express.static(path.join(__dirname, '../build/static/')));
app.use(cookie_parser());
app.use(body_parser.json());
app.use(body_parser.urlencoded({ extended: false }));
app.use(session({ secret: 'YOUR_CLIENT_SECRET', resave: false,  saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', function (req, res) {
  var redirectURL = app.get('config').redirectURL;
  console.log(req.user);
  res.render('root', {
    title: 'Learn the Internet on the Internet',
    description: 'Learn about the internet through short, fun videos.',
    login: (req.user === undefined),
    redirectURL: redirectURL
  });
});

app.use('/courses', require('./routes/courses.js'));
var login = require('./routes/login.js');

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    var error = err.status || 500;
    res.status(error);
    if (error === 403 || error === 404) {
      res.sendFile(path.join(__dirname, '../build/static/' + error + '/index.html'));
    } else {
      res.render('errors/500', {
        message: err.message,
        error: err
      });
    }
  });
}

// vim: ts=2:sw=2:et
