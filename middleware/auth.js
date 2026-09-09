const auth = require('../config/firebase-config');

const verifyToken = async (req, res, next) => {
    // Check if the token is passed in the headers or cookies
    const idToken = req.headers.authorization?.split('Bearer ')[1] || req.cookies?.token;

    if (!idToken) {
        return res.redirect('/login');
    }

    try {
        // Verify the token using the updated auth object
        const decodedToken = await auth.verifyIdToken(idToken);
        
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Error verifying Firebase token:', error);
        res.redirect('/login');
    }
};

module.exports = verifyToken;