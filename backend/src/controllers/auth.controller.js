async function placeholder(req, res, next) {
  try {
    res.json({ message: 'auth module placeholder' });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeholder };
