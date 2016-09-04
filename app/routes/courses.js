var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/fys', function(req, res, next) {
  res.render('nah');
});

exports.router = router;
