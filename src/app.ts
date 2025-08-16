import express from "express";
import cors from "cors";
import omdbRouter from "./routes/omdb.routes.js";
import tmdbRouter from "./routes/tmdb.routes.js";
import userRouter from "./routes/user.routes.js";
import cornRouter from "./routes/cornjob.route.js";

const app = express();
app.use(
  cors({
    origin: ["https://cinephile-frontend.vercel.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/api/v1/omdb/", omdbRouter);
app.use("/api/v1/tmdb/", tmdbRouter);
app.use("/api/v1/user/", userRouter);
app.use("/api/v1/corn/", cornRouter);

export default app;
