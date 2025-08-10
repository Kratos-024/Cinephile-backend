import { Router } from "express";
import {
  GetTrendingMovies,
  RefreshTrendingMovies,
  GetCacheStatus,
  GetMovieVideos,
  ClearMovieVideoCache,
  GetMovieVideoCacheStatus,
  cleanupExpiredVideoCache,
  getTMDbFromIMDb,
} from "../controllers/tmdb.controller.js";

const router = Router();

router.get("/trending/movies", GetTrendingMovies);
router.post("/trending/refresh", RefreshTrendingMovies);
router.get("/trending/cache/status", GetCacheStatus);
router.route("/videos/:movieId").get(GetMovieVideos);
router.get("/:movieId/videos/cache/status", GetMovieVideoCacheStatus);
router.delete("/:movieId/videos/cache", ClearMovieVideoCache);
router.route("/getid").get(getTMDbFromIMDb);

router.post("/admin/videos/cleanup-cache", async (req, res) => {
  try {
    await cleanupExpiredVideoCache();
    res.status(200).json({
      success: true,
      message: "Video cache cleanup completed",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cleanup video cache",
    });
  }
});
export default router;
