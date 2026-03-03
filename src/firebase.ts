import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyChKJS6vl-622evmf7Ea0pwu96H8avAVaE",
    authDomain: "basra-game.firebaseapp.com",
    projectId: "basra-game",
    storageBucket: "basra-game.firebasestorage.app",
    messagingSenderId: "924729196979",
    appId: "1:924729196979:web:2ac421aea3aff746848bc6",
    measurementId: "G-15TVK63C8D"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

export default app;
