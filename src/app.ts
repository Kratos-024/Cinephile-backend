import express from "express";
import cors from "cors";
import omdbRouter from "./routes/omdb.routes.js";
import tmdbRouter from "./routes/tmdb.routes.js";
import userRouter from "./routes/user.routes.js";
import cornRouter from "./routes/cornjob.route.js";

const app = express();

// CORS configuration
app.use(
  cors({
    origin: [
      "https://cinephile-frontend.vercel.app",
      "https://cinephile-frontend-hk41kv2lb-klatosthgos-024s-projects.vercel.app/",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static("public"));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint - Comprehensive
app.get("/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    port: process.env.PORT || 8000,
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
      heapTotal:
        Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      heapUsed:
        Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      external:
        Math.round(process.memoryUsage().external / 1024 / 1024) + " MB",
      arrayBuffers:
        Math.round(process.memoryUsage().arrayBuffers / 1024 / 1024) + " MB",
    },
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "not set",
      skipDownload: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD || "false",
    },
  };

  try {
    res.status(200).json(healthCheck);
  } catch (error) {
    const errorResponse = {
      ...healthCheck,
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(503).json(errorResponse);
  }
});

// Simple ping endpoint for quick checks
app.get("/ping", (req, res) => {
  res.status(200).json({
    status: "pong",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// Root endpoint with API information
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Cinephile Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      ping: "/ping",
      omdb: "/api/v1/omdb",
      tmdb: "/api/v1/tmdb",
      user: "/api/v1/user",
      corn: "/api/v1/corn",
    },
    documentation: {
      health: "GET /health - Comprehensive health check",
      ping: "GET /ping - Simple ping response",
    },
  });
});

// API Routes
app.use("/api/v1/omdb/", omdbRouter);
app.use("/api/v1/tmdb/", tmdbRouter);
app.use("/api/v1/user/", userRouter);
app.use("/api/v1/corn/", cornRouter);

// 404 handler for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "GET /",
      "GET /health",
      "GET /ping",
      "* /api/v1/omdb/*",
      "* /api/v1/tmdb/*",
      "* /api/v1/user/*",
      "* /api/v1/corn/*",
    ],
  });
});

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error handler caught:", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    // Don't expose sensitive error details in production
    const errorResponse = {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : err.message,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    };

    res.status(err.status || 500).json(errorResponse);
  }
);

export default app;
