var onPlayerStateChange = function (event, player) {
	console.log(player.getVideoData());
	console.log("State changed: " + event.data);
}

var infoById = {};
var trackVideoDefaults = {
	debug: true
}
var trackVideo = function (player, options) {
	options = _.extend((options || {}), trackVideoDefaults);
	if (options.debug) {
		console.log("Tracker loaded.");
	}
	player.addEventListener('onStateChange', function (event) {
		return onPlayerStateChange(event, player);
	});
}
