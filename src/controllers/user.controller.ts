import admin, { db } from "../config/firebase.config.js";
import { ApiError } from "../utils/ApiError.utils.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response } from "express";

interface SelectedMovie {
  tmdbId: number;
  imdbId?: string;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
}

interface UserPreference {
  userId: string;
  preferences: SelectedMovie[];
  timestamp: string;
  totalPreferences: number;
  updatedAt: any;
}

interface UserReview {
  id: string;
  userId: string;
  tmdbId: number;
  title: string;
  review: string;
  rating?: number;
  timestamp: string;
  updatedAt: any;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  followers: string[];
  following: string[];
  followersCount: number;
  followingCount: number;
  createdAt: any;
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

const SaveUserPreference = asyncHandler(
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

      // Validate preferences structure
      for (const pref of preferences) {
        if (!pref.tmdbId || !pref.title) {
          throw new ApiError(
            400,
            "Each preference must have 'tmdbId' and 'title'",
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

      res.status(200).json({
        success: true,
        message: "User preferences saved successfully",
        data: {
          userId,
          totalPreferences: preferences.length,
          savedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error saving user preferences:", error);

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
          message: "Something went wrong while saving preferences",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

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
      const { tmdbId, title, review, rating } = req.body;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!tmdbId || !title || !review) {
        throw new ApiError(
          400,
          "Missing required parameters: tmdbId, title, or review",
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

      const reviewId = `${userId}_${tmdbId}`;

      const reviewData: UserReview = {
        id: reviewId,
        userId,
        tmdbId: Number(tmdbId),
        title,
        review,
        rating: rating || undefined,
        timestamp: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = db.collection("user_reviews").doc(reviewId);
      await docRef.set(reviewData, { merge: true });

      res.status(200).json({
        success: true,
        message: "Review saved successfully",
        data: {
          reviewId,
          userId,
          tmdbId,
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

const GetUserReviews = asyncHandler(
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

      const snapshot = await db
        .collection("user_reviews")
        .where("userId", "==", userId)
        .orderBy("timestamp", "desc")
        .limit(Number(limit))
        .offset(Number(offset))
        .get();

      const reviews = snapshot.docs.map((doc) => doc.data());

      res.status(200).json({
        success: true,
        data: reviews,
        total: reviews.length,
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
          message: "Something went wrong while retrieving reviews",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

const DeleteUserReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reviewId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        throw new ApiError(401, "User not authenticated", "UNAUTHORIZED");
      }

      if (!reviewId) {
        throw new ApiError(
          400,
          "Missing required parameter 'reviewId'",
          "BAD_REQUEST"
        );
      }

      const docRef = db.collection("user_reviews").doc(reviewId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new ApiError(404, "Review not found", "NOT_FOUND");
      }

      const reviewData = doc.data();
      if (reviewData?.userId !== userId) {
        throw new ApiError(
          403,
          "Not authorized to delete this review",
          "FORBIDDEN"
        );
      }

      await docRef.delete();

      res.status(200).json({
        success: true,
        message: "Review deleted successfully",
        data: { reviewId },
      });
    } catch (error: any) {
      console.error("Error deleting review:", error);

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
          message: "Something went wrong while deleting review",
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

      // Update current user's following list
      const userRef = db.collection("user_profiles").doc(userId);
      batch.update(userRef, {
        following: admin.firestore.FieldValue.arrayUnion(targetUserId),
        followingCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update target user's followers list
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

      const batch = db.batch();

      // Update current user's following list
      const userRef = db.collection("user_profiles").doc(userId);
      batch.update(userRef, {
        following: admin.firestore.FieldValue.arrayRemove(targetUserId),
        followingCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update target user's followers list
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
        data: { userId, targetUserId },
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

      // Get follower profiles
      const followerProfiles = [];
      if (followers.length > 0) {
        const followerDocs = await Promise.all(
          followers.map((followerId: string) =>
            db.collection("user_profiles").doc(followerId).get()
          )
        );

        for (const followerDoc of followerDocs) {
          if (followerDoc.exists) {
            const data = followerDoc.data();
            followerProfiles.push({
              uid: data?.uid,
              displayName: data?.displayName,
              photoURL: data?.photoURL,
              email: data?.email,
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          followers: followerProfiles,
          followersCount: followers.length,
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

      // Get following profiles
      const followingProfiles = [];
      if (following.length > 0) {
        const followingDocs = await Promise.all(
          following.map((followingId: string) =>
            db.collection("user_profiles").doc(followingId).get()
          )
        );

        for (const followingDoc of followingDocs) {
          if (followingDoc.exists) {
            const data = followingDoc.data();
            followingProfiles.push({
              uid: data?.uid,
              displayName: data?.displayName,
              photoURL: data?.photoURL,
              email: data?.email,
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          following: followingProfiles,
          followingCount: following.length,
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

      const doc = await db.collection("user_profiles").doc(userId).get();

      if (!doc.exists) {
        throw new ApiError(404, "User profile not found", "NOT_FOUND");
      }

      const userData = doc.data();

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
          success: false,
          status: 500,
          message: "Something went wrong while getting profile",
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
          "Missing required parameters: tmdbId and title",
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
          "Missing required parameter: tmdbId",
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
          imdbId: imdbId,
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
      const userId = req.user?.uid || req.params.userId;
      const { limit = 10, offset = 0 } = req.query;

      if (!userId) {
        throw new ApiError(
          400,
          "Missing required parameter 'userId'",
          "BAD_REQUEST"
        );
      }

      const doc = await db.collection("user_watchlist").doc(userId).get();

      if (!doc.exists) {
        return res.status(200).json({
          success: true,
          message: "No watchlist found for this user",
          data: {
            userId,
            watchlistMovies: [],
            totalWatchlist: 0,
          },
        });
      }

      const userData = doc.data();
      const allWatchlist = userData?.watchlistMovies || [];

      // Apply pagination
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
export {
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
};
