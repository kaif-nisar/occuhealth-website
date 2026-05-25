import jwt from "jsonwebtoken";
import { asyncHandler } from "../src/utils/asyncHandler.js";
import { ApiError } from "../src/utils/apiError.js";
import { SuperAdmin } from "../src/models/superAdmin.model.js";
import { User } from "../src/models/user.model.js";

const AUTH_CACHE_TTL_MS = Math.max(5000, Number.parseInt(process.env.AUTH_CACHE_TTL_MS || "30000", 10));
const authCache = new Map();

const FULL_USER_SELECT = "-password -refreshToken";
const FULL_USER_POPULATE = [
  { path: "createdBy", select: "role tenantId fullName username pdfFormat permissions parentRole" },
  {
    path: "tenantId",
    select: "name modelType code status adminDetails subscriptionPlan logo",
    populate: {
      path: "adminDetails.userId",
      select: "fullName username role tenantId email pdfFormat",
    },
  },
];

const STATIC_USER_SELECT = "_id role parentRole permissions fullName username pdfFormat showprintsetting tenantId createdBy";
const SUPER_ADMIN_SELECT = "-password -refreshToken";
const STATIC_FILE_PATTERN = /\.(?:js|css|html|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map)$/i;

const getCacheKey = (kind, token) => `${kind}:${token}`;

const isCacheEntryFresh = (entry) => entry && entry.expiresAt > Date.now();

const getCachedValue = (kind, token) => {
  const entry = authCache.get(getCacheKey(kind, token));
  if (!isCacheEntryFresh(entry)) {
    if (entry) {
      authCache.delete(getCacheKey(kind, token));
    }
    return null;
  }
  return entry.value;
};

const setCachedValue = (kind, token, value) => {
  authCache.set(getCacheKey(kind, token), {
    value,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
  return value;
};

const extractAccessToken = (req) => {
  return req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
};

const decodeAccessToken = (token) => {
  return jwt.verify(token, process.env.SUPER_ADMIN_ACCESS_TOKEN_SECRET);
};

const fetchFullUserContext = async (userId) => {
  return await User.findById(userId)
    .select(FULL_USER_SELECT)
    .populate(FULL_USER_POPULATE)
    .lean();
};

const fetchStaticUserContext = async (userId) => {
  return await User.findById(userId)
    .select(STATIC_USER_SELECT)
    .lean();
};

const fetchSuperAdminContext = async (userId) => {
  return await SuperAdmin.findById(userId)
    .select(SUPER_ADMIN_SELECT)
    .lean();
};

const getUserContextFromCache = async (token, userId, kind, loader) => {
  const cached = getCachedValue(kind, token);
  if (cached) {
    return { value: cached, source: "cache" };
  }

  const loadedValue = await loader(userId);
  if (!loadedValue) {
    return null;
  }

  return {
    value: setCachedValue(kind, token, loadedValue),
    source: "database",
  };
};

const buildUnauthorizedResponse = (res, message) => {
  return res.status(401).json({
    success: false,
    message,
  });
};

const attachRequestUser = async (req, mode = "full") => {
  const token = extractAccessToken(req);
  if (!token) {
    return { error: "Access token is required" };
  }

  const decodedToken = decodeAccessToken(token);
  const cacheKind = mode === "static" ? "user-static" : "user-full";
  const loader = mode === "static" ? fetchStaticUserContext : fetchFullUserContext;
  const userContext = await getUserContextFromCache(token, decodedToken._id, cacheKind, loader);

  if (!userContext?.value) {
    return { error: "Invalid or expired token" };
  }

  req.user = userContext.value;
  req.authContextMode = mode;
  req.authCacheSource = userContext.source;

  if (global.performanceMetrics?.auth) {
    if (mode === "static") {
      global.performanceMetrics.auth.staticHits += 1;
    } else {
      global.performanceMetrics.auth.fullHits += 1;
    }
  }

  if (mode === "full" && STATIC_FILE_PATTERN.test(req.path || req.originalUrl || "")) {
    console.warn(`Performance guardrail: full auth context resolved for static asset ${req.originalUrl}`);
  }

  return { user: userContext.value };
};

export const clearAuthCache = () => {
  authCache.clear();
};

export const verifySuperAdmin = asyncHandler(async (req, res, next) => {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = decodeAccessToken(token);
    const superAdminContext = await getUserContextFromCache(token, decodedToken._id, "superadmin-full", fetchSuperAdminContext);

    if (!superAdminContext?.value) {
      throw new ApiError(401, "Invalid access token");
    }

    req.superAdmin = superAdminContext.value;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

export const verifyProtectedSuperAdminStatic = asyncHandler(async (req, res, next) => {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = decodeAccessToken(token);
    const superAdminContext = await getUserContextFromCache(token, decodedToken._id, "superadmin-static", fetchSuperAdminContext);

    if (!superAdminContext?.value) {
      throw new ApiError(401, "Invalid access token");
    }

    req.superAdmin = superAdminContext.value;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const { error } = await attachRequestUser(req, "full");

    if (error) {
      return buildUnauthorizedResponse(res, error);
    }

    next();
  } catch (error) {
    console.error("JWT Error:", error.message);
    return buildUnauthorizedResponse(res, "Unauthorized: Invalid or expired token");
  }
});

export const verifyProtectedStaticJWT = asyncHandler(async (req, res, next) => {
  try {
    const { error } = await attachRequestUser(req, "static");

    if (error) {
      return buildUnauthorizedResponse(res, error);
    }

    next();
  } catch (error) {
    console.error("Static JWT Error:", error.message);
    return buildUnauthorizedResponse(res, "Unauthorized: Invalid or expired token");
  }
});

export { verifyJWT };
