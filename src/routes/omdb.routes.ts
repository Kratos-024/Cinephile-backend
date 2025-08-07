import { Router } from "express";
import {
  GetMovieByTitle,
  GetMovieById,
  StoreMovieInFirebase,
  GetCachedMovies,
  ClearMovieCache,
} from "../controllers/omdb.controller.js";

const omdbRouter = Router();

omdbRouter.route("/getMovieByTitle").get(GetMovieByTitle);
omdbRouter.route("/getMovie").post(GetMovieById);
omdbRouter.route("/storeMovie").post(StoreMovieInFirebase);
omdbRouter.route("/cachedMovies").get(GetCachedMovies);
omdbRouter.route("/clearCache/:title/:page").delete(ClearMovieCache);
omdbRouter.route("/clearCache/:title").delete(ClearMovieCache);

export default omdbRouter;
