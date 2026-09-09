const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

let credential = null;

// 1. Try loading from FIREBASE_SERVICE_ACCOUNT env var (JSON string)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccountJson = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : process.env.FIREBASE_SERVICE_ACCOUNT;
        credential = cert(serviceAccountJson);
        console.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT env variable.');
    } catch (err) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT environment variable:', err.message);
    }
}

// 2. Try loading from individual Firebase Admin env variables
if (!credential && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.includes('\\n')
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : process.env.FIREBASE_PRIVATE_KEY;
        credential = cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        });
        console.log('Firebase Admin initialized from individual Firebase environment variables.');
    } catch (err) {
        console.error('Error initializing Firebase Admin from individual env vars:', err.message);
    }
}

// 3. Try loading from local serviceAccountKey.json file if it exists
if (!credential) {
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
        try {
            const serviceAccount = require(keyPath);
            credential = cert(serviceAccount);
            console.log('Firebase Admin initialized from serviceAccountKey.json file.');
        } catch (err) {
            console.error('Error loading serviceAccountKey.json file:', err.message);
        }
    }
}

if (!credential) {
    console.error('⚠️ WARNING: No valid Firebase Admin credentials found! Please configure FIREBASE_SERVICE_ACCOUNT or upload serviceAccountKey.json.');
}

const app = getApps().length === 0 ? initializeApp({ credential }) : getApps()[0];

module.exports = getAuth(app);
