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
  }
  fullscreen();
  $(window).resize(function () {
    fullscreen();
  });
  window.setTimeout(function () {
    var video = $("video#background");
    if ($(video).get(0).paused) {
      $("#play_button").css({ display: 'inline' });
      $("#pause_button").css({ display: 'none' });
    } else {
      $("#pause_button").css({ display: 'inline' });
      $("#play_button").css({ display: 'none' });
    }
    $("#play_button, #pause_button").css({ visibility: 'visible' });
  }, 100);
});

// vim: ts=2:sw=2:et
