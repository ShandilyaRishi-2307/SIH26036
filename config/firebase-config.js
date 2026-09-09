const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Load your service account key
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the Firebase Admin App
const app = initializeApp({
    credential: cert(serviceAccount)
});

// Export the auth module directly
module.exports = getAuth(app);