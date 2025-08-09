import admin, { db } from "../config/firebase.config.js";
import { ApiError } from "../utils/ApiError.utils.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response } from "express";

interface TMDBVideo {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  key: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
  id: string;
}

interface TMDBVideosResponse {
  id: number;
  results: TMDBVideo[];
}

interface CachedMovieVideos {
  movie_id: number;
  data: TMDBVideo[];
  cached_at: admin.firestore.Timestamp;
  expires_at: admin.firestore.Timestamp;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_BEARER_TOKEN = "";

const isVideoCacheExpired = (cachedAt: admin.firestore.Timestamp): boolean => {
  const now = new Date();
  const cacheTime = cachedAt.toDate();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return cacheTime < oneHourAgo;
};

const fetchMovieVideosFromAPI = async (
  movieId: number
): Promise<TMDBVideo[]> => {
  try {
    const url = `${TMDB_BASE_URL}/movie/${movieId}/videos?language=en-US`;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
      },
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `TMDB API error: ${response.statusText}`
      );
    }
    const data = (await response.json()) as TMDBVideosResponse;

    if (!data.results || !Array.isArray(data.results)) {
      throw new ApiError(500, "Invalid response format from TMDB API");
    }

    return data.results;
  } catch (error) {
    console.error("Error fetching movie videos:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Failed to fetch movie videos from TMDB");
  }
};

const storeVideosInCache = async (
  movieId: number,
  videos: TMDBVideo[]
): Promise<void> => {
  try {
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 60 * 60 * 1000)
    );

    const cacheData: CachedMovieVideos = {
      movie_id: movieId,
      data: videos,
      cached_at: now,
      expires_at: expiresAt,
    };

    await db
      .collection("movie_videos_cache")
      .doc(`movie_${movieId}`)
      .set(cacheData);

    console.log(
      `Stored videos for movie ${movieId} in cache:`,
      new Date().toISOString()
    );
  } catch (error) {
    console.error("Error storing video cache:", error);
    throw new ApiError(500, "Failed to store video cache");
  }
};

const GetMovieVideos = asyncHandler(async (req: Request, res: Response) => {
  try {
    const movieIdParam = req.params.movieId;
    if (!movieIdParam) {
      throw new ApiError(400, "Movie ID parameter is required");
    }

    const movieId = parseInt(movieIdParam);

    if (!movieId || isNaN(movieId)) {
      throw new ApiError(400, "Valid movie ID is required");
    }
    const cacheDoc = await db
      .collection("movie_videos_cache")
      .doc(`movie_${movieId}`)
      .get();

    if (cacheDoc.exists) {
      const cachedData = cacheDoc.data() as CachedMovieVideos;

      if (!isVideoCacheExpired(cachedData.cached_at)) {
        console.log(`📋 Retrieved videos for movie ${movieId} from cache`);

        return res.status(200).json({
          success: true,
          movie_id: movieId,
          data: cachedData.data,
          source: "cache",
          cached_at: cachedData.cached_at.toDate(),
          expires_at: cachedData.expires_at.toDate(),
          total_videos: cachedData.data.length,
        });
      } else {
        console.log(
          `🔄 Cache expired for movie ${movieId}, fetching fresh data...`
        );
      }
    }

    const videos = await fetchMovieVideosFromAPI(movieId);

    await storeVideosInCache(movieId, videos);

    res.status(200).json({
      success: true,
      movie_id: movieId,
      data: videos,
      source: "api",
      cached_at: new Date(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      total_videos: videos.length,
    });
  } catch (error: any) {
    console.error(
      `Error getting videos for movie ${req.params.movieId || "unknown"}:`,
      error
    );

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        status: error.statusCode,
        message: error.message,
        type: error.type,
      });
    } else {
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to get movie videos",
        type: "INTERNAL_ERROR",
      });
    }
  }
});

const GetMovieVideosByType = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const movieIdParam = req.params.movieId;
      const typeParam = req.params.type;
      if (!movieIdParam) {
        throw new ApiError(400, "Movie ID parameter is required");
      }

      if (!typeParam) {
        throw new ApiError(400, "Video type parameter is required");
      }

      const movieId = parseInt(movieIdParam);
      const videoType = typeParam.toLowerCase();

      if (!movieId || isNaN(movieId)) {
        throw new ApiError(400, "Valid movie ID is required");
      }

      const cacheDoc = await db
        .collection("movie_videos_cache")
        .doc(`movie_${movieId}`)
        .get();

      let videos: TMDBVideo[] = [];

      if (cacheDoc.exists) {
        const cachedData = cacheDoc.data() as CachedMovieVideos;
        if (!isVideoCacheExpired(cachedData.cached_at)) {
          videos = cachedData.data;
        }
      }

      if (videos.length === 0) {
        videos = await fetchMovieVideosFromAPI(movieId);
        await storeVideosInCache(movieId, videos);
      }

      const filteredVideos = videos.filter(
        (video) => video.type.toLowerCase() === videoType
      );

      res.status(200).json({
        success: true,
        movie_id: movieId,
        video_type: videoType,
        data: filteredVideos,
        total_videos: filteredVideos.length,
      });
    } catch (error: any) {
      console.error(
        `Error getting ${req.params.type || "unknown"} videos for movie ${
          req.params.movieId || "unknown"
        }:`,
        error
      );

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to get movie videos by type",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const ClearMovieVideoCache = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const movieIdParam = req.params.movieId;
      if (!movieIdParam) {
        throw new ApiError(400, "Movie ID parameter is required");
      }

      const movieId = parseInt(movieIdParam);

      if (!movieId || isNaN(movieId)) {
        throw new ApiError(400, "Valid movie ID is required");
      }

      await db
        .collection("movie_videos_cache")
        .doc(`movie_${movieId}`)
        .delete();

      res.status(200).json({
        success: true,
        message: `Video cache cleared for movie ${movieId}`,
        movie_id: movieId,
      });
    } catch (error: any) {
      console.error(
        ` Error clearing video cache for movie ${
          req.params.movieId || "unknown"
        }:`,
        error
      );

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to clear video cache",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetMovieVideoCacheStatus = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const movieIdParam = req.params.movieId;
      if (!movieIdParam) {
        throw new ApiError(400, "Movie ID parameter is required");
      }

      const movieId = parseInt(movieIdParam);

      if (!movieId || isNaN(movieId)) {
        throw new ApiError(400, "Valid movie ID is required");
      }

      const cacheDoc = await db
        .collection("movie_videos_cache")
        .doc(`movie_${movieId}`)
        .get();

      if (!cacheDoc.exists) {
        return res.status(200).json({
          success: true,
          movie_id: movieId,
          cache_exists: false,
          message: "No cache found for this movie",
        });
      }

      const cachedData = cacheDoc.data() as CachedMovieVideos;
      const isExpired = isVideoCacheExpired(cachedData.cached_at);
      const timeLeft = cachedData.expires_at.toDate().getTime() - Date.now();

      res.status(200).json({
        success: true,
        movie_id: movieId,
        cache_exists: true,
        is_expired: isExpired,
        cached_at: cachedData.cached_at.toDate(),
        expires_at: cachedData.expires_at.toDate(),
        time_left_ms: Math.max(0, timeLeft),
        time_left_minutes: Math.max(0, Math.round(timeLeft / (1000 * 60))),
        total_videos: cachedData.data.length,
      });
    } catch (error: any) {
      console.error(
        `Error getting video cache status for movie ${
          req.params.movieId || "unknown"
        }:`,
        error
      );

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to get video cache status",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const cleanupExpiredVideoCache = async (): Promise<void> => {
  try {
    const videoCacheCollection = db.collection("movie_videos_cache");
    const snapshot = await videoCacheCollection.get();

    const deletePromises: Promise<any>[] = [];

    snapshot.forEach((doc) => {
      const cachedData = doc.data() as CachedMovieVideos;
      if (isVideoCacheExpired(cachedData.cached_at)) {
        console.log(
          `🗑️ Deleting expired video cache for movie ${cachedData.movie_id}`
        );
        deletePromises.push(doc.ref.delete());
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(
        `Cleaned up ${deletePromises.length} expired video cache entries`
      );
    } else {
      console.log("✨ No expired video cache entries found");
    }
  } catch (error) {
    console.error(" Error cleaning up expired video cache:", error);
  }
};

export {
  GetMovieVideos,
  GetMovieVideosByType,
  ClearMovieVideoCache,
  GetMovieVideoCacheStatus,
  fetchMovieVideosFromAPI,
  storeVideosInCache,
  cleanupExpiredVideoCache,
  isVideoCacheExpired,
};
