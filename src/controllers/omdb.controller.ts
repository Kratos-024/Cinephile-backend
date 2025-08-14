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

const GetMovieByTitle = async (
  titleParam: string | Request,
  page: number = 1,
  res?: Response
) => {
  try {
    let title: string;

    if (typeof titleParam === "string") {
      title = titleParam;
    } else {
      const req = titleParam;
      title = String(req.query.title);
      page = Number(req.query.page) || 1;
    }

    if (!title) {
      const error = new ApiError(
        400,
        "Missing required parameter 'title'",
        "BAD_REQUEST"
      );
      if (res) {
        return res
          .status(400)
          .send({ status: 400, message: error.message, type: error.type });
      } else {
        throw error;
      }
    }

    const searchTitle = title.toLowerCase().trim();
    const searchPage = page;

    const firebaseDoc = await db
      .collection("movies_cache")
      .doc(`${searchTitle}_page_${searchPage}`)
      .get();

    if (firebaseDoc.exists) {
      const cachedData = firebaseDoc.data();
      console.log("Retrieved from Firebase cache:", searchTitle);

      const result = {
        success: true,
        data: cachedData,
        source: "cache",
      };

      if (res) {
        return res.status(200).json(result);
      } else {
        return result;
      }
    }

    const apiKey = process.env.OMDB_API_KEY;

    if (!apiKey) {
      const error = new ApiError(500, "Missing OMDb API key", "INTERNAL_ERROR");
      if (res) {
        return res
          .status(500)
          .send({ status: 500, message: error.message, type: error.type });
      } else {
        throw error;
      }
    }

    const url = `https://www.omdbapi.com/?s=${encodeURIComponent(
      title
    )}&page=${searchPage}&type=movie&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as OMDbResponse;

    if (isOMDbError(data)) {
      const error = new ApiError(404, data.Error, "NOT_FOUND");
      if (res) {
        return res
          .status(404)
          .send({ status: 404, message: error.message, type: error.type });
      } else {
        throw error;
      }
    }

    try {
      const dataToStore = {
        Search: data.Search,
        totalResults: data.totalResults,
        Response: data.Response,
        cached_at: admin.firestore.FieldValue.serverTimestamp(),
        search_title: searchTitle,
        search_page: searchPage,
      };

      await db
        .collection("movies_cache")
        .doc(`${searchTitle}_page_${searchPage}`)
        .set(dataToStore);

      console.log("Stored in Firebase cache:", searchTitle);
    } catch (firebaseError) {
      console.error("Error storing in Firebase:", firebaseError);
    }

    const result = {
      success: true,
      data,
      source: "api",
    };

    if (res) {
      return res.status(200).json(result);
    } else {
      return result;
    }
  } catch (error: any) {
    console.error("Error caught:", error);

    if (res) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).send({
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        return res.status(500).send({
          status: 500,
          message: "Something went wrong",
          type: "INTERNAL_ERROR",
        });
      }
    } else {
      return { success: false, error: error.message };
    }
  }
};

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
    const { limit = 10, offset = 0 } = req.query;

    const snapshot = await db
      .collection("movies_cache")
      .orderBy("cached_at", "desc")
      .limit(Number(limit))
      .offset(Number(offset))
      .get();

    const cachedMovies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      data: cachedMovies,
      total: cachedMovies.length,
    });
  } catch (error: any) {
    console.error("Error getting cached movies:", error);

    res.status(500).send({
      status: 500,
      message: "Failed to retrieve cached movies",
      type: "INTERNAL_ERROR",
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
  GetMovieByTitle,
  GetMovieById,
  StoreMovieInFirebase,
  GetCachedMovies,
  ClearMovieCache,
};
