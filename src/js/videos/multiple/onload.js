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

});

var setChoice = function(choice) {
  $('.video-choice').each(function() {
    if ($(this).data('youtube') == choice) {
      $(this).addClass('active');
    } else {
      $(this).removeClass('active');
    }
  });
}

var player;
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    events: {
      'onReady': onPlayerReady
    }
  });
}

function onPlayerReady(event) {
  var videos = $('.video-choice').map(function () {
    return $(this).data('youtube');
  });
  var choice = _.sample(videos);
  player.loadVideoById(choice, 8, 'large');
  setChoice(choice);
  event.target.playVideo();
}

$('a.video-choice').click(function() {
  if (player) {
    player.loadVideoById($(this).data('youtube'), 8, 'large');
    setChoice($(this).data('youtube'));
  }
});

// vim: ts=2:sw=2:et
