function flush(config) {
  return function(files, metalsmith, done) {
    for (var file in files) {
      delete(files[file]);
    }
    done();
  }
}
exports = module.exports = flush
