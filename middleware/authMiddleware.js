'use strict';
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || 'swpi-production-secret-2026';

// Base authentication — verifies token is valid and not expired
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = {
      id: decoded.id,
      academy_id: decoded.academy_id ?? decoded.school_id ?? null,
      role: decoded.role || 'coach',
      email: decoded.email || ''
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    console.warn("Security Block: Invalid token attempt.");
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Role enforcement — place AFTER authenticate on any route
const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== 'admin') {
    console.warn(`Access denied: User ${req.user.email} (role: ${req.user.role}) attempted admin action.`);
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const requireCoachOrAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const allowed = ['admin', 'coach'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireCoachOrAdmin };