import { Router } from "express";
import {
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
  // Auth
  CreateUserAccount,
  LoginUser,
  ResetPassword,
  GetUserProfile,
} from "../controllers/user.controller.js";
import { authenticateUser } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(CreateUserAccount);
userRouter.route("/login").post(LoginUser);
userRouter.route("/reset-password").post(ResetPassword);
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

export default userRouter;
