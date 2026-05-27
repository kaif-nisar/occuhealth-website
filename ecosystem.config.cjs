module.exports = {
  apps: [
    {
      // ==============================
      // Application Basic Config
      // ==============================
      name: "superadmin_lab",
      script: "app.js",
      cwd: "/home/opc/occuhealth",

      // ==============================
      // Process Management
      // ==============================
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,

      // ==============================
      // Memory & Performance
      // ==============================
      max_memory_restart: "1400M",
      node_args: "--max-old-space-size=1536 --expose-gc",

      // ==============================
      // Restart & Timeout Protection
      // ==============================
      kill_timeout: 15000,
      listen_timeout: 15000,
      restart_delay: 4000,
      min_uptime: "10s",
      max_restarts: 10,

      // ==============================
      // Environment Variables
      // ==============================
      env: {
        // ==========================
        // Server Config
        // ==========================
        PORT: 3000,
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=1024",

        // ==========================
        // MongoDB
        // ==========================
        MONGODB_URI:
          "mongodb+srv://ahadsidd5:Ahad9520@cluster0.uiadu.mongodb.net/franchisee_super_admin",

        // ==========================
        // JWT & Authentication
        // ==========================
        SUPER_ADMIN_ACCESS_TOKEN_SECRET:
          "7bc00781208fc79081f00b20fdc881c9be1452f9b631e93678d7f91d",

        SUPER_ADMIN_REFRESH_TOKEN_SECRET:
          "cfe7a393940642c3adbc7cd88854e8a5516f548e481068f4302e783f",

        ACCESS_TOKEN_EXPIRY: "1d",
        REFRESH_TOKEN_EXPIRY: "10d",

        // ==========================
        // Email Config
        // ==========================
        EMAIL_USER: "kaifquest786@gmail.com",
        EMAIL_PASS: "tbgljldaqkvzafvg",

        // ==========================
        // Cloudinary Config
        // ==========================
        CLOUDINARY_CLOUD_NAME: "dbpdu0lpg",
        CLOUDINARY_API_KEY: "684341464322826",
        CLOUDINARY_API_SECRET: "-eFiHPjuRigCGtNmRbmJCUrXaio",

        // ==========================
        // Razorpay Config
        // ==========================
        RAZORPAY_KEY_ID: "rzp_live_SspHMQOVPUtqkx",
        RAZORPAY_KEY_SECRET: "RF7VLwJsPYMhRg52qkSAOnio",
        RAZORPAY_WEBHOOK_SECRET: "whsec_test_1234567890",

        // ==========================
        // CORS
        // ==========================
        CORS_ORIGIN: "https://www.occuhealth.in",

        // ==========================
        // Performance Optimization
        // ==========================
        AUTH_CACHE_TTL_MS: "30000",
        SLOW_REQUEST_THRESHOLD_MS: "1200",

        // ==========================
        // PDF Optimization
        // ==========================
        PDF_QUEUE_CONCURRENCY: "2",
        PDF_RENDER_TASK_TIMEOUT_MS: "120000",
        PDF_CONTENT_LOAD_TIMEOUT_MS: "45000",
        PDF_MEMORY_CLEANUP_THRESHOLD_MB: "512",
        PDF_SECURE_RENDER_SCALE: "1.85",
      },

      // ==============================
      // Logging
      // ==============================
      out_file: "/home/ec2-user/occuhealth/logs/pm2-out.log",
      error_file: "/home/ec2-user/occuhealth/logs/pm2-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,
    },
  ],
};