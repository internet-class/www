var argv = require('minimist')(process.argv.slice(2)),
    assert = require('assert'),
    async = require('async'),
    fs = require('fs-extra'),
    path = require('path'),
    lien = require('lien'),
    opn = require('opn'),
    googleapis = require('googleapis'),
    jsonfile = require('jsonfile');

var credentialsFile = argv._[0];
var tokenFile = argv._[1];

try {
	var credentials = jsonfile.readFileSync(credentialsFile);
} catch (err) {
	console.log('Cannot parse ' + credentialsFile + ' as a OAuth2 credentials file');
  process.exit(1);
}

var oauth2Client = new googleapis.auth.OAuth2(credentials.web.client_id,
    credentials.web.client_secret, credentials.web.redirect_uris[0]);

var newTokens;

async.series([
    function (callback) {
      if (fs.existsSync(tokenFile)) {
        oauth2Client.setCredentials(jsonfile.readFileSync(tokenFile));
        oauth2Client.refreshAccessToken(function (err, tokens) {
          if (err) {
            console.log("Fefreshing access tokens failed. Will regenerate.");
          } else {
            newTokens = tokens;
            jsonfile.writeFileSync(tokenFile, tokens);
          }
          callback();
        });
      }
    },
    function (callback) {
      if (newTokens) {
        callback();
        return;
      }
      var redirectServer = new lien({ host: "localhost" , port: 5000 });
      opn(oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/youtube"],
        approval_prompt: "force"
      }));

      redirectServer.addPage("/oauth2callback", function (lien) {
        oauth2Client.getToken(lien.query.code, function (err, tokens) {
          if (err) {
            lien.lien(err, 400);
            console.log(err);
            return;
          }
          try {
            assert('access_token' in tokens, 'malformed tokens');
            assert('refresh_token' in tokens, 'malformed tokens');
            fs.mkdirsSync(path.dirname(tokenFile));
            jsonfile.writeFileSync(tokenFile, tokens);
            lien.end("Successfully saved tokens.");
          } catch (err) {
            lien.end("Failed to save tokens: " + err);
            process.exit(1);
          }
          callback();
        });
      });
    },
    function (callback) {
      oauth2Client.setCredentials(newTokens);
      var youtube = googleapis.youtube({
        version: 'v3',
        auth: oauth2Client
      });
      youtube.playlists.list({
        part: 'contentDetails',
        id: 'PLk97mPCd8nvY7KYf1rELWvbJGPjmTttm9'
      }, function (err, data, response) {
        assert(!err, "API call returned an error");
        assert(data.items.length == 1);
        var playlistData = data.items[0];
        assert(playlistData.id == 'PLk97mPCd8nvY7KYf1rELWvbJGPjmTttm9');
        callback();
      });
    }]
);

// vim: ts=2:sw=2:et
