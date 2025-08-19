import express from "express";
import cors from "cors";
import omdbRouter from "./routes/omdb.routes.js";
import tmdbRouter from "./routes/tmdb.routes.js";
import userRouter from "./routes/user.routes.js";
import cornRouter from "./routes/cornjob.route.js";

const app = express();

app.use(
  cors({
    origin: [
      "https://cinephile-frontend.vercel.app",
      "https://cinephile-frontend-hk41kv2lb-klatosthgos-024s-projects.vercel.app/",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Health check endpoint
app.get("/health", (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
      heapTotal:
        Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      heapUsed:
        Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      external:
        Math.round(process.memoryUsage().external / 1024 / 1024) + " MB",
    },
  };

  try {
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.message = "ERROR";
    //@ts-ignore

    healthCheck.error = error.message;
    res.status(503).json(healthCheck);
  }
});

// Simple ping endpoint for quick health checks
app.get("/ping", (req, res) => {
  res.status(200).json({ status: "pong", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/v1/omdb/", omdbRouter);
app.use("/api/v1/tmdb/", tmdbRouter);
app.use("/api/v1/user/", userRouter);
app.use("/api/v1/corn/", cornRouter);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Cinephile API is running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      ping: "/ping",
      omdb: "/api/v1/omdb",
      tmdb: "/api/v1/tmdb",
      user: "/api/v1/user",
      corn: "/api/v1/corn",
    },
  });
});

// 404 handler - Fixed for Express 5.x compatibility
app.use("/*path", (req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});
//@ts-ignore
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? {} : err.stack,
    timestamp: new Date().toISOString(),
  });
});

export default app;
