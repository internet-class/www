var app = require('../app');

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  return next(err);
});

app.use(function(err, req, res, next) {
  var error = err.status || 500;
  res.status(error);
  if (error === 403 || error === 404) {
    res.sendFile(app.get('staticDir') + error + '/index.html');
  } else {
    if (app.get('env') === 'development') {
      console.log(err);
      console.log(err.stack);
    }
    res.render('errors/500', { message: err.message, error: err });
  }
});

// vim: ts=2:sw=2:et
