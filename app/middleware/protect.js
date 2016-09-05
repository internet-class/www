module.exports = function(req, res, next) {
	if (!req.isAuthenticated()) {
		return res.redirect('/login?returnTo=' + req.originalUrl);
	}
	next();
}
