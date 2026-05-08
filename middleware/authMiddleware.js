// middleware/authMiddleware.js
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
    // We use a fallback secret for local dev, but Render will use process.env.JWT_SECRET
    const secret = process.env.JWT_SECRET || 'swpi_super_secret_dev_key_2026';
    const decoded = jwt.verify(token, secret);

    // CRITICAL FIX: Ensure these match your database schema exactly
    req.user = {
      id: decoded.id,
      academy_id: decoded.academy_id || decoded.school_id, // Safety catch in case old tokens use school_id
      role: decoded.role 
    };

    next();
  } catch (err) {
    console.warn("Security Block: Invalid or Expired Token Attempted.");
    return res.status(401).json({ error: "Invalid token" });
  }
};