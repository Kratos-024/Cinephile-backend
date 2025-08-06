import express from "express";
import tmdbRouter from "./routes/tmdb.routes.js";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({}));
app.use(express.static("public"));
app.use("/api/v1/tmdb/", tmdbRouter);

export default app;
