// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCSA4Qkt3rj7Juijpwi45ZKGcVHSjdvvVw",
  authDomain: "trainlinkeureal.firebaseapp.com",
  projectId: "trainlinkeureal",
  storageBucket: "trainlinkeureal.firebasestorage.app",
  messagingSenderId: "630231025389",
  appId: "1:630231025389:web:cebfb048c5b95b95616ee4",
  measurementId: "G-24Q1VQFNM3"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics only in browser environment
export let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
} 