var app = require('../app'),
		passport = require('passport');

app.get('/callback',
  passport.authenticate('auth0', { failureRedirect: '/url-if-something-fails' }),
  function(req, res) {
    if (!req.user) {
      throw new Error('user null');
    }
    if (res.query && res.query.redirect) {
      res.redirect(res.query.redirect);
    } else {
      res.redirect('/');
    }
  });

app.get('/login', function (req, res) {
  var redirectURL = app.get('config').redirectURL;
  res.render('login', {
    redirectURL: redirectURL
  })
});

app.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    var returnTo = "";
    if (res.query && res.query.returnTo) {
      returnTo = res.query.returnTo;
    }
    return res.redirect("https://internet-class.auth0.com/v2/logout?returnTo=" +
        app.get('config').redirectURL + "/" + returnTo +
        "&client_id=" + app.get('auth0ID'));
  });
});
