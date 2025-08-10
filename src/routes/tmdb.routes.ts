import { Router } from "express";
import {
  GetTrendingMovies,
  GetMovieData,
  GetMovieTrailer,
} from "../controllers/tmdb.controller.js";

const router = Router();

router.route("/trending/movies").get(GetTrendingMovies);
router.route("/moviesdata/:imdbId").get(GetMovieData);
router.route("/moviesdata/trailer/").post(GetMovieTrailer);

export default router;
