// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCWoLKT6wTtl9JOA1bvvR53aMy39rHcvpM",
    authDomain: "car-ble-monitor.firebaseapp.com",
    projectId: "car-ble-monitor",
    storageBucket: "car-ble-monitor.firebasestorage.app",
    messagingSenderId: "965409405054",
    appId: "1:965409405054:web:130d10ff4c85a749e8402f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

console.log('✅ Firebase initialized successfully');