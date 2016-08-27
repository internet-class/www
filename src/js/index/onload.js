$(function () {
  var fullscreen = function () {
    $("#hero").css({
      width: $(window).width(),
      height: $(window).height() - $("nav").height()
    });
    var boxWidth = $("#hero .container").width();
    $("#title .font-scale").each(function () {
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
});
// vim: ts=2:sw=2:et
