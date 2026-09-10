const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let app;

if (!getApps().length) {
    let credential;

    // 1. Check for complete service account JSON string in environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const parsed = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                : process.env.FIREBASE_SERVICE_ACCOUNT;
            credential = cert(parsed);
        } catch (e) {
            console.error('Error parsing FIREBASE_SERVICE_ACCOUNT environment variable:', e);
        }
    }

    // 2. Check for individual credentials in environment variables
    if (!credential && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        credential = cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        });
    }

    // 3. Check for local serviceAccountKey.json file (local development)
    if (!credential) {
        const localKeyPath = path.join(__dirname, 'serviceAccountKey.json');
        if (fs.existsSync(localKeyPath)) {
            try {
                const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
                credential = cert(serviceAccount);
            } catch (err) {
                console.error('Error reading local serviceAccountKey.json:', err);
            }
        }
    }

    // 4. Fallback to Google Application Default credentials
    if (!credential) {
        try {
            credential = applicationDefault();
        } catch (err) {
            console.warn('Warning: Firebase Admin initialized without explicit service account credentials.');
        }
    }

    app = initializeApp({
        ...(credential ? { credential } : {}),
        projectId: process.env.FIREBASE_PROJECT_ID || 'truescale-4243e'
    });
} else {
    app = getApps()[0];
}

module.exports = getAuth(app);