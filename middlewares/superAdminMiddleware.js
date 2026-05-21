// superAdminMiddleware.js
import { asyncHandler } from "../src/utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { SuperAdmin } from "../src/models/superAdmin.model.js";

export const verifySuperAdmin = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            console.log("No token found, Unauthorized access");
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized access" 
            });
        }
        // Decode the token
        const decodedToken = jwt.verify(token, process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET);

        console.log("decodedToken",decodedToken)
        // console.log("Decoded token:", decodedToken);
        if (!decodedToken._id || decodedToken.role !== "superAdmin") {
            console.log("Access forbidden: Role is not superAdmin");
            return res.status(403).json({ 
                success: false,
                message: "Access forbidden: Super Admins only" 
            });
        }

        // Fetch superAdmin from the database (optional: you can skip this step if it's already decoded in token)
        const superAdmin = await SuperAdmin.findById(decodedToken._id).select("-password -refreshToken");

        if (!superAdmin) {
            console.log("Super Admin not found in DB");
            return res.status(401).json({
                success: false,
                message: "Invalid token or Super Admin not found"
            });
        }
        req.user = superAdmin;
        console.log("req.user",req.user)
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        console.error("Error in verifying Super Admin:", error);
        return res.status(401).json({
            success: false,
            message: "Invalid token or session expired"
        });
    }
});

