const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, unique: true, sparse: true }, 
    email: { type: String, required: true },
    role: { type: String, enum: ['Owner', 'Admin', 'Inspector'], default: 'Owner' },
    password: { type: String },
    
    // NEW: Inspector Details
    name: { type: String },
    location: {
        state: { type: String },
        district: { type: String }
    }
});

module.exports = mongoose.model('User', userSchema);