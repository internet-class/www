$(function () {
  var fullscreen = function () {
    $("#fullscreen").css({
      width: $(window).width(),
      height: $(window).height()
    });
    var boxWidth = $("#title_box").width();
    $(".font-scale").each(function () {
      var textSize = parseInt($(this).data('font')) * (boxWidth / 1024);
      if (textSize < $(this).data('font-min')) {
        textSize = $(this).data('font-min');
      }
      $(this).css({ "font-size": textSize + "px" });
    });
  };
  fullscreen();
  $(window).resize(function () {
    fullscreen();
  });
  var setPaused = function (paused) {
    if (paused) {
      $("#play_button").css({ display: 'inline' });
      $("#pause_button").css({ display: 'none' });
    } else {
      $("#pause_button").css({ display: 'inline' });
      $("#play_button").css({ display: 'none' });
    }
  };
  var playPause = function () {
    var paused = $(this).attr('id') === 'pause';
    var video = $("video#background").get(0);
    if (paused) {
      video.pause();
    } else {
      video.play();
    }
  };
  var setMuted = function (muted) {
    if (muted) {
      $("#unmute_button").css({ display: 'inline' });
      $("#mute_button").css({ display: 'none' });
    } else {
      $("#mute_button").css({ display: 'inline' });
      $("#unmute_button").css({ display: 'none' });
    }
  };
  var muteUnmute = function () {
    var mute = $(this).attr('id') === 'mute';
    var video = $("video#background").get(0);
    if (mute) {
      $(video).prop('muted', true);
    } else {
      $(video).prop('muted', false);
    }
    setMuted(mute);
  };

  $("#play, #pause").click(playPause);
  $("#mute, #unmute").click(muteUnmute);

  var chooseVideo = function() {
    var video = $("video#background");
    var webm = document.createElement('source');
    webm.type = 'video/webm';
    var mp4 = document.createElement('mp4');
    mp4.type = 'video/mp4';
    if ($(window).width() > 800) {
      webm.src = '/img/background/large.webm';
      mp4.src = '/img/background/large.mp4';
    } else {
      webm.src = '/img/background/small.webm';
      mp4.src = '/img/background/small.mp4';
    }
    video.append(webm);
    video.append(mp4);
    video.load();
  };
  chooseVideo();

  window.setTimeout(function () {
    var video = $("video#background").get(0);
    setPaused(video.paused);
    video.addEventListener('play', function () {
      setPaused(false);
    }, false);
    video.addEventListener('pause', function () {
      setPaused(true);
    }, false);
    $("#play_button, #pause_button, #unmute_button, #mute_button").css({ visibility: 'visible' });

  }, 50);

  if ($(".login-link").length > 0) {
    var lock = new Auth0Lock('UwFsZjKr41IigcENM5hDiuQvxILo6CXu', 'internet-class.auth0.com', {
      auth: {
        redirectUrl: $('.login-link').first().data('redirect-url'),
        responseType: 'code',
        params: { scope: 'email' }
      }
    });
    $(".login-link").click(function () {
      lock.show();
    });
  }
});

// vim: ts=2:sw=2:et
