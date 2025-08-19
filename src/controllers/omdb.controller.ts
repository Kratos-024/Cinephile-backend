import admin, { db } from "../config/firebase.config.js";
import { ApiError } from "../utils/ApiError.utils.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response } from "express";

interface OMDbMovieResult {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

interface OMDbSearchResponse {
  Search: OMDbMovieResult[];
  totalResults: string;
  Response: "True";
}

interface OMDbSearchMovie {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

// For search API response
interface OMDbSearchResponse {
  Search: OMDbSearchMovie[];
  totalResults: string;
  Response: "True";
}

// For error response
interface OMDbErrorResponse {
  Response: "False";
  Error: string;
}

// Union type for search endpoint
export type OMDbSearchApiResponse = OMDbSearchResponse | OMDbErrorResponse;

// Keep your existing detail response for single movie endpoints
interface OMDbMovieDetailResponse {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{
    Source: string;
    Value: string;
  }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: "True";
}

interface OMDbErrorResponse {
  Response: "False";
  Error: string;
}

export type OMDbResponse = OMDbSearchResponse | OMDbErrorResponse;
export type OMDbDetailResponse = OMDbMovieDetailResponse | OMDbErrorResponse;

export const isOMDbError = (
  data: OMDbResponse | OMDbDetailResponse
): data is OMDbErrorResponse => {
  return data.Response === "False";
};

const GetMovieByTitleFunction = async (userId: string, title: string) => {
  if (!title) {
    throw new ApiError(
      400,
      "Missing required parameter 'title'",
      "BAD_REQUEST"
    );
  }

  if (!userId) {
    throw new ApiError(
      400,
      "Missing required parameter 'userId'",
      "BAD_REQUEST"
    );
  }

  const searchTitle = title.toLowerCase().trim();

  // 1️⃣ – check Firebase cache first
  const firebaseDoc = await db
    .collection("user_movie_model")
    .doc(searchTitle)
    .get();

  let movieData: OMDbResponse | undefined;
  let source: "cache" | "api" = "api";

  if (firebaseDoc.exists) {
    movieData = firebaseDoc.data()?.movie;
    source = "cache";
    console.log("Retrieved from Firebase cache:", searchTitle);
  } else {
    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, "Missing OMDb API key", "INTERNAL_ERROR");
    }

    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(
      title
    )}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as OMDbResponse;
    if (isOMDbError(data)) {
      console.log("OMDb returned NOT_FOUND for:", title);
      return {
        success: false,
        message: data.Error || "Movie not found",
        source: "api",
        added_to_user: userId,
        data: null,
      };
    }

    movieData = data;

    const dataToStore = {
      movie: data,
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
      search_title: searchTitle,
    };
    db.collection("user_movie_model")
      .doc(searchTitle)
      .set(dataToStore)
      .catch((err) => console.error("Error storing in Firebase:", err));
  }

  try {
    if (movieData) {
      const userMovieData = {
        ...movieData,
        added_at: admin.firestore.FieldValue.serverTimestamp(),
        user_id: userId,
        //@ts-ignore
        movie_id: movieData.imdbID || searchTitle,
      };

      await db
        .collection("users")
        .doc(userId)
        .collection("movies")
        //@ts-ignore
        .doc(movieData.imdbID || searchTitle)
        .set(userMovieData, { merge: true });

      console.log(`Movie added to user ${userId}'s collection:`, searchTitle);
    }
  } catch (userMovieError) {
    console.error("Error adding movie to user collection:", userMovieError);
  }

  return {
    success: true,
    data: movieData,
    source,
    added_to_user: userId,
  };
};

const GetMovieByTitleResponse = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const title = req.params.title;

      if (!title) {
        throw new ApiError(
          400,
          "Missing required parameter 'title'",
          "BAD_REQUEST"
        );
      }

      const apiKey = process.env.OMDB_API_KEY;

      if (!apiKey) {
        throw new ApiError(500, "Missing OMDb API key", "INTERNAL_ERROR");
      }

      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(
        title
      )}&apikey=${apiKey}`;

      const response = await fetch(url);
      const data = (await response.json()) as OMDbDetailResponse;

      if (isOMDbError(data)) {
        throw new ApiError(404, data.Error, "NOT_FOUND");
      }

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error("Error caught:", error);

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
  }
);
const GetMoviesByTitleResponse = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const title = req.params.title;
      const page = parseInt(req.query.page as string) || 1;

      if (!title) {
        throw new ApiError(
          400,
          "Missing required parameter 'title'",
          "BAD_REQUEST"
        );
      }

      // Check if search term is too short/generic
      if (title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Search term must be at least 3 characters long",
        });
      }

      const apiKey = process.env.OMDB_API_KEY;

      if (!apiKey) {
        throw new ApiError(500, "Missing OMDb API key", "INTERNAL_ERROR");
      }

      const url = `https://www.omdbapi.com/?s=${encodeURIComponent(
        title
      )}&page=${page}&apikey=${apiKey}`;

      const response = await fetch(url);
      const data = (await response.json()) as OMDbSearchApiResponse;

      if (isOMDbError(data)) {
        // Handle specific "Too many results" error
        if (data.Error.toLowerCase().includes("too many results")) {
          return res.status(400).json({
            success: false,
            message: "Search term is too broad. Please be more specific.",
            suggestion: "Try adding year, genre, or more specific keywords",
          });
        }
        throw new ApiError(404, data.Error, "NOT_FOUND");
      }

      let search = data.Search || [];
      const resultsPerPage = 8;
      const startIndex = 0;
      const endIndex = resultsPerPage;

      const totalResults = parseInt(data.totalResults) || 0;
      const totalPages = Math.ceil(totalResults / resultsPerPage);

      search = search.slice(startIndex, endIndex);

      const responseData = {
        ...data,
        Search: search,
        totalResults: data.totalResults,
        currentPage: page,
        totalPages: totalPages,
        resultsPerPage: resultsPerPage,
      };

      res.status(200).json({ success: true, data: responseData });
    } catch (error: any) {
      console.error("Error caught:", error);

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
  }
);

const GetMovieById = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.body;

    if (!id) {
      throw new ApiError(400, "Missing required parameter 'id'", "BAD_REQUEST");
    }

    const apiKey = process.env.OMDB_API_KEY;

    if (!apiKey) {
      throw new ApiError(500, "Missing OMDb API key", "INTERNAL_ERROR");
    }

    const url = `https://www.omdbapi.com/?i=${id}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as OMDbDetailResponse;

    if (isOMDbError(data)) {
      throw new ApiError(404, data.Error, "NOT_FOUND");
    }

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Error caught:", error);

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

const StoreMovieInFirebase = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { movieData, title, page } = req.body;

      if (!movieData || !title) {
        throw new ApiError(
          400,
          "Missing required parameters: 'movieData' and 'title'",
          "BAD_REQUEST"
        );
      }

      const searchTitle = String(title).toLowerCase().trim();
      const searchPage = page ?? 1;

      const docRef = db
        .collection("movies_cache")
        .doc(`${searchTitle}_page_${searchPage}`);

      const dataToStore = {
        ...movieData,
        cached_at: admin.firestore.FieldValue.serverTimestamp(),
        search_title: searchTitle,
        search_page: searchPage,
        manually_stored: true,
      };

      await docRef.set(dataToStore);

      res.status(200).json({
        success: true,
        message: "Movie data stored successfully in Firebase",
        document_id: `${searchTitle}_page_${searchPage}`,
      });
    } catch (error: any) {
      console.error(" Error storing movie in Firebase:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).send({
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        res.status(500).send({
          status: 500,
          message: "Failed to store movie data",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetCachedMovies = asyncHandler(async (req: Request, res: Response) => {
  try {
    //@ts-ignore
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
        errorType: "UNAUTHORIZED",
      });
    }

    const { limit = 10, page = 0 } = req.query;

    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("movies")

      .get();
    console.log("snapshot", snapshot);
    const cachedMovies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`Retrieved ${cachedMovies.length} movies for user ${userId}`);

    res.status(200).json({
      success: true,
      data: cachedMovies,
      total: cachedMovies.length,
      page: Number(page),
      userId: userId,
    });
  } catch (error: any) {
    console.error("Error getting cached movies:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve cached movies",
      errorType: "INTERNAL_ERROR",
    });
  }
});

const ClearMovieCache = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { title, page } = req.params;

    if (!title) {
      throw new ApiError(400, "Missing 'title' parameter", "BAD_REQUEST");
    }

    const searchTitle = String(title).toLowerCase().trim();
    const searchPage = page ?? 1;
    const docId = `${searchTitle}_page_${searchPage}`;

    await db.collection("movies_cache").doc(docId).delete();

    res.status(200).json({
      success: true,
      message: `Cache cleared for: ${title}`,
      document_id: docId,
    });
  } catch (error: any) {
    console.error("Error clearing cache:", error);

    if (error instanceof ApiError) {
      res.status(error.statusCode).send({
        status: error.statusCode,
        message: error.message,
        type: error.type,
      });
    } else {
      res.status(500).send({
        status: 500,
        message: "Failed to clear cache",
        type: "INTERNAL_ERROR",
      });
    }
  }
});

export {
  GetMovieByTitleFunction,
  GetMovieByTitleResponse,
  GetMovieById,
  StoreMovieInFirebase,
  GetCachedMovies,
  ClearMovieCache,
  GetMoviesByTitleResponse,
};
