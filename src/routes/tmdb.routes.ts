import { Router } from "express";
import {
  GetTrendingMovies,
  GetMovieData,
  GetMovieReviews,
} from "../controllers/tmdb.controller.js";

const router = Router();

router.route("/trending/movies").get(GetTrendingMovies);
router.route("/moviesdata/:imdbId").get(GetMovieData);
router.route("/moviesdata/reviews/:imdbId").get(GetMovieReviews);

export default router;
