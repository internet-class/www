var infoById = {};
var checkInterval;
var lastCheck;

var checkTime = function (player, options, videoId, videoLength) {
  var skip = 0;
  if (videoId in options.videos) {
    skip = options.videos[videoId].skip || 0;
  }
  if (!(videoId in infoById)) {
    infoById[videoId] = {
      maxLength: Math.floor((videoLength - skip) * options.complete / 100.0),
      watchedLength: 0,
      maxBins: Math.floor(((videoLength - skip) / options.bin) * options.complete / 100.0),
      watchedBins: {},
      youtube: videoId,
      done: false
    }
  }
  var info = infoById[videoId];
  var bin = Math.floor((player.getCurrentTime() - skip) / options.bin);

  info.watchedBins[bin] = true;
  var now = +new Date();
  info.watchedLength += ((now - lastCheck) / 1000);
  lastCheck = now;

  if ((_.keys(info.watchedBins).length > info.maxBins) &&
      (info.watchedLength > info.maxLength)) {
    info.done = true;
    window.clearInterval(checkInterval);
    if (options.debug) {
      console.log(videoId + ": done");
    }
    if (options.doneCallback) {
      options.doneCallback(info);
    }
  } else {
    if (options.debug) {
      console.log(videoId + " " + _.keys(info.watchedBins).length + ":" + info.maxBins + " " + info.watchedLength + ":" + info.maxLength);
    }
  }
}

var onPlayerStateChange = function (event, player, options) {
  if (event.data != 1) {
    if (checkInterval) {
      window.clearInterval(checkInterval);
    }
    return;
  }
  var videoId = player.getVideoData().video_id;
  var videoLength = player.getDuration();
  lastCheck = +new Date();
  checkInterval = window.setInterval(function () {
    checkTime(player, options, videoId, videoLength);
  }, options.sample * 1000);
}

var trackVideoDefaults = {
  debug: true,
  complete: 90,
  bin: 10,
  sample: 1
}
var trackVideo = function (player, options) {
  options = _.extend(trackVideoDefaults, options);
  if (options.debug) {
    console.log("Tracker started: " + JSON.stringify(options, null, 2));
  }
  player.addEventListener('onStateChange', function (event) {
    return onPlayerStateChange(event, player, options);
  });
}

// vim: ts=2:sw=2:et
