const Institute = require("../models/Institute");

/**
 * Middleware that resolves and enforces tenant (Institute) context.
 */
const resolveTenant = async (req, res, next) => {
  try {
    // 1. Authenticated user's instituteId is primary source of truth
    if (req.user && req.user.instituteId) {
      req.instituteId = req.user.instituteId;
    }

    // 2. Superadmin override (allows superadmin to view/manage a specific institute)
    if (req.user && req.user.role === "superadmin") {
      const explicitId = req.headers["x-institute-id"] || req.query.instituteId;
      if (explicitId) {
        req.instituteId = explicitId;
      }
    }

    // Helper method attached to request to easily generate scoped query filters
    req.tenantFilter = (additionalFilter = {}) => {
      // Superadmin with no explicit institute filter sees all
      if (req.user && req.user.role === "superadmin" && !req.instituteId) {
        return { ...additionalFilter };
      }

      if (!req.instituteId) {
        return { ...additionalFilter };
      }

      return {
        instituteId: req.instituteId,
        ...additionalFilter,
      };
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware requiring that a valid institute context exists for the request
 */
const requireTenant = (req, res, next) => {
  if (!req.instituteId && req.user?.role !== "superadmin") {
    return res.status(400).json({
      status: "error",
      message: "Institute context is required. Please ensure your account is linked to an institute.",
    });
  }
  next();
};

module.exports = {
  resolveTenant,
  requireTenant,
};
