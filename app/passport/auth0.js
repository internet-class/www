var passport_auth0 = require('passport-auth0'),
    jsonfile = require('jsonfile');

var clientID = "UwFsZjKr41IigcENM5hDiuQvxILo6CXu";

var getStrategy = function(passport, app) {
  var strategy = new passport_auth0({
    domain:       'internet-class.auth0.com',
    clientID:     clientID,
    clientSecret: app.get('secrets').auth0,
    callbackURL:  '/callback'
  }, function(accessToken, refreshToken, extraParams, profile, done) {
    return done(null, profile);
  });
  passport.serializeUser(function(user, done) {
    done(null, user);
  });
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  return strategy;
}

module.exports = getStrategy

// vim: ts=2:sw=2:et
