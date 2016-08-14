var argv = require('minimist')(process.argv.slice(2)),
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

var oauthRequest = new googleapis.auth.OAuth2(credentials.web.client_id,
    credentials.web.client_secret, credentials.web.redirect_uris[0]);
oauthRequest.setCredentials({ access_token: undefined, refresh_token: undefined });

var redirectServer = new lien({ host: "localhost" , port: 5000 });
opn(oauthRequest.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube"],
    approval_prompt: "force"
}));

redirectServer.addPage("/oauth2callback", function (lien) {
  oauthRequest.getToken(lien.query.code, function (err, tokens) {
    if (err) {
      lien.lien(err, 400);
      console.log(err);
      return;
    }
    try {
      fs.mkdirsSync(path.dirname(tokenFile));
      jsonfile.writeFileSync(tokenFile, tokens);
      lien.end("Successfully saved tokens.");
      process.exit(0);
    } catch (err) {
      lien.end("Failed to save tokens: " + err);
      process.exit(1);
    }
  });
});

// vim: ts=2:sw=2:et
