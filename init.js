require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
    // ignore if restricted
}
const User = require('./models/User');
const Instrument = require('./models/Instrument');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB...'))
    .catch((err) => console.error('Connection error:', err));

const seedDB = async () => {
    try {
        const demoEmail = 'shandilyarishi.2005@gmail.com';
        const user = await User.findOne({ email: demoEmail });

        if (!user) {
            console.log(`❌ Error: User ${demoEmail} not found!`);
            process.exit();
        }

        // Clear existing demo instruments
        await Instrument.deleteMany({ owner: user._id });

        // Base details to reuse across dummy instruments
        const baseDetails = {
            owner: user._id,
            ownerName: 'Rishi Shandilya',
            contactNumber: '+919876543210',
            address: {
                locality: 'Connaught Place',
                city: 'New Delhi',
                district: 'New Delhi',
                state: 'Delhi'
            }
        };

        // Create dummy data matching the NEW schema
        const demoInstruments = [
            { 
                ...baseDetails,
                instrumentId: '#INS-8832', 
                type: 'Industrial Scale', 
                instrumentName: 'Warehouse Main Scale',
                company: 'Avery India',
                modelNo: 'IND-500',
                status: 'Pending Inspection', 
                dateSubmitted: new Date('2026-10-24') 
            },
            { 
                ...baseDetails,
                instrumentId: '#INS-7741', 
                type: 'Weight Indicator', 
                instrumentName: 'Loading Dock Indicator',
                company: 'Essae',
                modelNo: 'DS-852',
                status: 'Certified', 
                dateSubmitted: new Date('2026-09-12') 
            },
            { 
                ...baseDetails,
                instrumentId: '#INS-9921', 
                type: 'Retail Scale', 
                instrumentName: 'Front Counter Scale',
                company: 'CAS',
                modelNo: 'PR-PLUS',
                status: 'Pending Inspection', 
                dateSubmitted: new Date('2026-11-01') 
            }
        ];

        // Save to database
        await Instrument.insertMany(demoInstruments);
        console.log('✅ Success! Demo database seeded with complete instrument profiles.');
        
    } catch (error) {
        console.error('Seeding error:', error);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();