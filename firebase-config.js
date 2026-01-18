// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCqIfKRtgcvhmFSFUBppRoamnVQ-ZXp464",
    authDomain: "news-b3639.firebaseapp.com",
    projectId: "news-b3639",
    storageBucket: "news-b3639.firebasestorage.app",
    messagingSenderId: "1023744506196",
    appId: "1:1023744506196:web:c198b9701c98481a84f0c1",
    measurementId: "G-4GMWPJRQ5G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
