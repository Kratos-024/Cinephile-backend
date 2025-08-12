import { Router } from "express";
import {
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
  GetUserLikedMovies,
  LikeMovie,
  UnlikeMovie,
  AddToWatchlist,
  RemoveFromWatchlist,
  getUserInfo,
} from "../controllers/user.controller.js";
import { authenticateUser } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.use(authenticateUser);
userRouter.route("/preferences").post(SaveUserPreference);
userRouter.route("/preferences").get(GetUserPreference);
userRouter.route("/preferences").put(UpdateUserPreference);
userRouter.route("/preferences/:userId").get(GetUserPreference);
userRouter.route("/reviews").post(SaveUserReview);
userRouter.route("/reviews").get(GetUserReviews);
userRouter.route("/reviews/:userId").get(GetUserReviews);
userRouter.route("/reviews/:reviewId").delete(DeleteUserReview);
userRouter.route("/follow").post(FollowUser);
userRouter.route("/unfollow").post(UnfollowUser);
userRouter.route("/followers/:userId").get(GetUserFollowers);
userRouter.route("/following/:userId").get(GetUserFollowing);
userRouter.route("/followers").get(GetUserFollowers);
userRouter.route("/following").get(GetUserFollowing);
userRouter.route("/profile").get(GetUserProfile);
userRouter.route("/profile/:userId").get(GetUserProfile);
userRouter.route("/GetUserLikedMovies").post(GetUserLikedMovies);
userRouter.route("/LikeMovie").post(LikeMovie);
userRouter.route("/UnlikeMovie").post(UnlikeMovie);
userRouter.route("/AddToWatchlist").post(AddToWatchlist);
userRouter.route("/RemoveFromWatchlist").post(RemoveFromWatchlist);
userRouter.route("/getUserInfo").post(getUserInfo);

export default userRouter;
