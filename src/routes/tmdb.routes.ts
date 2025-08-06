import { Router } from "express";
import GetMovieById from "../controllers/tmdb.controller.js";

const tmdbRouter = Router();
tmdbRouter.route("/getMovie").post(GetMovieById);
export default tmdbRouter;
