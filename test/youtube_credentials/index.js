var chai = require('chai'),
    fs = require('fs-extra'),
    async = require('async'),
    path = require('path'),
    tmp = require('tmp'),
    googleapis = require('googleapis'),
    youtube_credentials = require('../../lib/youtube_credentials.js');

chai.use(require('chai-fs'));
tmp.setGracefulCleanup();
var assert = chai.assert;

describe('youtube_credentials.js', function () {
  it('should work with good credentials', function (done) {
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good.json')))) {
      console.log('SKIP: please place good credentials in ' + path.join(__dirname, 'fixtures/credentials/good.json'));
      done();
      return;
    }
    this.slow(30000);
    this.timeout(30000);
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    youtube_credentials.retrieve({
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
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/bad.json')))) {
      console.log('SKIP: please place bad credentials in ' + path.join(__dirname, 'fixtures/credentials/bad.json'));
      done();
      return;
    }
    this.slow(30000);
    this.timeout(30000);
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    youtube_credentials.retrieve({
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
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good.json')))) {
      console.log('SKIP: please place good credentials in ' + path.join(__dirname, 'fixtures/credentials/good.json'));
      done();
      return;
    }
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good_tokens.json')))) {
      console.log('SKIP: please place good tokens in ' + path.join(__dirname, 'fixtures/credentials/good_tokens.json'));
      done();
      return;
    }
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    this.slow(2000);
    youtube_credentials.retrieve({
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
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good.json')))) {
      console.log('SKIP: please place good credentials in ' + path.join(__dirname, 'fixtures/credentials/good.json'));
      done();
      return;
    }
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good_tokens.json')))) {
      console.log('SKIP: please place bad tokens in ' + path.join(__dirname, 'fixtures/credentials/bad_tokens.json'));
      done();
      return;
    }
    var outputDir = tmp.dirSync().name;
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    this.slow(2000);
    youtube_credentials.retrieve({
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
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good.json')))) {
      console.log('SKIP: please place good credentials in ' + path.join(__dirname, 'fixtures/credentials/good.json'));
      done();
      return;
    }
    if (!(fs.existsSync(path.join(__dirname, 'fixtures/credentials/good_tokens.json')))) {
      console.log('SKIP: please place good tokens in ' + path.join(__dirname, 'fixtures/credentials/good_tokens.json'));
      done();
      return;
    }
    var outputDir = tmp.dirSync().name;
    this.slow(2000);
    fs.copySync(path.join(__dirname, 'fixtures/credentials'), outputDir);
    youtube_credentials.retrieve({
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
  it('should upload videos', function (done) {
    // Skipping this test for now.
    done();
    return;

    var outputDir = tmp.dirSync().name;
    this.slow(30000);
    this.timeout(30000);
    fs.copySync(path.join(__dirname, 'fixtures'), outputDir);
    var oauth2Client;
    var videoData;
    var youtubeClient;
    async.series([
        function (callback) {
          youtube_credentials.retrieve({
            credentialsFile: path.join(outputDir, 'credentials/good.json'),
            tokenFile: path.join(outputDir, 'credentials/good_tokens.json'),
            test: false
          }, function (err, client) {
            assert(!err);
            assert(client);
            oauth2Client = client;
            callback();
          });
        },
        function (callback) {
          youtube.uploadVideo(oauth2Client, {
            title: 'Test Video',
            description: 'Test Description',
            defaultLanguage: 'en',
            privacyStatus: 'private',
            embeddable: true,
            license: 'creativeCommon',
            categoryId: '27',
            notifySubscribers: false,
            autoLevels: true,
            stabilize: true,
            output: path.join(outputDir, 'videos/test.mp4')
          }, function (err, data) {
            assert(!err);
            assert(data);
            videoData = data;
            callback();
          });
        },
        function (callback) {
          youtubeClient = googleapis.youtube({ version: 'v3', auth: oauth2Client });
          youtubeClient.videos.list({
            part: 'contentDetails, snippet, status',
            id: videoData.id
          }, function (err, data) {
            assert(!err);
            assert(data.items.length == 1);
            assert(data.items[0].id == videoData.id);
            callback();
          });
        },
        function (callback) {
          youtubeClient.videos.delete({
            id: videoData.id
          }, function (err) {
            assert(!err);
            callback();
          });
        },
        function (callback) {
          youtubeClient.videos.list({
            part: 'contentDetails',
            id: videoData.id
          }, function (err, data) {
            assert(!err);
            assert(data.items.length == 0);
            callback();
          });
        }
    ], function () {
      done();
    });
	});
});

// vim: ts=2:sw=2:et
