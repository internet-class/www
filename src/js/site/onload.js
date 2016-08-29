$(function () {
	$('.scrollspy').scrollSpy({
    scrollOffset: '250'
  });
  $('.toc-wrapper').pushpin({
    top: $('.toc-wrapper').offset().top
  });
});

// vim: ts=2:sw=2:et
