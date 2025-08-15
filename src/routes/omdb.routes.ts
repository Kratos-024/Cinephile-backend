import { Router } from "express";
import {
  GetMovieById,
  StoreMovieInFirebase,
  GetCachedMovies,
  ClearMovieCache,
  GetMovieByTitleResponse,
  GetMoviesByTitleResponse,
} from "../controllers/omdb.controller.js";
import { authenticateUser } from "../middlewares/auth.middleware.js";

const omdbRouter = Router();

omdbRouter.route("/getMovieByTitle/:title").get(GetMovieByTitleResponse);
omdbRouter.route("/getMoviesByTitle/:title").get(GetMoviesByTitleResponse);

omdbRouter.route("/getMovie").post(GetMovieById);
omdbRouter.route("/storeMovie").post(StoreMovieInFirebase);
omdbRouter.route("/cachedMovies").get(authenticateUser, GetCachedMovies);
omdbRouter.route("/clearCache/:title/:page").delete(ClearMovieCache);
omdbRouter.route("/clearCache/:title").delete(ClearMovieCache);

export default omdbRouter;
