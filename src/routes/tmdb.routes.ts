import { Router } from "express";
import {
  GetTrendingMovies,
  RefreshTrendingMovies,
  GetCacheStatus,
} from "../controllers/tmdb.controller.js";

const tmdbRouter = Router();

tmdbRouter.route("/trending/movies").get(GetTrendingMovies);
tmdbRouter.route("/trending/refresh").post(RefreshTrendingMovies);
tmdbRouter.route("/trending/status").get(GetCacheStatus);

export default tmdbRouter;
