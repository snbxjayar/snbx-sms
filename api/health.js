module.exports = (req, res) => {
  res.json({ status: "ok", app: "SNBXSF SMS", mode: "two-way", timestamp: new Date().toISOString() });
};
