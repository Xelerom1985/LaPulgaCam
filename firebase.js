import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAeigxZ52DYvlZT1_zkeh-biVQcNaX3XMg",
  authDomain: "lapulgacam.firebaseapp.com",
  projectId: "lapulgacam",
  messagingSenderId: "1062845411470",
  appId: "1:1062845411470:web:b85116c5efc0bfe43859df",
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const db = getFirestore(app)
