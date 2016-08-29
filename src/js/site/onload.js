$(function () {
	$('.scrollspy').scrollSpy({
    scrollOffset: '200'
  });
  $('.toc-wrapper').pushpin({
    top: $('.toc-wrapper').offset().top
  });
  
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
  
  var throbbers = {};
  $('.lazy-iframe').each(function() {
    var waypoint = new Waypoint.Inview({
      element: $(this)[0],
      enter: function(direction) {
        var elem = $("#" + this.element.id);
        var iframeID = this.element.id + '_iframe';
        var parentDiv = $(elem).closest('div.video-container');
        var width = $(parentDiv).outerWidth();
        var height = $(parentDiv).outerHeight();
        if (width > 0 && height > 0) {
          var size = width / 5;
          if (height / 5 < size) {
            size = height / 5;
          }
          var throb = Throbber({
            color: 'black',
            size: size,
            fallback: '/img/ajax-loader.gif'
          });
          throb.appendTo($(parentDiv).get(0));
          var canvas = $(parentDiv).find('canvas').first();
          $(canvas).css('margin-left', 'auto');
          $(canvas).css('margin-right', 'auto');
          $(canvas).css('margin-top', (height - size) / 2 + 'px');
          throbbers[iframeID] = throb;
          throb.start();
        }
        $(elem).replaceWith('<iframe id="' + iframeID +
            '" src="' + $(elem).data("src") + '" allowfullscreen></iframe>');
        $('#' + iframeID).on("load", function() {
          if (throbbers[$(this).attr('id')]) {
            throbbers[$(this).attr('id')].stop();
          }
        });
        this.destroy();
      }
    });
  });
});

// vim: ts=2:sw=2:et
