var express = require('express'),
    express_handlebars = require('express-handlebars'),
    path = require('path'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser');

var courses = require('./routes/courses.js');

var app = express();
var handlebars = express_handlebars.create({
  extname: '.hbt',
  layoutsDir: 'layouts',
  partialsDir: 'layouts/partials'
});

app.engine('.hbt', handlebars.engine);
app.set('view engine', '.hbt');
app.set('views', path.join(__dirname, 'layouts'));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../build/static/')));

app.use('/courses', courses.router);

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
      res.sendfile(path.join(__dirname, '../build/static/' + error + '/index.html'));
    } else {
      res.render('errors/500', {
        message: err.message,
        error: err
      });
    }
  });
}

module.exports = app;

// vim: ts=2:sw=2:et
