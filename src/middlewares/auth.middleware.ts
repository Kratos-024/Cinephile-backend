import admin from "../config/firebase.config.js";
import { ApiError } from "../utils/ApiError.utils.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName?: string;
  };
}

const authenticateUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(
          401,
          "No token provided or invalid format",
          "UNAUTHORIZED"
        );
      }

      const idToken = authHeader.split(" ")[1];

      if (!idToken) {
        throw new ApiError(401, "No token provided", "UNAUTHORIZED");
      }

      // Verify the ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // Attach user info to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email!,
        displayName: decodedToken.name,
      };

      next();
    } catch (error: any) {
      console.error("Authentication error:", error);

      if (error.code === "auth/id-token-expired") {
        res.status(401).json({
          success: false,
          status: 401,
          message: "Token expired",
          type: "TOKEN_EXPIRED",
        });
      } else if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          status: error.statusCode,
          message: error.message,
          type: error.type,
        });
      } else {
        res.status(401).json({
          success: false,
          status: 401,
          message: "Invalid token",
          type: "INVALID_TOKEN",
        });
      }
    }
  }
);

export { authenticateUser };
