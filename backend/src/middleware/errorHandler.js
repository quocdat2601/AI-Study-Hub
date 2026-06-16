function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.statusCode || 500;
  const message = err.publicMessage || 'Internal server error';

  if (err.responseBody) {
    return res.status(status).json(err.responseBody);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
