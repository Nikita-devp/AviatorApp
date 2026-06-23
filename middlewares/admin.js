module.exports = function admin(req, res, next) {
  if (req.tokenData.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  next();
};