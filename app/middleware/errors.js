var app = require('../app'),
    path = require('path');

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
      res.sendFile(app.get('staticDir') + error + '/index.html');
    } else {
      res.render('errors/500', {
        message: err.message,
        error: err
      });
    }
  });
}
