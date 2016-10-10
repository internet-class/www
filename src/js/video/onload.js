$(function () {
  var footnotesActive = {};
  var activateFootnote = function (elem) {
    var uniqueId = $(elem).attr('id');
    if (!(footnotesActive[uniqueId])) {
      footnotesActive[uniqueId] = true;
      Materialize.toast($(elem).data('content'), 5000);
      window.setTimeout(function () {
        delete(footnotesActive[uniqueId]);
      }, 5000);
    }
  }
  $('.footnote').click(function() {
    activateFootnote(this);
  });
  $('.footnote').mouseenter(function() {
    activateFootnote(this);
  });

  $(".button-collapse").sideNav();
  
  $('a.tooltip-disable-on-click').each(function() {
    $(this).click(function (e) {
      e.preventDefault();
      window.location = $(this).attr('href');
    });
  });

  $('#close_modal').click(function () {
    var videoId = $("#problem_modal").data('videoId');
    resetTracker(videoId);
    player.loadVideoById(videoId, startPositions[videoId], 'large');
    $("#problem_modal").closeModal();
  });
});

var setChoice = function(choice) {
  $('.video-choice').each(function() {
    if ($(this).data('youtube') == choice.id) {
      $(this).addClass('active');
    } else {
      $(this).removeClass('active');
    }
  });
}

var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var videoInfo = {};
function onYouTubeIframeAPIReady() {
  $('.video-choice').each(function () {
    videoInfo[$(this).data('youtube')] = {
      id: $(this).data('youtube'),
      skip: $(this).data('skip'),
      elem: $(this)
    };
  });
  var choice = videoInfo[_.keys(videoInfo)[0]];
  player = new YT.Player('player', {
    width: 640,
    height: 390,
    videoId: choice.id,
    playerVars: {
      autoplay: true,
      fs: true,
      modestbranding: true,
      origin: $("#player").data('origin'),
      rel: false,
      start: choice.skip
    },
    events: {
      'onReady': onPlayerReady
    }
  });
  if (_.keys(videoInfo).length > 1) {
    setChoice(choice);
    $('#list').css({ visibility: 'visible' });
  }
}

function videoFinished(info) {
  $.post('/api/v0/tracker/complete', info, function() {
    $("#next_link").removeClass('disabled');
  }).fail(function () {
    Materialize.toast("Failed to record lesson completion. Please reload the page.", 5000);
  });
}
function videoProblem(info) {
  player.pauseVideo();
  var problem = "";
  if (info.problems.visibility) {
    problem = "You need to leave the window in the foreground. Pay attention!";
  } else if (info.problems.skipped) {
    problem = "You skipped a section. Watch the video start to finish without seeking.";
  } else if (info.problems.muted) {
    problem = "You muted the video. Leave the audio enabled.";
  } else if (info.problems.speeding) {
    problem = "You're watching the video too fast. Leave it at normal speed.";
  }
  problem += " <strong>Please watch the videos from start to finish, at normal speed, " +
    "in the foreground, and with sound enabled.</strong>";
  $("#problem_description").html(problem);
  $("#problem_modal").data('videoId', info.youtube);
  $("#problem_modal").openModal({ dismissible: false });
}

function onPlayerReady(event) {
  if ($("#player").data('tracking') === true) {
    trackVideo(player, {
      complete: $("#player").data('tracking-complete'),
      debug: false,
      doneCallback: videoFinished,
      problemCallback: videoProblem,
      videos: videoInfo
    });
  } else {
    player.addEventListener('onStateChange', function (event) {
      if (event.data == 1) {
        player.unMute();
        player.setPlaybackRate(1);
      }
    });
  }
  event.target.playVideo();
}

var startPositions = {},
    savedPositions = {};

$('.video-choice').each(function() {
  startPositions[$(this).data('youtube')] = $(this).data('skip');
  savedPositions[$(this).data('youtube')] = $(this).data('skip');
});

$('a.video-choice').click(function() {
  if (player) {
    savedPositions[player.getVideoData().video_id] = player.getCurrentTime();
    var newVideoId = $(this).data('youtube');
    var newVideoSkip = $(this).data('skip');
    if ((newVideoId in savedPositions) &&
        (savedPositions[newVideoId] >= newVideoSkip)) {
      newVideoSkip = savedPositions[newVideoId];
    }
    player.loadVideoById(newVideoId, newVideoSkip, 'large');
    setChoice(videoInfo[$(this).data('youtube')]);
  }
});

// vim: ts=2:sw=2:et
