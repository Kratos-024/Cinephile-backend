import admin, { db } from "../config/firebase.config.js";
import { ApiError } from "../utils/ApiError.utils.js";
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

// Profile Sync Controller (replaces auth functions)
const SyncUserProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid, email, displayName, photoURL } = req.body;
      const authenticatedUid = req.user?.uid;

      // Verify the requesting user matches the profile being synced
      if (uid !== authenticatedUid) {
        throw new ApiError(
          403,
          "Cannot sync profile for different user",
          "FORBIDDEN"
        );
      }

      // Check if user profile already exists
      const existingProfile = await db
        .collection("user_profiles")
        .doc(uid)
        .get();

      if (existingProfile.exists) {
        // Update existing profile
        const updateData = {
          email,
          displayName: displayName || existingProfile.data()?.displayName,
          photoURL: photoURL || existingProfile.data()?.photoURL,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("user_profiles").doc(uid).update(updateData);

        res.status(200).json({
          success: true,
          message: "User profile updated successfully",
          data: { uid, action: "updated" },
        });
      } else {
        // Create new profile
        const newProfile: UserProfile = {
          uid,
          email,
          displayName: displayName || null,
          photoURL: photoURL || null,
          followers: [],
          following: [],
          followersCount: 0,
          followingCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("user_profiles").doc(uid).set(newProfile);

        res.status(201).json({
          success: true,
          message: "User profile created successfully",
          data: { uid, action: "created" },
        });
      }
    } catch (error: any) {
      console.error("Error syncing user profile:", error);

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
          message: "Something went wrong while syncing profile",
          type: "INTERNAL_ERROR",
        });
      }
    }
  }
);

// User Preference Controllers (unchanged)
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

// User Review Controllers (unchanged)
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

      if (rating && (rating < 1 || rating > 10)) {
        throw new ApiError(
          400,
          "Rating must be between 1 and 10",
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

// User Social Controllers (unchanged)
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

export {
  // Profile sync (replaces auth functions)
  SyncUserProfile,

  // Preferences
  SaveUserPreference,
  GetUserPreference,
  UpdateUserPreference,

  // Reviews
  SaveUserReview,
  GetUserReviews,
  DeleteUserReview,

  // Social
  FollowUser,
  UnfollowUser,
  GetUserFollowers,
  GetUserFollowing,

  // Profile
  GetUserProfile,
};
