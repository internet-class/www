var metalsmith = require('metalsmith'),
    temp = require('tmp'),
    lessons = require('./lessons.js'),
    videos = require('./videos.js'),
    flush = require('./flush.js');

temp.track();

var defaultAuthors = [{
  name: "Geoffrey Challen",
  credits: "Assistant Professor, Computer Science and Engineering, University at Buffalo"
}]
var defaultProducers = [{
  name: "Greg Bunyea",
  credits: "Undergraduate, Computer Science and Engineering, University at Buffalo"
}]

var getAuthors = function(config) {
  return function(files, metalsmith, done) {
    _.each(metalsmith.metadata().videos.allVideos, function (videoData) {
      if (!(videoData.authors)) {
        videoData.authors = defaultAuthors;
      }
      if (!(videoData.producers)) {
        videoData.producers = defaultProducers;
      }
    });
    done();
  }
}

var getTitles = function(config) {
  return function(files, metalsmith, done) {
    _.each(metalsmith.metadata().videos.allVideos, function (videoData) {
      assert(videoData.lesson);
      videoData.title = videoData.title || videoData.lesson.title;
      videoData.description = videoData.description ||
        html_to_text.fromString(videoData.lesson.content, {
          wordwrap: false,
          ignoreHref: true,
          ignoreImage: true,
          uppercaseHeadings: false
        });
    });
  }
}

metalsmith('.')
  .ignore(['**/*.MTS', '**/*.mp4'])
  .destination(tmp.mkdirSync())
  .use(lessons())
  .use(videos.find({ videoExtensions: ['lessons/**/*.MTS'] }))
  .use(videos.transcode({ credits: 'credits' }))
  .use(youtube_credentials())
  .use(videos.upload({
    locationDescription: "Davis Hall, University at Buffalo",
    locationLatitude: 43.0026512146,
    locationLongitude: -78.7873077393,
    extraTags: ['internet', 'internet-class.org']
  }))
  .use(flush())
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
