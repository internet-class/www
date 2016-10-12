var isVisible = true;

var checkVisibility = function () {
  var hidden = "hidden";

  if (hidden in document) {
    document.addEventListener("visibilitychange", onchange);
  } else if ((hidden = "mozHidden") in document) {
    document.addEventListener("mozvisibilitychange", onchange);
  } else if ((hidden = "webkitHidden") in document) {
    document.addEventListener("webkitvisibilitychange", onchange);
  } else if ((hidden = "msHidden") in document) {
    document.addEventListener("msvisibilitychange", onchange);
  } else if ("onfocusin" in document) {
    document.onfocusin = document.onfocusout = onchange;
  } else {
    window.onpageshow = window.onpagehide = window.onfocus = window.onblur = onchange;
	}

  function onchange (evt) {
    var v = "visible", h = "hidden",
        evtMap = {
          focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h
        };

    evt = evt || window.event;
    if (evt.type in evtMap) {
      isVisible = (evtMap[evt.type] === 'visible') ? true : false;
    } else {
      isVisible = this[hidden] ? false : true;
    }
  }

  if (document[hidden] !== undefined) {
    onchange({type: document[hidden] ? "blur" : "focus"});
  }
};

var infoById = {};
var checkInterval;
var lastCheck, lastStream;

var checkTime = function (player, options, videoId, videoLength) {
  var skip = options.videos[videoId].skip,
      end = options.videos[videoId].end;
  var isMuted = player.isMuted();
  if (!(videoId in infoById)) {
    player.unMute();
    isMuted = false;
    player.setPlaybackRate(1);
    infoById[videoId] = {
      maxLength: videoLength - skip - end,
      watchedLength: 0,
      streamedLength: 0,
      maxBins: Math.floor((videoLength - skip - end) / options.bin),
      watchedBins: {},
      youtube: videoId,
      done: false,
      problems: {
        speeding: false,
        skipped: false,
        visibility: false,
        muted: false
      }
    }
  }
  var info = infoById[videoId],
      now = +new Date(),
      videoNow = player.getCurrentTime(),
      problemCount = _.filter(_.each(info.problems, function (p) { return p } )).length;

  if (isVisible && !isMuted) {
    var bin = Math.floor((player.getCurrentTime() - skip) / options.bin);
    info.watchedBins[bin] = true;
    if (bin > 0 && !((bin - 1) in info.watchedBins)) {
      info.problems.skipped = true;
    }
    info.watchedLength += ((now - lastCheck) / 1000);
    info.streamedLength += (videoNow - lastStream);
  }
  lastCheck = now;
  lastStream = videoNow;

  var isSpeeding = (info.watchedLength > 10 && (info.streamedLength / info.watchedLength > 1.1));
  if (!isVisible) {
    info.problems.visibility = true;
  }
  if (isMuted) {
    info.problems.muted = true;
  }
  if (isSpeeding) {
    info.problems.speeding = true;
  }
  if ((problemCount != _.filter(_.each(info.problems, function (p) { return p } )).length) &&
      (options.problemCallback)) {
    options.problemCallback(info, player);
  }

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
      console.log(videoId + " " + _.keys(info.watchedBins).length + ":" + info.maxBins + " " + info.watchedLength + ":" + info.maxLength + " " + JSON.stringify(info.problems));
    }
  }
}

var resetTracker = function (videoID) {
  delete(infoById[videoID]);
};

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
  lastStream = player.getCurrentTime();

  checkInterval = window.setInterval(function () {
    checkTime(player, options, videoId, videoLength);
  }, options.sample * 1000);
}

var trackVideoDefaults = {
  debug: false,
  bin: 5,
  sample: 1
}
var trackVideo = function (player, options) {
  options = _.extend(trackVideoDefaults, options);
  if (options.debug) {
    console.log("Tracker started: " + JSON.stringify(options, null, 2));
  }
  checkVisibility();
  player.addEventListener('onStateChange', function (event) {
    return onPlayerStateChange(event, player, options);
  });
}

// vim: ts=2:sw=2:et
