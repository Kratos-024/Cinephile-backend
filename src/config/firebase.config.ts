// Fixed Firebase initialization with proper JSON import
import admin from "firebase-admin";
import { readFileSync } from "fs";

// Read the JSON file properly
const serviceAccount = JSON.parse(
  readFileSync("./firebase-service-account.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL, // Keep this from your .env file if you have it
  });
}

export const db = admin.firestore();
export default admin;
