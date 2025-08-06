import { ApiError } from "../utils/ApiError.utils.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response } from "express";

const GetMovieById = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log("🔄 Incoming request to /getMovie");

    const getId = req.body.id;
    console.log("📦 Request body:", req.body);
    console.log("🎬 Extracted ID:", getId);

    if (!getId) {
      console.log("⛔  Missing ID in request");
      throw new ApiError(400, "Missing required parameter 'id'", "BAD_REQUEST");
    }

    const url = `https://api.themoviedb.org/3/find/${getId}?external_source=imdb_id`;
    console.log("🌐 TMDB URL formed:", url);

    const token = process.env.TMDB_ACCESS_TOKEN;
    console.log("🔑 TMDB Token loaded:", token ? "✅ Loaded" : "❌ Not found");

    if (!token) {
      console.log("⛔ Missing TMDB token in environment");
      throw new ApiError(500, "Missing TMDB access token", "INTERNAL_ERROR");
    }

    const headers = {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    console.log("📨 Request headers prepared:", headers);

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    console.log("📬 Response status:", response.status);

    if (!response.ok) {
      console.log("❌ TMDB API responded with error");
      throw new ApiError(response.status, "TMDB API Error", "INTERNAL_ERROR");
    }

    const data = await response.json();
    console.log("📥 Data received from TMDB:", JSON.stringify(data, null, 2));

    res.status(200).json({ success: true, data });
    console.log("✅ Response sent to client");
  } catch (error: any) {
    console.error("🔥 Error caught:", error);

    if (error instanceof ApiError) {
      res.status(error.statusCode).send({
        status: error.statusCode,
        message: error.message,
        type: error.type,
      });
    } else {
      res.status(500).send({
        status: 500,
        message: "Something went wrong",
        type: "INTERNAL_ERROR",
      });
    }
  }
});

export default GetMovieById;
