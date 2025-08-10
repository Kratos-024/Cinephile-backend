import { Router } from "express";
import {
  GetTrendingMovies,
  GetMovieData,
} from "../controllers/tmdb.controller.js";

const router = Router();

router.route("/trending/movies").get(GetTrendingMovies);
router.route("/moviesdata/data/").post(GetMovieData);

export default router;
