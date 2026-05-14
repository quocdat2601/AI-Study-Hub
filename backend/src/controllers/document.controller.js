async function placeholder(req, res, next) {
  try {
    res.json({ message: 'document module placeholder' });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeholder };
