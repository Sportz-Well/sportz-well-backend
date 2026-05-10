'use strict';
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  try {
    const secret = process.env.JWT_SECRET || 'swpi-production-secret-2026';
    const decoded = jwt.verify(token, secret);

    req.user = {
      id: decoded.id,
      academy_id: decoded.academy_id || decoded.school_id,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.warn("Security Block: Invalid or Expired Token Attempted.");
    return res.status(401).json({ error: "Invalid token" });
  }
};