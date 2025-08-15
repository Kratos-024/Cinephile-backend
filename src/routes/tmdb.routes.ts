import { Router } from "express";
import {
  GetTrendingMovies,
  GetMovieData,
  GetMovieReviews,
  getSimilarMovies,
} from "../controllers/tmdb.controller.js";
import { authenticateUser } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/trending/movies").get(GetTrendingMovies);
router.route("/moviesdata/:imdbId").get(GetMovieData);
router.route("/moviesdata/reviews/:imdbId").get(GetMovieReviews);
router
  .route("/getSimilarMovies/:title")
  .get(authenticateUser, getSimilarMovies);

export default router;
