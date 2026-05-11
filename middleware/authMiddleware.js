'use strict';
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || 'swpi-production-secret-2026';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = {
      id:         decoded.id || null,
      academy_id: decoded.academy_id ?? decoded.school_id ?? null,
      role:       decoded.role || 'coach',
      email:      decoded.email || ''
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    console.warn(`Security Block: Invalid token from IP ${req.ip}`);
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== 'admin') {
    console.warn(`Access denied: ${req.user.email} (${req.user.role}) attempted admin action on ${req.path}`);
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const requireCoachOrAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!['admin', 'coach', 'head_coach'].includes(req.user.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireCoachOrAdmin };