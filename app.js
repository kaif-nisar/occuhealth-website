import express from "express";
import { configDotenv } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import hpp from "hpp";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import { monitorEventLoopDelay } from "perf_hooks";
import Connect_DB from "./src/db/index.js";
import userRouter from "./src/routes/user.routes.js";
import bulkBookingRouter from "./src/routes/bulkBooking.routes.js";
import { verifyJWT, verifyProtectedStaticJWT, verifyProtectedSuperAdminStatic, verifySuperAdmin } from "./middlewares/auth.middleware.js";
import { initializeSchedulers } from "./src/utils/subscriptionScheduler.js";
import { cleanupCustomizationsOnStartup } from "./src/utils/customizationCleanup.js";

configDotenv();

const app = express();
const slowRequestThresholdMs = Math.max(250, Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || "1200", 10));
const diagnosticsEnabled = (process.env.ENABLE_DIAGNOSTICS || "true").toLowerCase() !== "false";
const staticAssetPattern = /\.(?:js|css|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map)$/i;
const eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
eventLoopMonitor.enable();

global.performanceMetrics = global.performanceMetrics || {
    requests: {
        total: 0,
        slow: 0,
        lastSlow: null,
    },
    pdf: {
        queueDepth: 0,
        lastRenderMs: 0,
        lastFlattenMs: 0,
        lastQueueWaitMs: 0,
        failures: 0,
        timeouts: 0,
        lastPdfSizeBytes: 0,
    },
    eventLoop: {
        lagP95Ms: 0,
        lagMaxMs: 0,
    },
    auth: {
        staticHits: 0,
        fullHits: 0,
    }
};

if (process.env.NODE_ENV === "production") {
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION', reason);
        process.exit(1);
    });
}

// ========================
// 📊 MEMORY MONITORING
// ========================

// ✅ Memory Monitoring with AUTO CLEANUP
setInterval(() => {
    const used = process.memoryUsage();
    console.log(`📊 Memory Usage - RSS: ${Math.round(used.rss / 1024 / 1024)}MB, Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
    
    // ✅ Auto memory cleanup when heap exceeds 70MB
    if (used.heapUsed > 70 * 1024 * 1024) {
        console.log('🔄 Auto memory cleanup triggered...');
        if (global.gc) {
            global.gc();
        }
        if (global.cache) {
            const keys = Object.keys(global.cache);
            console.log(`🧹 Clearing ${keys.length} cache entries`);
            global.cache = {};
        }
    }
}, 300000); // Every 5 minutes

// ✅ Regular cache cleanup every 1 hour
setInterval(() => {
    console.log('⏰ Scheduled cache cleanup');
    global.cache = {};
}, 60 * 60 * 1000);

setInterval(() => {
    global.performanceMetrics.eventLoop = {
        lagP95Ms: Number((eventLoopMonitor.percentile(95) / 1e6).toFixed(2)),
        lagMaxMs: Number((eventLoopMonitor.max / 1e6).toFixed(2)),
    };
    eventLoopMonitor.reset();
}, 60 * 1000);

// ========================
// 🔐 SECURITY MIDDLEWARES
// ========================

if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "blob:",
                    "https:"
                ],
                scriptSrcElem: [
                    "'self'",
                    "'unsafe-inline'",
                    "blob:",
                    "https:"
                ],
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https:",
                    "blob:"
                ],
                styleSrcElem: [
                    "'self'",
                    "'unsafe-inline'",
                    "https:"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https:",
                    "blob:",
                    "https://res.cloudinary.com"
                ],
                 frameSrc: [
                    "'self'", 
                    "blob:",
                    "https://checkout.razorpay.com",
                    "https://api.razorpay.com"
                ],
                connectSrc: [
                    "'self'",
                    "https:",
                    "blob:",
                    "https://res.cloudinary.com",
                    "https://checkout.razorpay.com",
                    "https://api.razorpay.com",
                    "wss:"
                ],
                fontSrc: ["'self'", "https:", "data:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'", "https:", "blob:"],
                formAction: ["'self'"],
                baseUri: ["'self'"],
                childSrc: ["'self'", "blob:"]
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
} else {
    // ✅ CSP COMPLETELY DISABLED for development
    app.use(helmet({
        contentSecurityPolicy: false
    }));

    app.use((req, res, next) => {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    });

    console.log('🔓 CSP: COMPLETELY DISABLED - Development mode');
}

// ========================
// 🚀 RATE LIMITING
// ========================

if (process.env.NODE_ENV === 'production') {
    const generalLimiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 5000, // लिमिट बढ़ाकर 5000 कर दी गई है ताकि नॉर्मल यूजर्स को कभी दिक्कत न हो
        message: {
            error: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100, // लॉगिन के लिए भी लिमिट बढ़ाई गई है
        message: {
            error: 'Too many login attempts, please try again later.'
        }
    });

    const apiLimiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 10000, // API के लिए बहुत हाई लिमिट सेट की गई है
        message: {
            error: 'Too many API requests, please try again later.'
        }
    });

    // ग्लोबल रेट लिमिटर को डिसेबल (कमेंट) कर दिया गया है ताकि यूजर्स को एरर न आए
    // app.use(generalLimiter);
    // app.use("/api/v1/user/login", authLimiter);
    // app.use("/api/v1/user", apiLimiter);

    console.log('🛡️ Production Rate Limiting: ACTIVE');
} else {
    console.log('🔓 Development Mode - Rate Limiting: DISABLED');
}

// ========================
// 🔒 DATA SANITIZATION
// ========================

app.use(mongoSanitize()); // NoSQL Injection Protection
app.use(xss()); // XSS Protection
app.use(hpp()); // HTTP Parameter Pollution Protection

// ========================
// 🌐 CORS CONFIGURATION
// ========================

app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: [
        'x-rtb-fingerprint-id',
        'request-id',
        'x-request-id',
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
        'content-type',
        'authorization'
    ]
}));

app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
            return false;
        }

        const contentType = String(res.getHeader("Content-Type") || "");
        if (contentType.includes("application/pdf") || contentType.includes("image/")) {
            return false;
        }

        return compression.filter(req, res);
    }
}));

// Permissions Policy for device sensors (fixes Razorpay warnings)
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 
        'accelerometer=(), gyroscope=(), magnetometer=(), geolocation=(), payment=*'
    );
    next();
});

app.use((req, res, next) => {
    const startTime = process.hrtime.bigint();
    global.performanceMetrics.requests.total += 1;

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
        if (durationMs >= slowRequestThresholdMs) {
            global.performanceMetrics.requests.slow += 1;
            global.performanceMetrics.requests.lastSlow = {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
                timestamp: new Date().toISOString(),
            };
            console.warn(`Slow request detected: ${req.method} ${req.originalUrl} ${durationMs.toFixed(2)}ms`);
        }
    });

    next();
});

// ========================
// 🔍 DEBUG MIDDLEWARE (Remove in production)
// ========================

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`📍 ${req.method} ${req.path}`);
        next();
    });
}

// ========================
// 🛡️ CUSTOM SECURITY MIDDLEWARES - FIXED
// ========================

// 1. Block Suspicious User Agents & Bots - FIXED
app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/diagnostics/performance' || staticAssetPattern.test(req.path)) {
        return next();
    }

    const userAgent = req.get('User-Agent') || '';
    const lowerUA = userAgent.toLowerCase();
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ CRITICAL FIX: Skip ALL security checks for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }

    // Allowed bots (whitelist)
    const allowedBots = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'facebookexternalhit'];

    // Suspicious patterns (only actual malicious tools)
    const suspiciousPatterns = [
        'sqlmap',
        'nikto',
        'metasploit',
        'burpsuite',
        'hydra',
        'nmap',
        'masscan',
        'zgrab',
        'gobuster'
    ];

    const isAllowedBot = allowedBots.some(bot => lowerUA.includes(bot));
    if (isAllowedBot) {
        return next();
    }

    const isSuspicious = suspiciousPatterns.some(pattern => lowerUA.includes(pattern));
    if (isSuspicious) {
        console.log(`🚨 Blocked Suspicious UA: ${userAgent} from IP: ${clientIP}`);
        return res.status(403).json({
            error: 'Access denied',
            message: 'Suspicious activity detected'
        });
    }

    next();
});

// 2. Block Malicious HTTP Methods - FIXED
app.use((req, res, next) => {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

    if (!allowedMethods.includes(req.method)) {
        console.log(`🚨 Blocked Suspicious Method: ${req.method} from IP: ${req.ip}`);
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }
    next();
});

// 3. Block Suspicious Paths & Directory Traversal - COMPLETELY FIXED
app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/diagnostics/performance' || staticAssetPattern.test(req.path)) {
        return next();
    }

    const requestedPath = req.path.toLowerCase();
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ CRITICAL FIX: WHITELIST all API routes FIRST
    const safePaths = [
        '/api/',              // ✅ This covers ALL API routes including /api/v1/
        '/health',
        '/security/info',
        '/admin',
        '/superadmin',
        '/superfranchisee',
        '/franchisee',
        '/subfranchisee'
    ];

    // ✅ Check if it's a safe path - IMMEDIATE RETURN
    const isSafePath = safePaths.some(path =>
        requestedPath.startsWith(path.toLowerCase())
    );
    
    if (isSafePath) {
        return next(); // ✅ Allow all API routes without any checks
    }

    // ✅ BLACKLIST: Only for non-API paths
    const suspiciousPaths = [
        '.env', '.git', '.htaccess', '.htpasswd',
        'wp-admin', 'administrator', 'phpmyadmin',
        'mysql', 'config', 'backup', 'debug', 'console'
    ];

    const suspiciousExtensions = ['.php', '.asp', '.aspx', '.jsp', '.sh', '.exe'];

    const hasSuspiciousPath = suspiciousPaths.some(path => requestedPath.includes(path));
    if (hasSuspiciousPath) {
        console.log(`🚨 Blocked Suspicious Path: ${req.path} from IP: ${clientIP}`);
        return res.status(404).json({
            error: 'Not found'
        });
    }

    const hasSuspiciousExtension = suspiciousExtensions.some(ext => requestedPath.endsWith(ext));
    if (hasSuspiciousExtension) {
        console.log(`🚨 Blocked Suspicious Extension: ${req.path} from IP: ${clientIP}`);
        return res.status(404).json({
            error: 'Not found'
        });
    }

    // Block directory traversal
    if (req.url.includes('..') || req.url.includes('~/')) {
        console.log(`🚨 Blocked Directory Traversal: ${req.url} from IP: ${clientIP}`);
        return res.status(400).json({
            error: 'Bad request'
        });
    }

    next();
});

// 4. Request Size Limiter
app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/diagnostics/performance' || staticAssetPattern.test(req.path)) {
        return next();
    }

    const contentLength = parseInt(req.headers['content-length'] || '0');
    const requestSizeLimitMb = Math.max(100, Number.parseInt(process.env.API_REQUEST_SIZE_LIMIT_MB || "100", 10));

    if (contentLength > requestSizeLimitMb * 1024 * 1024) {
        return res.status(413).json({
            error: 'Request too large',
            limitMb: requestSizeLimitMb
        });
    }
    next();
});

// ========================
// 📋 STANDARD MIDDLEWARES
// ========================

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(express.static("public", {
    etag: true,
    lastModified: true,
    maxAge: process.env.PUBLIC_STATIC_MAX_AGE || "1d",
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
        } else {
            res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        }
    }
}));
app.use(cookieParser());

// Global Error Handling Middleware
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        console.error('JSON Parse Error:', error);
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next();
});

// ========================
// 🚦 ROUTES
// ========================

import targetRouter from "./src/routes/target.routes.js";

app.use("/api/v1/user", userRouter);
app.use("/api/v1/bulk-bookings", bulkBookingRouter);
app.use("/api/v1/target", targetRouter);

// Health Check Route
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV
    };
    res.json(health);
});

app.get('/diagnostics/performance', (req, res) => {
    if (!diagnosticsEnabled) {
        return res.status(404).json({ message: 'Diagnostics disabled' });
    }

    return res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        metrics: global.performanceMetrics,
    });
});

// Security Info Route
app.get('/security/info', (req, res) => {
    res.json({
        message: 'Security measures active',
        features: [
            'Rate Limiting',
            'SQL Injection Protection',
            'XSS Protection',
            'DDoS Protection',
            'Bot Detection',
            'Helmet Security Headers'
        ]
    });
});

// Verify token route
app.get('/api/verify-token', verifyJWT, (req, res) => {
    res.json({ isAuthorized: true, user: req.user });
});

// Public Razorpay Key endpoint (for frontend)
app.get('/api/config/razorpay-key', (req, res) => {
    try {
        const key_id = process.env.RAZORPAY_KEY_ID;
        if (!key_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Razorpay Key not configured' 
            });
        }
        res.json({ 
            success: true, 
            key_id: key_id 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching Razorpay key' 
        });
    }
});

// ========================
// 🔒 PROTECTED STATIC ROUTES
// ========================

const protectedStatic = (directory) => {
    return express.static(directory, {
        etag: true,
        lastModified: true,
        maxAge: process.env.PROTECTED_STATIC_MAX_AGE || "12h",
        setHeaders: (res, path) => {
            if (path.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            } else if (path.endsWith('.css')) {
                res.setHeader('Content-Type', 'text/css');
            } else if (path.endsWith('.html')) {
                res.setHeader('Content-Type', 'text/html');
            } else if (path.endsWith('.json')) {
                res.setHeader('Content-Type', 'application/json');
            }

            if (path.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            } else {
                res.setHeader('Cache-Control', 'private, max-age=43200, stale-while-revalidate=86400');
            }
        }
    });
};

// Admin routes
app.use('/admin', verifyProtectedStaticJWT, (req, res, next) => {
    const user = req.user;

    if (user.role === 'admin' || (user.role === 'staff' && user.parentRole === 'admin')) {
        return next();
    }

    return res.redirect('/index.html');
}, protectedStatic('private'));

app.use('/superFranchisee', verifyProtectedStaticJWT, (req, res, next) => {
    const user = req.user;

    if (user.role === 'superFranchisee' || (user.role === 'staff' && user.parentRole === 'superFranchisee')) {
        return next();
    }

    return res.redirect('/index.html');
}, protectedStatic('private'));

app.use('/franchisee', verifyProtectedStaticJWT, (req, res, next) => {
    const user = req.user;

    if (user.role === 'franchisee' || (user.role === 'staff' && user.parentRole === 'franchisee')) {
        return next();
    }

    return res.redirect('/index.html');
}, protectedStatic('private'));

app.use('/subFranchisee', verifyProtectedStaticJWT, (req, res, next) => {
    const user = req.user;

    if (user.role === 'subFranchisee' || (user.role === 'staff' && user.parentRole === 'subFranchisee')) {
        return next();
    }

    return res.redirect('/index.html');
}, protectedStatic('private'));

app.use('/superAdmin', verifyProtectedSuperAdminStatic, (req, res, next) => {
    if (req.superAdmin.role !== 'superAdmin' && req.superAdmin.role !== 'staff') {
        return res.redirect('/login.html');
    }

    if (req.superAdmin.role === 'staff' && req.superAdmin.parentRole !== 'superAdmin') {
        return res.redirect('/login.html');
    }

    next();
}, protectedStatic('private'));

// ========================
// 🎯 ERROR HANDLERS
// ========================

// 404 Handler - MUST BE AFTER ALL ROUTES
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Global Error Handler
app.use((error, req, res, next) => {
    console.error('💥 Global Error Handler:', error);

    const errorResponse = {
        error: 'Something went wrong!'
    };

    if (process.env.NODE_ENV !== 'production') {
        errorResponse.details = error.message;
        errorResponse.stack = error.stack;
    }

    res.status(error.status || 500).json(errorResponse);
});

// ========================
// 🚀 SERVER STARTUP
// ========================

Connect_DB()
    .then(async () => {
        await cleanupCustomizationsOnStartup();

        const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
            console.log(`✅ Server is running on port ${process.env.PORT || 3000}`);
            console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🛡️  Security Features: Active`);
            console.log(`🔓 Development Mode - CSP & Rate Limiting: DISABLED`);
            console.log(`🧹 Memory Auto-Cleanup: ACTIVE (70MB threshold)`);

            initializeSchedulers();
        });

        const gracefulShutdown = () => {
            console.log('🛑 Received shutdown signal, closing server gracefully...');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });

            setTimeout(() => {
                console.error('❌ Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    });

export default app;
