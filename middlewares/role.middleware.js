// Middleware to check if the user has the required role
export const authorizeRoles = (allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: "Unauthorized request" });
        }

        // Check if user's role is in the allowed roles list
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "You don't have permission to access this resource" });
        }

        next();
    };
};

export const adminOnly = async (req, res, next) => {
    console.log("Admin access check");
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access forbidden: Admins only' });
    }
    next();
};

// Middleware to check if staff has specific permissions
export const checkStaffPermission = (permission) => {
    return async (req, res, next) => {        
        // Skip permission check for non-staff roles
        if (req.user.role !== "staff") {
            return next();
        }

        // For staff role, check if they have the required permission
        if (!req.user.permissions || !req.user.permissions[permission]) {
            return res.status(403).json({ message: "You don't have permission to perform this action" });
        }

        next();
    };
};
