const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // 1. Owner Details
    ownerName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    
    // 2. Address Details
    address: {
        locality: { type: String, required: true },
        city: { type: String, required: true },
        district: { type: String, required: true },
        state: { type: String, required: true }
    },

    // 3. Instrument Details
    type: { type: String, required: true },
    instrumentName: { type: String, required: true },
    company: { type: String, required: true },
    modelNo: { type: String, required: true },
    
    // 4. System Fields
    instrumentId: { type: String, required: true, unique: true }, 
    paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    status: { 
        type: String, 
        enum: [
            'Pending',
            'Pending Inspection', 
            'Inspector Assigned', 
            'Investigator Assigned', 
            'Document Approved', 
            'Certificate Generated', 
            'Certified', 
            'Reschedule Requested', 
            'Rejected', 
            'Flagged'
        ], 
        default: 'Pending Inspection' 
    },
    rejectionReason: { type: String },
    dateSubmitted: { type: Date, default: Date.now },
    
    // 5. Assignment Fields
    assignedInspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledDate: { type: Date },
    inspectionDetails: {
        analysisReport: { type: String },
        isGoodToUse: { type: String, enum: ['Yes', 'No'] },
        testOutcomes: [{ type: String }]
    }
});

module.exports = mongoose.model('Instrument', instrumentSchema);