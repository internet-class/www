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
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    events: {
      'onReady': onPlayerReady
    }
  });
}

function onPlayerReady(event) {
  if (_.keys(videoInfo).length == 1) {
    var choice = videoInfo[_.keys(videoInfo)[0]];
    player.loadVideoById(choice.id, choice.skip, 'large');
  } else {
    var choice = videoInfo[_.sample(_.keys(videoInfo))];
    player.loadVideoById(choice.id, choice.skip, 'large');
    setChoice(choice);
    $('#list').css({ visibility: 'visible' });
  }
  trackVideo(player, {
    videos: videoInfo
  });
  event.target.playVideo();
}

var savedPositions = {};

$('a.video-choice').click(function() {
  if (player) {
    try {
      savedPositions[player.getVideoData().video_id] = player.getCurrentTime();
    } catch (err) { };
    var newVideoId = $(this).data('youtube');
    var newVideoSkip = $(this).data('skip');
    if ((newVideoId in savedPositions) &&
        (savedPositions[newVideoId] > newVideoSkip)) {
      newVideoSkip = savedPositions[newVideoId];
    }
    player.loadVideoById(newVideoId, newVideoSkip, 'large');
    setChoice(videoInfo[$(this).data('youtube')]);
  }
});

// vim: ts=2:sw=2:et
