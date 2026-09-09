// middleware/adminAuth.js

const verifySecretAdmin = (req, res, next) => {
    // Force browser to NEVER cache these secure pages
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');

    if (req.headers.cookie && req.headers.cookie.includes('TrueScaleAdmin=Authenticated')) {
        next();
    } else {
        // Redirect to the secret login instead of showing a blank 403 page
        res.redirect('/admin/secret-gateway');
    }
};

// Export it so app.js can grab it!
module.exports = { verifySecretAdmin };