import admin, { db } from "../config/firebase.config.js";
import { ApiError } from "../utils/ApiError.utils.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response } from "express";
import {
  deleteCommentFromMovie,
  saveCommentToMovie,
} from "./tmdb.controller.js";
import { GetMovieByTitleFunction, OMDbResponse } from "./omdb.controller.js";

interface SelectedMovie {
  imdbID: string;
  title: string;
}

interface UserPreference {
  userId: string;
  preferences: SelectedMovie[];
  timestamp: string;
  totalPreferences: number;
  updatedAt: any;
}

interface UserReview {
  movieTitle: string;
  poster: string;
  id: string;
  userId: string;
  imdb_id: number;
  title: string;
  userPhotoURL: string;
  userDisplayName: string;
  comment: string;
  rating?: number;
  timestamp: string;
  updatedAt: any;
}

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName?: string;
  };
}
interface LikedMovie {
  tmdbId: number;
  imdbId?: string;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
  likedAt: string;
}

interface WatchlistMovie {
  imdbId?: string;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: string;
  addedAt: string;
}

interface UserLikes {
  userId: string;
  likedMovies: LikedMovie[];
  totalLikes: number;
  updatedAt: any;
}

interface UserWatchlist {
  userId: string;
  watchlistMovies: WatchlistMovie[];
  totalWatchlist: number;
  updatedAt: any;
}
export const getRecommendationsFromML = async (title: string) => {
  try {
    const response = await fetch(
      "https://cinephile-model.onrender.com/recommend",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ movie_title: title }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (data.recommended && data.recommended.length > 0) {
      return data.recommended;
    } else {
      console.warn(`No recommendations found for: ${title}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching recommendations for ${title}:`, error);
    return [];
  }
};

const processUserPreferences = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const preferences = req.body.preferences;
      //@ts-ignore
      const userId = req.user?.uid;

      await SaveUserPreference(userId, preferences);
      const allRecommendations: string[] = [];
      for (const movie of preferences) {
        const recommendations = await getRecommendationsFromML(movie.title);
        allRecommendations.push(...recommendations);
      }
      type MovieResult = {
        success: boolean;
        message?: string;
        source: string;
        added_to_user: string;
        data: OMDbResponse | null;
      };

      const detailedMovies: MovieResult[] = [];
      for (const movie of allRecommendations) {
        const detailMovie = await GetMovieByTitleFunction(userId, movie);
        //@ts-ignore
        detailedMovies.push(detailMovie);
      }
      console.log("sended 3user prefrences");

      res.send({
        success: true,
        message: "Preferences processed successfully",
        recommendationsCount: detailedMovies.length,
      });
    } catch (error) {
      console.log("sended5 user prefrences", error);

      //@ts-ignore
      res.status(500).json({ success: true, error: error.message });
    }
  }
);

const GetUserProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId || req.user?.uid;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      const [userProfileDoc, watchlistDoc, reviewsSnapshot] = await Promise.all(
        [
          db.collection("user_profiles").doc(userId).get(),
          db.collection("user_watchlist").doc(userId).get(),
          db
            .collection("user_profiles")
            .doc(userId)
            .collection("reviews")
            .orderBy("timestamp", "desc")
            .get(),
        ]
      );

      if (!userProfileDoc.exists) {
        throw new ApiError(404, "User profile not found", "NOT_FOUND");
      }

      const userProfileData = userProfileDoc.data();
      const followers = userProfileData?.followers || [];
      const following = userProfileData?.following || [];

      const [followerProfiles, followingProfiles] = await Promise.all([
        followers.length > 0
          ? Promise.all(
              followers.map(async (followerId: string) => {
                const followerDoc = await db
                  .collection("user_profiles")
                  .doc(followerId)
                  .get();
                if (followerDoc.exists) {
                  const data = followerDoc.data();
                  return {
                    uid: followerId,
                    displayName: data?.displayName || "",
                    photoURL: data?.photoURL || "",
                    email: data?.email || "",
                  };
                }
                return null;
              })
            ).then((profiles) => profiles.filter((profile) => profile !== null))
          : Promise.resolve([]),
        following.length > 0
          ? Promise.all(
              following.map(async (followingId: string) => {
                const followingDoc = await db
                  .collection("user_profiles")
                  .doc(followingId)
                  .get();
                if (followingDoc.exists) {
                  const data = followingDoc.data();
                  return {
                    uid: followingId,
                    displayName: data?.displayName || "",
                    photoURL: data?.photoURL || "",
                    email: data?.email || "",
                  };
                }
                return null;
              })
            ).then((profiles) => profiles.filter((profile) => profile !== null))
          : Promise.resolve([]),
      ]);

      const userProfile = {
        userId,
        ...userProfileData,
      };

      const watchlist = watchlistDoc.exists
        ? watchlistDoc.data()?.watchlistMovies || []
        : [];

      const reviews = reviewsSnapshot.empty
        ? []
        : reviewsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

      const userData = {
        profile: userProfile,
        watchlist,
        reviews,
        followers: {
          profiles: followerProfiles,
          count: followers.length,
        },
        following: {
          profiles: followingProfiles,
          count: following.length,
        },
        stats: {
          totalWatchlistItems: watchlist.length,
          totalReviews: reviews.length,
          followersCount: followers.length,
          followingCount: following.length,
        },
      };

      res.status(200).json({
        success: true,
        data: userData,
      });
    } catch (error: any) {
      console.error("Error getting user profile:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        res.status(500).json({
          status: 500,
          success: false,
          message: "Something went wrong while getting profile",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const SaveUserPreference = async (
  userId: string,
  preferences: { title: string; imdbID: string }[]
) => {
  try {
    if (!userId) {
      throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
    }

    if (!preferences || !Array.isArray(preferences)) {
      throw new ApiError(
        400,
        "Missing or invalid 'preferences' parameter",
        "BAD_REQUEST"
      );
    }

    for (const pref of preferences) {
      if (!pref.imdbID || !pref.title) {
        throw new ApiError(
          400,
          "Each preference must have 'imdbID' and 'title'",
          "BAD_REQUEST"
        );
      }
    }

    const userPreferenceData: UserPreference = {
      userId,
      preferences,
      timestamp: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalPreferences: preferences.length,
    };

    const docRef = db.collection("user_preferences").doc(userId);
    await docRef.set(userPreferenceData, { merge: true });

    console.log(
      `Saved preferences for user: ${userId}, total: ${preferences.length}`
    );
    return {
      success: true,
      message: "User preferences saved successfully",
      data: {
        userId,
        totalPreferences: preferences.length,
        savedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error("Error saving user preferences:", error);

    if (error instanceof ApiError) {
      return {
        success: false,
        status: error.statusCode,
        message: error.message,
        type: error.type,
      };
    } else {
      return {
        success: false,
        status: 500,
        message: "Something went wrong while saving preferences",
        type: "INTERNAL_ERROR",
      };
    }
  }
};

const GetUserPreference = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid || req.params.userId;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      const doc = await db.collection("user_preferences").doc(userId).get();

      if (!doc.exists) {
        return res.status(200).json({
          success: true,
          message: "No preferences found for this user",
          data: {
            userId,
            preferences: [],
            totalPreferences: 0,
          },
        });
      }

      const data = doc.data();

      res.status(200).json({
        success: true,
        message: "User preferences retrieved successfully",
        data,
      });
    } catch (error: any) {
      console.error("Error retrieving user preferences:", error);

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
          message: "Something went wrong while retrieving preferences",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const UpdateUserPreference = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { preferences } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!preferences || !Array.isArray(preferences)) {
        throw new ApiError(
          400,
          "Missing or invalid 'preferences' parameter",
          "BAD_REQUEST"
        );
      }

      const docRef = db.collection("user_preferences").doc(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new ApiError(404, "User preferences not found", "NOT_FOUND");
      }

      const updatedData = {
        preferences,
        totalPreferences: preferences.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.update(updatedData);

      res.status(200).json({
        success: true,
        message: "User preferences updated successfully",
        data: {
          userId,
          totalPreferences: preferences.length,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error updating user preferences:", error);

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
          message: "Something went wrong while updating preferences",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const SaveUserReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log(req.body);
      const {
        imdb_id,
        movieTitle,
        poster,
        title,
        comment,
        rating,
        userPhotoURL,
        userDisplayName,
      } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!imdb_id || !title || !comment) {
        throw new ApiError(
          400,
          "Missing required parameters: imdbId, title, or comment",
          "BAD_REQUEST"
        );
      }

      if (rating && (rating < 1 || rating > 5)) {
        throw new ApiError(
          400,
          "Rating must be between 1 and 5",
          "BAD_REQUEST"
        );
      }

      await saveCommentToMovie(imdb_id, {
        movieTitle,
        poster,
        imdb_id: imdb_id,
        userId,
        userDisplayName: userDisplayName,
        userPhotoURL: userPhotoURL,
        comment,
        rating,
        title,
      });

      const reviewId = `${userId}_${imdb_id}`;

      const reviewData: UserReview = {
        movieTitle,
        poster,
        id: reviewId,
        userId,
        imdb_id: imdb_id,
        title,
        comment,
        userPhotoURL,
        userDisplayName,
        rating: rating || undefined,
        timestamp: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const reviewRef = db
        .collection("user_profiles")
        .doc(userId)
        .collection("reviews")
        .doc(imdb_id);

      await reviewRef.set(reviewData, { merge: true });

      res.status(200).json({
        success: true,
        message: "Review saved successfully",
        data: {
          reviewId,
          userId,
          imdb_id,
          title,
        },
      });
    } catch (error: any) {
      console.error("Error saving review:", error);

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
          message: "Something went wrong while saving review",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const DeleteUserReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imdbId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }
      if (!imdbId) {
        throw new ApiError(400, "IMDb ID is required", "BAD_REQUEST");
      }
      const reviewRef = db
        .collection("user_profiles")
        .doc(userId)
        .collection("reviews")
        .doc(imdbId);

      const reviewDoc = await reviewRef.get();
      if (!reviewDoc.exists) {
        throw new ApiError(404, "Review not found", "NOT_FOUND");
      }

      await reviewRef.delete();
      await deleteCommentFromMovie(imdbId, userId);

      res.status(200).json({
        success: true,
        message: "Review deleted successfully from both locations",
        data: {
          reviewId: `${userId}_${imdbId}`,
          userId,
          imdbId,
        },
      });
    } catch (error: any) {
      console.error("Error getting user reviews:", error);

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
          message: "Failed to get user reviews",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const FollowUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { targetUserId } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!targetUserId) {
        throw new ApiError(
          400,
          "Missing required parameter 'targetUserId'",
          "BAD_REQUEST"
        );
      }

      if (userId === targetUserId) {
        throw new ApiError(400, "Cannot follow yourself", "BAD_REQUEST");
      }

      const batch = db.batch();

      const userRef = db.collection("user_profiles").doc(userId);
      batch.update(userRef, {
        following: admin.firestore.FieldValue.arrayUnion(targetUserId),
        followingCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const targetUserRef = db.collection("user_profiles").doc(targetUserId);
      batch.update(targetUserRef, {
        followers: admin.firestore.FieldValue.arrayUnion(userId),
        followersCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      res.status(200).json({
        success: true,
        message: "User followed successfully",
        data: { userId, targetUserId },
      });
    } catch (error: any) {
      console.error("Error following user:", error);

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
          message: "Something went wrong while following user",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetUserReviews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId || req.user?.uid;
      console.log("reviewsreviewsreviewsreviews", userId);
      if (!userId) {
        throw new ApiError(400, "User ID is required", "BAD_REQUEST");
      }
      const reviewsSnapshot = await db
        .collection("user_profiles")
        .doc(userId)
        .collection("reviews")
        .orderBy("timestamp", "desc")
        .get();
      console.log("reviewsSnapshotreviewsSnapshot", reviewsSnapshot);

      const reviews = reviewsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("reviewsreviewsreviewsreviews", reviews);
      res.status(200).json({
        success: true,
        data: reviews,
        total_reviews: reviews.length,
        user_id: userId,
      });
    } catch (error: any) {
      console.error("Error getting user reviews:", error);

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
          message: "Failed to get user reviews",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const LikeMovie = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tmdbId, imdbId, title, poster_path, release_date, vote_average } =
        req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!tmdbId || !title) {
        throw new ApiError(
          400,
          "Missing required parameters: tmdbId and title",
          "BAD_REQUEST"
        );
      }

      const docRef = db.collection("user_likes").doc(userId);
      const doc = await docRef.get();

      const likedMovie: LikedMovie = {
        tmdbId: Number(tmdbId),
        imdbId,
        title,
        poster_path,
        release_date,
        vote_average,
        likedAt: new Date().toISOString(),
      };

      if (doc.exists) {
        const userData = doc.data();
        const currentLikes = userData?.likedMovies || [];

        // Check if movie is already liked
        const alreadyLiked = currentLikes.some(
          (movie: LikedMovie) => movie.tmdbId === Number(tmdbId)
        );

        if (alreadyLiked) {
          throw new ApiError(409, "Movie already liked");
        }

        const updatedLikes = [...currentLikes, likedMovie];

        await docRef.update({
          likedMovies: updatedLikes,
          totalLikes: updatedLikes.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Create new likes document
        const newUserLikes: UserLikes = {
          userId,
          likedMovies: [likedMovie],
          totalLikes: 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.set(newUserLikes);
      }

      res.status(200).json({
        success: true,
        message: "Movie liked successfully",
        data: {
          userId,
          tmdbId: Number(tmdbId),
          title,
          likedAt: likedMovie.likedAt,
        },
      });
    } catch (error: any) {
      console.error("Error liking movie:", error);

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
          message: "Something went wrong while liking movie",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const UnlikeMovie = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tmdbId } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!tmdbId) {
        throw new ApiError(
          400,
          "Missing required parameter: tmdbId",
          "BAD_REQUEST"
        );
      }

      const docRef = db.collection("user_likes").doc(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new ApiError(404, "User likes not found", "NOT_FOUND");
      }

      const userData = doc.data();
      const currentLikes = userData?.likedMovies || [];

      // Remove the movie from likes
      const updatedLikes = currentLikes.filter(
        (movie: LikedMovie) => movie.tmdbId !== Number(tmdbId)
      );

      if (updatedLikes.length === currentLikes.length) {
        throw new ApiError(404, "Movie not found in likes", "NOT_FOUND");
      }

      await docRef.update({
        likedMovies: updatedLikes,
        totalLikes: updatedLikes.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        message: "Movie unliked successfully",
        data: {
          userId,
          tmdbId: Number(tmdbId),
          removedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error unliking movie:", error);

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
          message: "Something went wrong while unliking movie",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetUserLikedMovies = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid || req.params.userId;
      const { limit = 10, offset = 0 } = req.query;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      const doc = await db.collection("user_likes").doc(userId).get();

      if (!doc.exists) {
        return res.status(200).json({
          success: true,
          message: "No liked movies found for this user",
          data: {
            userId,
            likedMovies: [],
            totalLikes: 0,
          },
        });
      }

      const userData = doc.data();
      const allLikes = userData?.likedMovies || [];

      // Apply pagination
      const startIndex = Number(offset);
      const endIndex = startIndex + Number(limit);
      const paginatedLikes = allLikes.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        message: "Liked movies retrieved successfully",
        data: {
          userId,
          likedMovies: paginatedLikes,
          totalLikes: allLikes.length,
          currentPage: Math.floor(Number(offset) / Number(limit)) + 1,
          totalPages: Math.ceil(allLikes.length / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error("Error retrieving liked movies:", error);

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
          message: "Something went wrong while retrieving liked movies",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const AddToWatchlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imdbId, title, poster_path, release_date, vote_average } =
        req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!imdbId || !title) {
        throw new ApiError(
          400,
          "Missing required parameters: imdbId and title",
          "BAD_REQUEST"
        );
      }

      const docRef = db.collection("user_watchlist").doc(userId);
      const doc = await docRef.get();

      const watchlistMovie: WatchlistMovie = {
        imdbId,
        title,
        poster_path,
        release_date,
        vote_average,
        addedAt: new Date().toISOString(),
      };

      if (doc.exists) {
        const userData = doc.data();
        const currentWatchlist = userData?.watchlistMovies || [];

        const alreadyInWatchlist = currentWatchlist.some(
          (movie: WatchlistMovie) => movie.imdbId === imdbId
        );

        if (alreadyInWatchlist) {
          throw new ApiError(409, "Movie already in watchlist");
        }

        const updatedWatchlist = [...currentWatchlist, watchlistMovie];

        await docRef.update({
          watchlistMovies: updatedWatchlist,
          totalWatchlist: updatedWatchlist.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const newUserWatchlist: UserWatchlist = {
          userId,
          watchlistMovies: [watchlistMovie],
          totalWatchlist: 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.set(newUserWatchlist);
      }

      res.status(200).json({
        success: true,
        message: "Movie added to watchlist successfully",
        data: {
          userId,
          imdbId,
          title,
          addedAt: watchlistMovie.addedAt,
        },
      });
    } catch (error: any) {
      console.error("Error adding to watchlist:", error);

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
          message: "Something went wrong while adding to watchlist",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const RemoveFromWatchlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imdbId } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!imdbId) {
        throw new ApiError(
          400,
          "Missing required parameter: imdbId",
          "BAD_REQUEST"
        );
      }

      const docRef = db.collection("user_watchlist").doc(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new ApiError(404, "User watchlist not found", "NOT_FOUND");
      }

      const userData = doc.data();
      const currentWatchlist = userData?.watchlistMovies || [];

      const updatedWatchlist = currentWatchlist.filter(
        (movie: WatchlistMovie) => movie.imdbId !== imdbId
      );

      if (updatedWatchlist.length === currentWatchlist.length) {
        throw new ApiError(404, "Movie not found in watchlist", "NOT_FOUND");
      }

      await docRef.update({
        watchlistMovies: updatedWatchlist,
        totalWatchlist: updatedWatchlist.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        message: "Movie removed from watchlist successfully",
        data: {
          userId,
          imdbId,
          removedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error removing from watchlist:", error);

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
          message: "Something went wrong while removing from watchlist",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetUserWatchlist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId || req.user?.uid; // Fixed this line
      const { limit = 10, offset = 0 } = req.query;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      // Rest of your code remains the same...
      const doc = await db.collection("user_watchlist").doc(userId).get();

      if (!doc.exists) {
        return res.status(200).json({
          success: true,
          message: "No watchlist found for this user",
          data: {
            userId,
            watchlistMovies: [],
            totalWatchlist: 0,
            currentPage: 1,
            totalPages: 0,
          },
        });
      }

      const userData = doc.data();
      const allWatchlist = userData?.watchlistMovies || [];

      const startIndex = Number(offset);
      const endIndex = startIndex + Number(limit);
      const paginatedWatchlist = allWatchlist.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        message: "Watchlist retrieved successfully",
        data: {
          userId,
          watchlistMovies: paginatedWatchlist,
          totalWatchlist: allWatchlist.length,
          currentPage: Math.floor(Number(offset) / Number(limit)) + 1,
          totalPages: Math.ceil(allWatchlist.length / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error("Error retrieving watchlist:", error);

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
          message: "Something went wrong while retrieving watchlist",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const getUserInfo = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      res.send(apiResponse(req?.user, "User get successfully", 200));
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json(
          new ApiError(404, "Something went wrong while retrieving user info")
        );
    }
  }
);

const UnfollowUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { targetUserId } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!targetUserId) {
        throw new ApiError(
          400,
          "Missing required parameter 'targetUserId'",
          "BAD_REQUEST"
        );
      }

      // Check if user is actually following the target user
      const userDoc = await db.collection("user_profiles").doc(userId).get();
      if (!userDoc.exists) {
        throw new ApiError(404, "User profile not found", "NOT_FOUND");
      }

      const userData = userDoc.data();
      const following = userData?.following || [];

      if (!following.includes(targetUserId)) {
        throw new ApiError(
          400,
          "You are not following this user",
          "BAD_REQUEST"
        );
      }

      const batch = db.batch();

      // Remove targetUserId from current user's following array
      const userRef = db.collection("user_profiles").doc(userId);
      batch.update(userRef, {
        following: admin.firestore.FieldValue.arrayRemove(targetUserId),
        followingCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Remove userId from target user's followers array
      const targetUserRef = db.collection("user_profiles").doc(targetUserId);
      batch.update(targetUserRef, {
        followers: admin.firestore.FieldValue.arrayRemove(userId),
        followersCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      res.status(200).json({
        success: true,
        message: "User unfollowed successfully",
        data: {
          userId,
          targetUserId,
          unfollowedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error unfollowing user:", error);

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
          message: "Something went wrong while unfollowing user",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetUserFollowers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId || req.user?.uid;
      const { limit = 20, offset = 0 } = req.query;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      const doc = await db.collection("user_profiles").doc(userId).get();

      if (!doc.exists) {
        throw new ApiError(404, "User profile not found", "NOT_FOUND");
      }

      const userData = doc.data();
      const followers = userData?.followers || [];

      // Apply pagination to followers array
      const startIndex = Number(offset);
      const endIndex = startIndex + Number(limit);
      const paginatedFollowers = followers.slice(startIndex, endIndex);

      const followerProfiles = [];
      if (paginatedFollowers.length > 0) {
        const followerDocs = await Promise.all(
          paginatedFollowers.map((followerId: string) =>
            db.collection("user_profiles").doc(followerId).get()
          )
        );

        type FollowerProfile = {
          uid: string;
          displayName: string;
          photoURL: string;
          email: string;
          bio: string | undefined;
        };

        const followerProfiles: FollowerProfile[] = [];
        for (const followerDoc of followerDocs) {
          if (followerDoc.exists) {
            const data = followerDoc.data();
            followerProfiles.push({
              uid: followerDoc.id,
              displayName: data?.displayName || "Unknown User",
              photoURL: data?.photoURL || "",
              email: data?.email || "",
              bio: data?.bio || undefined,
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Followers retrieved successfully",
        data: {
          followers: followerProfiles,
          followersCount: followers.length,
          currentPage: Math.floor(Number(offset) / Number(limit)) + 1,
          totalPages: Math.ceil(followers.length / Number(limit)),
          hasMore: endIndex < followers.length,
        },
      });
    } catch (error: any) {
      console.error("Error getting followers:", error);

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
          message: "Something went wrong while getting followers",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const GetUserFollowing = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId || req.user?.uid;
      const { limit = 20, offset = 0 } = req.query;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      const doc = await db.collection("user_profiles").doc(userId).get();

      if (!doc.exists) {
        throw new ApiError(404, "User profile not found", "NOT_FOUND");
      }

      const userData = doc.data();
      const following = userData?.following || [];

      // Apply pagination to following array
      const startIndex = Number(offset);
      const endIndex = startIndex + Number(limit);
      const paginatedFollowing = following.slice(startIndex, endIndex);

      const followingProfiles = [];
      if (paginatedFollowing.length > 0) {
        const followingDocs = await Promise.all(
          paginatedFollowing.map((followingId: string) =>
            db.collection("user_profiles").doc(followingId).get()
          )
        );

        interface UserProfile {
          uid: string;
          displayName: string;
          photoURL: string;
          email: string;
          bio?: string;
        }

        const followingProfiles: UserProfile[] = [];
      }

      res.status(200).json({
        success: true,
        message: "Following retrieved successfully",
        data: {
          following: followingProfiles,
          followingCount: following.length,
          currentPage: Math.floor(Number(offset) / Number(limit)) + 1,
          totalPages: Math.ceil(following.length / Number(limit)),
          hasMore: endIndex < following.length,
        },
      });
    } catch (error: any) {
      console.error("Error getting following:", error);

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
          message: "Something went wrong while getting following",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const IsFollowing = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { targetUserId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!targetUserId) {
        throw new ApiError(
          400,
          "Missing required parameter 'targetUserId'",
          "BAD_REQUEST"
        );
      }

      if (userId === targetUserId) {
        return res.status(200).json({
          success: true,
          message: "Cannot follow yourself",
          data: {
            isFollowing: false,
            isSelf: true,
            userId,
            targetUserId,
          },
        });
      }

      const userDoc = await db.collection("user_profiles").doc(userId).get();

      if (!userDoc.exists) {
        throw new ApiError(404, "User profile not found", "NOT_FOUND");
      }

      const targetUserDoc = await db
        .collection("user_profiles")
        .doc(targetUserId)
        .get();
      if (!targetUserDoc.exists) {
        throw new ApiError(404, "Target user not found", "NOT_FOUND");
      }

      const userData = userDoc.data();
      const following = userData?.following || [];

      const isFollowing = following.includes(targetUserId);

      res.status(200).json({
        success: true,
        message: `Following status retrieved successfully`,
        data: {
          isFollowing,
          isSelf: false,
          userId,
          targetUserId,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error checking follow status:", error);

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
          message: "Something went wrong while checking follow status",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);
const GetTop10Users = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit = 10 } = req.query;
      const limitCount = Number(limit);

      if (limitCount < 1 || limitCount > 50) {
        throw new ApiError(
          400,
          "Limit must be between 1 and 50",
          "BAD_REQUEST"
        );
      }

      const usersQuery = db.collection("user_profiles").limit(limitCount);

      const querySnapshot = await usersQuery.get();

      if (querySnapshot.empty) {
        return res.status(200).json({
          success: true,
          message: "No users found",
          data: {
            users: [],
            totalUsers: 0,
          },
        });
      }

      const users = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          displayName: data.displayName || "Unknown User",
          photoURL: data.photoURL || "",
          email: data.email || "",
          bio: data.bio || "",
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          createdAt: data.createdAt || null,
        };
      });

      res.status(200).json({
        success: true,
        message: "Newest users retrieved successfully",
        data: {
          users,
          totalUsers: users.length,
        },
      });
    } catch (error: any) {
      console.error("Error getting newest users:", error);
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
          message: "Something went wrong while retrieving users",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

export {
  GetTop10Users,
  IsFollowing,
  getUserInfo,
  LikeMovie,
  UnlikeMovie,
  AddToWatchlist,
  RemoveFromWatchlist,
  GetUserLikedMovies,
  GetUserWatchlist,
  SaveUserPreference,
  GetUserPreference,
  UpdateUserPreference,
  SaveUserReview,
  GetUserReviews,
  DeleteUserReview,
  FollowUser,
  UnfollowUser,
  GetUserFollowers,
  GetUserFollowing,
  GetUserProfile,
  processUserPreferences,
};
