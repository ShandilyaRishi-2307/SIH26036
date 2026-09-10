const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    instrument: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    analysisReport: { type: String, required: true },
    isGoodToUse: { type: String, enum: ['Yes', 'No'], required: true },
    testOutcomes: [{ type: String }], // Array of Base64 or image URLs
    sensorDiagnostics: [{
        name: { type: String },
        threshold: { type: String },
        reading: { type: String },
        error: { type: String }
    }],
    dateSubmitted: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);