var extend = require('lodash.assign')

function createMiddleware(server, app, opts) {

	var shuttingDown = false, options = extend({ logger: console , forceTimeout: 30000 }, opts)
	
	process.on('SIGTERM', gracefulExit)

	function gracefulExit() {
		if (!process.env.NODE_ENV) {
			app.get('db').close();
			return process.exit(1);
		}
		if (shuttingDown) {
			return;
		}

		shuttingDown = true
		options.logger.warn('Received kill signal (SIGTERM), shutting down')

		setTimeout(function () {
			options.logger.error('Could not close connections in time, forcefully shutting down')
			process.exit(1)
		}, options.forceTimeout)
		
		app.get('db').close();
		server.close(function () {
			options.logger.info('Closed out remaining connections.')
			process.exit()
		})
	}

	function middleware(req, res, next) {
		if (!shuttingDown) {
			return next();
		}
		res.set('Connection', 'close')
		res.status(503).send('Server is in the process of restarting.')
	}

	return middleware
}

module.exports = createMiddleware

// vim: ts=2:sw=2:et
