import express from "express";
import cors from "cors";
import omdbRouter from "./routes/omdb.routes.js";
import tmdbRouter from "./routes/tmdb.routes.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({}));
app.use(express.static("public"));
app.use("/api/v1/omdb/", omdbRouter);
app.use("/api/v1/tmdb/", tmdbRouter);

export default app;
