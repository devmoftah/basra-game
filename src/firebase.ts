import { initializeApp } from "firebase/app";

import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";

import { getFirestore, doc, updateDoc, deleteDoc } from "firebase/firestore";

import { getDatabase } from "firebase/database";



const firebaseConfig = {

    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyChKJS6vl-622evmf7Ea0pwu96H8avAVaE",

    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "basra-game.firebaseapp.com",

    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "basra-game",

    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "basra-game.firebasestorage.app",

    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "924729196979",

    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:924729196979:web:2ac421aea3aff746848bc6",

    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-15TVK63C8D",

    databaseURL: "https://basra-game-default-rtdb.firebaseio.com/"

};



const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const rtdb = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();

export const appleProvider = new OAuthProvider('apple.com');

export { doc, updateDoc, deleteDoc };

export default app;
