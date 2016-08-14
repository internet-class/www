var chai = require('chai'),
    fs = require('fs-extra'),
    path = require('path'),
    tmp = require('tmp'),
    youtube = require('../../lib/youtube.js');

chai.use(require('chai-fs'));
tmp.setGracefulCleanup();
var assert = chai.assert;

describe('youtube.js', function () {
  it('should work with good credentials', function (done) {
    this.slow(30000);
    this.timeout(30000);
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    youtube.getCredentials({
      credentialsFile: path.join(outputDir, 'good.json'),
      tokenFile: path.join(outputDir, 'tokens.json'),
      test: false
   }, function (err, oauth2Client) {
     assert(!err);
     assert(oauth2Client);
     done();
   });
	});
  it('should fail with bad credentials', function (done) {
    this.slow(30000);
    this.timeout(30000);
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    youtube.getCredentials({
      credentialsFile: path.join(outputDir, 'bad.json'),
      tokenFile: path.join(outputDir, 'tokens.json'),
      test: false
   }, function (err, oauth2Client) {
     assert(err);
     assert(!oauth2Client);
     done();
   });
	});
  it('should work with saved credentials', function (done) {
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    this.slow(2000);
    youtube.getCredentials({
      credentialsFile: path.join(outputDir, 'good.json'),
      tokenFile: path.join(outputDir, 'good_tokens.json'),
      test: false
   }, function (err, oauth2Client) {
     assert(!err);
     assert(oauth2Client);
     done();
   });
	});
  it('should fail with bad saved credentials', function (done) {
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    this.slow(2000);
    youtube.getCredentials({
      credentialsFile: path.join(outputDir, 'good.json'),
      tokenFile: path.join(outputDir, 'bad_tokens.json'),
      regenerate: false
   }, function (err, oauth2Client) {
     assert(err);
     assert(!oauth2Client);
     done();
   });
	});
  it('should not test when told not to', function (done) {
    var outputDir = tmp.dirSync().name;
    this.slow(2000);
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    youtube.getCredentials({
      credentialsFile: path.join(outputDir, 'good.json'),
      tokenFile: path.join(outputDir, 'good_tokens.json'),
      test: false,
      testPlaylist: 'PLk97mPCd8nvY7KYf1rBOGUSJGPjmTttm9'
   }, function (err, oauth2Client) {
     assert(!err);
     assert(oauth2Client);
     done();
   });
	});
});

// vim: ts=2:sw=2:et
