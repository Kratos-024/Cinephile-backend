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

type OMDbResponse = OMDbSearchResponse | OMDbErrorResponse;
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

  const firebaseDoc = await db
    .collection("user_movie_model")
    .doc(searchTitle)
    .get();

  let movieData;
  let source = "api";

  if (firebaseDoc.exists) {
    const cachedData = firebaseDoc.data();
    movieData = cachedData?.movie || cachedData;
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
      throw new ApiError(404, data.Error, "NOT_FOUND");
    }

    movieData = data;

    // Store in global cache
    const dataToStore = {
      movie: data,
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
      search_title: searchTitle,
    };

    try {
      await db.collection("user_movie_model").doc(searchTitle).set(dataToStore);
      console.log("Stored in Firebase cache:", searchTitle);
    } catch (firebaseError) {
      console.error("Error storing in Firebase:", firebaseError);
    }
  }

  try {
    const userMovieData = {
      ...movieData,
      added_at: admin.firestore.FieldValue.serverTimestamp(),
      user_id: userId,
      movie_id: movieData.imdbID || searchTitle,
    };

    await db
      .collection("users")
      .doc(userId)
      .collection("movies")
      .doc(movieData.imdbID || searchTitle)
      .set(userMovieData, { merge: true });

    console.log(`Movie added to user ${userId}'s collection:`, searchTitle);
  } catch (userMovieError) {
    console.error("Error adding movie to user collection:", userMovieError);
    // Don't throw here, still return the movie data
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

      const url = `https://www.omdbapi.com/?s=${encodeURIComponent(
        title
      )}&apikey=${apiKey}`;

      const response = await fetch(url);
      console.log(response);
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
    const offset = Number(page) * Number(limit);

    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("movies")
      .orderBy("added_at", "desc")
      .limit(Number(limit))
      .offset(offset)
      .get();

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
