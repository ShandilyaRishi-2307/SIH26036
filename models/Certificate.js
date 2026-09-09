const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    certificateNumber: { type: String, required: true, unique: true },
    issueDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true }, 
    status: { type: String, default: 'Active' }
});

module.exports = mongoose.model('Certificate', certificateSchema);