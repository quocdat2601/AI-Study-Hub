async function placeholder(req, res, next) {
  try {
    res.json({ message: 'dashboard module placeholder' });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeholder };
