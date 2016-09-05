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
  if ($("#login-form").length > 0) {
    var lock = new Auth0Lock('UwFsZjKr41IigcENM5hDiuQvxILo6CXu', 'internet-class.auth0.com', {
      container: 'login-form',
      auth: {
        redirectUrl: $('#login-form').data('redirect-url'),
        responseType: 'code',
        params: { scope: 'email' }
      }
    });
    lock.show();
  }
});

// vim: ts=2:sw=2:et
