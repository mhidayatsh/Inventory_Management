// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDiwhx7Hn9q49G2XVoNkYDtQZWX5GYOy5k",
    authDomain: "razi-8ae15.firebaseapp.com",
    projectId: "razi-8ae15",
    storageBucket: "razi-8ae15.firebasestorage.app",
    messagingSenderId: "1037796237711",
    appId: "1:1037796237711:web:c64a5c32d5545638066bfa",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Fetch user role from Firestore by User ID
export async function getUserRole(userId?: string): Promise<'admin' | 'staff'> {
  if (!userId) {
    console.error("No user ID provided to getUserRole");
    throw new Error("User ID is required");
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (!userData.role) {
        console.error("User document exists but has no role:", userData);
        throw new Error("User role not found");
      }
      return userData.role as 'admin' | 'staff';
    } else {
      console.error("User document not found for ID:", userId);
      throw new Error("User document not found");
    }
  } catch (error) {
    console.error("Error fetching user role:", error);
    throw error;
  }
}