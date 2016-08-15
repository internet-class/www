var metalsmith = require('metalsmith'),
    temp = require('tmp'),
    lessons = require('./lessons.js'),
    videos = require('./videos.js'),
    flush = require('./flush.js');

temp.track();

metalsmith('.')
  .ignore(['*.MTS', '*.mp4'])
  .destination(tmp.dirSync().name)
  .use(lessons())
  .use(videos())
  .use(flush())
  .clean(false)
  .build(function throwErr (err) {
    if (err) {
      throw err;
    }
  });

// vim: ts=2:sw=2:et
