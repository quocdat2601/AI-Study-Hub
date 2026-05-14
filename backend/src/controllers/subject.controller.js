async function placeholder(req, res, next) {
  try {
    res.json({ message: 'subject module placeholder' });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeholder };
