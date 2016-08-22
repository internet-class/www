'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    async = require('async'),
    fs = require('fs-extra'),
    path = require('path'),
    lien = require('lien'),
    opn = require('opn'),
    googleapis = require('googleapis'),
    server_destroy = require('server-destroy'),
    jsonfile = require('jsonfile');

var defaults = {
  regenerate: true,
  verbose: false,
  test: true,
  credentialsFile: '../youtube/credentials.json',
  tokenFile: '../youtube/tokens.json',
  test: false
}

function processConfig(config, src) {
  config = config || {};
  config = _.extend(_.clone(defaults), config);
  return config;
}

var retrieve = function (options, topCallback) {
    
  options = processConfig(options);

  try {
    var credentials = jsonfile.readFileSync(options.credentialsFile);
  } catch (err) {
    console.log('Cannot parse ' + options.credentialsFile + ' as a OAuth2 credentials file: '+ err);
    return topCallback(err, null);
  }

  var oauth2Client = new googleapis.auth.OAuth2(credentials.web.client_id,
      credentials.web.client_secret, credentials.web.redirect_uris[0]);

  var newTokens, redirectServer, authenticationTab;

  return async.series([
      function (callback) {
        if (fs.existsSync(options.tokenFile)) {
          oauth2Client.setCredentials(jsonfile.readFileSync(options.tokenFile));
          oauth2Client.refreshAccessToken(function (err, tokens) {
            if (err) {
              if (!(options.regenerate)) {
                return topCallback(err, null);
              }
              if (options.verbose) {
                console.log("Fefreshing access tokens failed. Will regenerate.");
              }
            } else {
              newTokens = tokens;
              jsonfile.writeFileSync(options.tokenFile, tokens);
            }
            callback();
          });
        } else {
          callback();
        }
      },
      function (callback) {
        if (newTokens) {
          callback();
          return;
        }
        redirectServer = new lien({ host: "localhost" , port: 5000 });
        server_destroy(redirectServer.server);

        authenticationTab = opn(oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: ["https://www.googleapis.com/auth/youtube"],
          approval_prompt: "force"
        }), { wait: false});

        redirectServer.addPage("/oauth2callback", function (lien) {
          oauth2Client.getToken(lien.query.code, function (err, tokens) {
            if (err) {
              lien.end("Received error messages: " + err);
              return topCallback(err, null);
            }
            try {
              assert('access_token' in tokens, 'malformed tokens');
              assert('refresh_token' in tokens, 'malformed tokens');
              newTokens = tokens;
              fs.mkdirsSync(path.dirname(options.tokenFile));
              jsonfile.writeFileSync(options.tokenFile, tokens);
              lien.end("Successfully saved tokens.");
              callback();
              return;
            } catch (err) {
              lien.end("Failed to save tokens: " + err);
              return topCallback(err, null);
            }
          });
        });
      },
      function (callback) {
        if (redirectServer) {
          redirectServer.server.destroy();
        }
        if (!(options.test)) {
          callback();
          return;
        }
        oauth2Client.setCredentials(newTokens);
        var youtubeClient = googleapis.youtube({
          version: 'v3',
          auth: oauth2Client
        });
        youtubeClient.playlists.list({
          part: 'contentDetails',
          id: options.testPlaylist
        }, function (err, data, response) {
          assert(!err, "API call returned an error");
          assert(data.items.length == 1);
          var playlistData = data.items[0];
          assert(playlistData.id == options.testPlaylist);
          callback();
        });
      }],
    function () {
      return topCallback(null, oauth2Client);
    }
  );
}

var plugin = function (config) {
  config = processConfig(config);
  return function (files, metalsmith, done) {
    try {
      assert(config.credentialsFile, 'credentials missing');
      assert(fs.existsSync(path.join(metalsmith.source(), config.credentialsFile)), 'no credential file');
      assert(config.tokenFile);
      if (config.test === true) {
        assert(config.testPlaylist);
      }
    } catch (err) {
      return done(new Error("incorrect youtube_credentials configuration: " + err));
    }
    retrieve({
      credentialsFile: path.join(metalsmith.source(), config.credentialsFile),
      tokenFile: path.join(metalsmith.source(), config.tokenFile),
      test: config.test,
      testPlaylist: config.testPlaylist
    }, function (err, oauth2Client) {
      if (err) {
        done(err);
      }
      metalsmith.metadata().youtube_credentials = oauth2Client;
      done();
    });
  }
}

if (require.main === module) {
  var argv = require('minimist')(process.argv.slice(2));
  retrieve({
    credentialsFile: argv._[0],
    tokenFile: argv._[1],
    test: true,
    testPlaylist: 'PLk97mPCd8nvY7KYf1rELWvbJGPjmTttm9'
  }, function (err, oauth2Client) {
    assert(oauth2Client, "failed to retrieve credentials");
  });
}

exports = module.exports = plugin
exports.retrieve = retrieve

// vim: ts=2:sw=2:et
