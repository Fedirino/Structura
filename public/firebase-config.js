// ============================================
// STRUCTURA — Firebase Configuration
// ============================================
// INSTRUCTIONS: Paste your Firebase config from
// Firebase Console > Project Settings > General > Your apps > Web app
// Then enable Google sign-in under Authentication > Sign-in method.

const firebaseConfig = {
  apiKey: "AIzaSyBRD1z8L27z-Urea500VfqqiPIw5bs3zlE",
  authDomain: "structura-dunebuilder.firebaseapp.com",
  projectId: "structura-dunebuilder",
  storageBucket: "structura-dunebuilder.firebasestorage.app",
  messagingSenderId: "77474747801",
  appId: "1:77474747801:web:028b9bb2c1b24ca58aaf08"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
