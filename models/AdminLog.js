const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
    actionType: { type: String, required: true }, // e.g., 'Inspector Onboarded', 'Task Assigned'
    description: { type: String, required: true }, // Detailed text of what happened
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminLog', adminLogSchema);