const express = require('express');
const app = express();
const path = require('path');
const port = process.env.PORT || 8080;
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
require('dotenv').config();

const User = require('./models/User');
const Instrument = require('./models/Instrument');
const Report = require('./models/Report');
const Certificate = require('./models/Certificate');
const AdminLog = require('./models/AdminLog');
const verifyToken = require('./middleware/auth');
const { verifySecretAdmin } = require('./middleware/adminAuth');

// --- Setup & Configuration ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/images', express.static(path.join(__dirname, 'views/images')));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

if (!process.env.MONGODB_URI) {
    console.error('⚠️ CRITICAL: MONGODB_URI is not set in environment variables! Database features will not work.');
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully'))
    .catch((err) => console.error('❌ MongoDB connection error:', err.message || err));

const firebaseConfig = {
    apiKey: (process.env.FIREBASE_API_KEY || '').trim(),
    authDomain: (process.env.FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: (process.env.FIREBASE_PROJECT_ID || '').trim(),
    storageBucket: (process.env.FIREBASE_STORAGE_BUCKET || '').trim(),
    messagingSenderId: (process.env.FIREBASE_MESSAGING_SENDER_ID || '').trim(),
    appId: (process.env.FIREBASE_APP_ID || '').trim()
};
app.locals.firebaseConfig = firebaseConfig;

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: states[dbState] || 'Unknown',
        uptime: process.uptime()
    });
});

// --- Inspector Middleware Fix ---
const verifyInspector = (req, res, next) => {
    const inspectorId = req.cookies.TrueScaleInspector;
    if (!inspectorId) return res.redirect('/login');
    if (req.params.id && req.params.id !== inspectorId) return res.redirect('/login');
    req.inspectorId = inspectorId; 
    next();
};

// --- Public Routes ---
app.get('/', (req, res) => res.render('index.ejs'));
app.get('/signup', (req, res) => res.render('signup', { firebaseConfig }));
app.get('/login', (req, res) => res.render('login', { firebaseConfig }));

app.post('/api/users', verifyToken, async (req, res) => {
    try {
        let user = await User.findOne({ firebaseUid: req.user.uid });
        if (!user && req.user.email) {
            user = await User.findOne({ email: req.user.email });
            if (user) {
                user.firebaseUid = req.user.uid;
                await user.save();
                return res.status(200).json({ success: true, message: 'User updated' });
            }
        }
        if (!user) {
            user = new User({ firebaseUid: req.user.uid, email: req.user.email, role: req.body.role || 'Owner' });
            await user.save();
        }
        res.status(201).json({ success: true });
    } catch (error) { 
        console.error('Error creating/updating user in /api/users:', error);
        res.status(500).json({ success: false, error: error.message }); 
    }
});

app.get('/auth/redirect', verifyToken, async (req, res) => {
    try {
        let user = await User.findOne({ firebaseUid: req.user.uid });

        // Fallback: If user authenticated in Firebase but doesn't exist in MongoDB yet, provision them
        if (!user && req.user.email) {
            user = await User.findOne({ email: req.user.email });
            if (user) {
                user.firebaseUid = req.user.uid;
                await user.save();
            }
        }

        if (!user) {
            console.log(`Auto-creating new Owner profile for Firebase UID: ${req.user.uid} (${req.user.email})`);
            user = new User({
                firebaseUid: req.user.uid,
                email: req.user.email || 'unknown@truescale.com',
                role: 'Owner'
            });
            await user.save();
        }

        if (user.role === 'Owner') return res.redirect(`/owner/${user._id}`);
        if (user.role === 'Inspector') return res.redirect(`/inspect/${user._id}`);
        res.redirect('/login');
    } catch (error) { 
        console.error('CRITICAL Error in /auth/redirect:', error);
        res.status(500).send(`Server Error: ${error.message || 'Error communicating with database.'}`); 
    }
});

// --- Admin Portal ---
app.get('/admin/secret-gateway', (req, res) => res.render('admin/secret-login'));

app.post('/admin/secret-gateway', (req, res) => {
    if (req.body.email === 'rajnanda4ever@gmail.com' && req.body.password === 'Raj@1234') {
        res.cookie('TrueScaleAdmin', 'Authenticated', { httpOnly: true });
        res.redirect('/admin/dashboard');
    } else {
        res.send(`<script>alert("Unauthorized."); window.location.href="/admin/secret-gateway";</script>`);
    }
});

app.get('/admin/logout', (req, res) => {
    res.clearCookie('TrueScaleAdmin');
    res.redirect('/admin/secret-gateway');
});

app.get('/admin/dashboard', verifySecretAdmin, async (req, res) => {
    try {
        // 1. Count New Applications waiting for an Inspector
        const assignCount = await Instrument.countDocuments({ 
            status: 'Pending Inspection', 
            paymentStatus: 'Paid',
            assignedInspector: { $exists: false }
        });

        // 2. Count submitted field reports waiting for Admin approval
        const reviewCount = await Instrument.countDocuments({ 
            status: 'Document Approved' 
        });

        // 3. Count failed inspections requesting a new date
        const rescheduleCount = await Instrument.countDocuments({ 
            status: 'Reschedule Requested' 
        });

        // Pass all three numbers to the frontend
        res.render('admin/dashboard', { assignCount, reviewCount, rescheduleCount });
    } catch (error) { 
        res.status(500).send('Server Error'); 
    }
});

app.get('/admin/add-inspector', verifySecretAdmin, (req, res) => res.render('admin/add-inspector'));

app.post('/api/admin/add-inspector', verifySecretAdmin, async (req, res) => {
    try {
        const { name, email, password, state, district } = req.body;
        const newInspector = new User({
            name, email, role: 'Inspector', password,
            firebaseUid: 'internal_inspector_' + new mongoose.Types.ObjectId(), 
            location: { state, district }
        });
        await newInspector.save();
        await new AdminLog({ actionType: 'Inspector Onboarded', description: `Registered ${name} (${district}, ${state}).` }).save();
        res.send(`<script>alert("Inspector ${name} created!"); window.location.href="/admin/dashboard";</script>`);
    } catch (err) { res.status(500).send(`<script>alert("Error."); window.history.back();</script>`); }
});

app.get('/admin/assign-inspector', verifySecretAdmin, async (req, res) => {
    try {
        const stateData = await Instrument.aggregate([
            { $match: { paymentStatus: 'Paid', status: 'Pending Inspection', assignedInspector: { $exists: false } } },
            { $group: { _id: "$address.state", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        if (stateData.length === 0) return res.send(`<script>alert("All caught up!"); window.location.href="/admin/dashboard";</script>`);
        res.render('admin/states', { stateData });
    } catch (error) { res.status(500).send('Server Error'); }
});

app.get('/admin/assign-inspector/:state', verifySecretAdmin, async (req, res) => {
    try {
        const districtData = await Instrument.aggregate([
            { $match: { paymentStatus: 'Paid', status: 'Pending Inspection', assignedInspector: { $exists: false }, "address.state": req.params.state } },
            { $group: { _id: "$address.district", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.render('admin/districts', { selectedState: req.params.state, districtData });
    } catch (error) { res.status(500).send('Server Error'); }
});

app.get('/admin/assign-inspector/:state/:district', verifySecretAdmin, async (req, res) => {
    try {
        const { state, district } = req.params;
        const requests = await Instrument.find({ 
            paymentStatus: 'Paid', status: 'Pending Inspection', assignedInspector: { $exists: false }, "address.state": state, "address.district": district
        }).sort({ 'address.city': 1 });
        const inspectors = await User.find({ role: 'Inspector', 'location.state': state, 'location.district': district });
        res.render('admin/assign-requests', { state, district, requests, inspectors });
    } catch (error) { res.status(500).send('Server Error'); }
});

// --- Smart Auto-Assign Route (Round Robin) ---
app.post('/api/admin/assign', verifySecretAdmin, async (req, res) => {
    try {
        const { instrumentId, scheduledDate } = req.body;
        
        // Setup the date range to count tasks for that specific day
        const selectedDate = new Date(scheduledDate);
        const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

        // 1. Get the instrument to find out which state and district it is in
        const instrument = await Instrument.findById(instrumentId);
        if (!instrument) return res.status(404).send('Instrument not found');

        const { state, district } = instrument.address;

        // 2. Find ALL eligible inspectors in that specific district
        const inspectors = await User.find({ 
            role: 'Inspector', 
            'location.state': state, 
            'location.district': district 
        });

        if (inspectors.length === 0) {
            return res.send(`<script>alert("No inspectors available in this district."); window.history.back();</script>`);
        }

        // 3. Calculate current workload for every inspector on that date
        let inspectorWorkloads = [];
        for (let inspector of inspectors) {
            const dailyTaskCount = await Instrument.countDocuments({
                assignedInspector: inspector._id, 
                scheduledDate: { $gte: startOfDay, $lte: endOfDay }
            });
            
            inspectorWorkloads.push({ 
                inspectorId: inspector._id, 
                name: inspector.name,
                taskCount: dailyTaskCount 
            });
        }

        // 4. Sort inspectors so the one with the least tasks is at the very top (0, then 1, then 2...)
        inspectorWorkloads.sort((a, b) => a.taskCount - b.taskCount);

        // 5. Select the absolute best candidate
        const bestInspector = inspectorWorkloads[0];

        // 6. Enforce the absolute limit of 10 tasks per day
        if (bestInspector.taskCount >= 10) {
            return res.send(`<script>alert("Limit Exceeded! All inspectors in this district already have 10 tasks scheduled for this date."); window.history.back();</script>`);
        }

        // 7. Assign the task to the selected inspector
        await Instrument.findByIdAndUpdate(instrumentId, { 
            assignedInspector: bestInspector.inspectorId, 
            scheduledDate: scheduledDate, 
            status: 'Inspector Assigned' 
        });
        
        // Log the intelligent assignment for the Admin to see
        await new AdminLog({ 
            actionType: 'Task Assigned', 
            description: `Auto-Deployed Inspector ${bestInspector.name} (Current load: ${bestInspector.taskCount} tasks) to instrument ID: ${instrument.instrumentId}.` 
        }).save();
        
        res.redirect('/admin/assign-inspector');
        
    } catch (error) { 
        console.error("Auto-Assign Error:", error);
        res.status(500).send('Server Error'); 
    }
});

app.get('/admin/review-reports', verifySecretAdmin, async (req, res) => {
    try {
        const pendingInstruments = await Instrument.find({ status: 'Document Approved' });
        if (pendingInstruments.length === 0) return res.send(`<script>alert("Inbox Zero!"); window.location.href="/admin/dashboard";</script>`);
        
        const reports = await Report.find({ instrument: { $in: pendingInstruments.map(i => i._id) } }).populate('instrument').populate('inspector').sort({ dateSubmitted: -1 });
        res.render('admin/review-reports', { reports });
    } catch (error) { res.status(500).send('Server Error'); }
});

app.post('/api/admin/process-report', verifySecretAdmin, async (req, res) => {
    try {
        const { instrumentId, action, rejectionMessage } = req.body;
        if (action === 'Approve') {
            const certNum = 'TS-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            await new Certificate({
                instrument: instrumentId, certificateNumber: certNum, expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 3))
            }).save();
            await Instrument.findByIdAndUpdate(instrumentId, { status: 'Certificate Generated' });
        } else if (action === 'Reject') {
            await Instrument.findByIdAndUpdate(instrumentId, { status: 'Rejected', rejectionReason: rejectionMessage || 'Failed field verification.' });
        }
        res.redirect('/admin/review-reports');
    } catch (error) { res.status(500).send('Server Error'); }
});

app.get('/admin/reschedule-requests', verifySecretAdmin, async (req, res) => {
    try {
        const requests = await Instrument.find({ status: 'Reschedule Requested' }).populate('assignedInspector');
        if (requests.length === 0) return res.send(`<script>alert("Queue empty!"); window.location.href="/admin/dashboard";</script>`);
        res.render('admin/reschedule-requests', { requests });
    } catch (error) { res.status(500).send("Server Error"); }
});

app.post('/api/admin/process-reschedule', verifySecretAdmin, async (req, res) => {
    try {
        const inst = await Instrument.findByIdAndUpdate(req.body.instrumentId, { scheduledDate: req.body.newDate, status: 'Inspector Assigned' });
        await new AdminLog({ actionType: 'Task Rescheduled', description: `Admin assigned new date for ${inst.instrumentId}.` }).save();
        res.redirect('/admin/reschedule-requests');
    } catch (error) { res.status(500).send("Server Error"); }
});

app.get('/admin/history', verifySecretAdmin, async (req, res) => {
    try {
        const history = await Certificate.find().populate('instrument').sort({ issueDate: -1 });
        const adminLogs = await AdminLog.find().sort({ timestamp: -1 }).limit(50);
        res.render('admin/history', { history, adminLogs });
    } catch (error) { res.status(500).send('Server Error'); }
});

// --- Inspector Portal ---
app.post('/api/login/inspector', async (req, res) => {
    try {
        const inspector = await User.findOne({ email: req.body.email, role: 'Inspector', password: req.body.password });
        if (inspector) {
            res.cookie('TrueScaleInspector', inspector._id.toString(), { httpOnly: true });
            res.json({ success: true, redirectUrl: `/inspect/${inspector._id}` });
        } else { 
            res.status(401).json({ success: false }); 
        }
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/logout/inspector', (req, res) => {
    res.clearCookie('TrueScaleInspector');
    res.redirect('/login');
});

app.get('/inspect/:id', verifyInspector, async (req, res) => {
    try {
        const inspector = await User.findById(req.params.id);
        const tasks = await Instrument.find({ assignedInspector: inspector._id }).sort({ scheduledDate: 1 });
        
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const completedCount = await Report.countDocuments({ inspector: inspector._id, dateSubmitted: { $gte: startOfMonth } });
        const today = new Date().setHours(0,0,0,0);
        
        let pendingCount = 0, assignedCount = 0;
        tasks.forEach(t => {
            if (t.status === 'Inspector Assigned') {
                assignedCount++;
                if (new Date(t.scheduledDate) <= today) pendingCount++;
            }
        });

        res.render('inspector/dashboard', { userEmail: inspector.email, userId: inspector._id, tasks, metrics: { assigned: assignedCount, pending: pendingCount, completed: completedCount } });
    } catch (error) { res.redirect('/login'); }
});

app.get('/inspect/:id/assigned', verifyInspector, async (req, res) => {
    try {
        const tasks = await Instrument.find({ assignedInspector: req.params.id, status: 'Inspector Assigned' }).sort({ scheduledDate: 1 });
        const inspector = await User.findById(req.params.id);
        res.render('inspector/assigned', { userEmail: inspector.email, userId: inspector._id, tasks });
    } catch (error) { res.redirect('/login'); }
});

app.get('/inspect/:id/schedule', verifyInspector, async (req, res) => {
    try {
        const inspector = await User.findById(req.params.id);
        
        // Removed the 'status' filter so it fetches ALL past & future tasks
        const rawTasks = await Instrument.find({ 
            assignedInspector: inspector._id
        }).sort({ scheduledDate: 1 });

        res.render('inspector/schedule', { 
            userEmail: inspector.email, 
            userId: inspector._id, 
            tasksJson: JSON.stringify(rawTasks) 
        });
    } catch (error) { 
        res.redirect('/login'); 
    }
});

app.get('/inspect/:id/reschedule', verifyInspector, async (req, res) => {
    try {
        const inspector = await User.findById(req.params.id);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

        const activeTasks = await Instrument.find({ assignedInspector: inspector._id, status: 'Inspector Assigned', scheduledDate: { $gte: todayStart, $lte: todayEnd } }).sort({ scheduledDate: 1 });
        const pendingRequests = await Instrument.find({ assignedInspector: inspector._id, status: 'Reschedule Requested' });

        res.render('inspector/reschedule', { userEmail: inspector.email, userId: inspector._id, activeTasks, pendingRequests });
    } catch (error) { res.redirect('/login'); }
});

app.post('/api/inspect/request-reschedule', verifyInspector, async (req, res) => {
    try {
        const { instrumentId, reason } = req.body;
        const inst = await Instrument.findByIdAndUpdate(instrumentId, { status: 'Reschedule Requested' });
        await new AdminLog({ actionType: 'Reschedule Requested', description: `Inspector requested reschedule for ${inst.instrumentId}. Reason: ${reason}` }).save();
        res.send(`<script>alert("Reschedule request successfully sent to Admin!"); window.location.href="/inspect/${req.inspectorId}/reschedule";</script>`);
    } catch (error) { res.redirect('/login'); }
});

app.get('/inspect/:id/history', verifyInspector, async (req, res) => {
    try {
        const inspector = await User.findById(req.params.id);
        const history = await Report.find({ inspector: inspector._id }).populate('instrument').sort({ dateSubmitted: -1 });
        res.render('inspector/history', { userEmail: inspector.email, userId: inspector._id, history });
    } catch (error) { res.redirect('/login'); }
});

app.get('/inspect/:id/report/:instrumentId', verifyInspector, async (req, res) => {
    try {
        const instrument = await Instrument.findById(req.params.instrumentId);
        if (!instrument) return res.status(404).send('Instrument not found');

        const today = new Date().setHours(0, 0, 0, 0);
        const scheduledDate = new Date(instrument.scheduledDate).setHours(0, 0, 0, 0);

        if (today !== scheduledDate) return res.send(`<script>alert("Access Denied: Allowed only on exact scheduled date."); window.history.back();</script>`);

        const inspector = await User.findById(req.params.id);
        res.render('inspector/inspector-report', { userEmail: inspector.email, userId: inspector._id, instrument });
    } catch (error) { res.redirect('/login'); }
});

app.post('/api/inspect/:id/submit-report', verifyInspector, upload.fields([
    { name: 'test1', maxCount: 1 }, { name: 'test2', maxCount: 1 }, { name: 'test3', maxCount: 1 }, { name: 'test4', maxCount: 1 }, { name: 'test5', maxCount: 1 }
]), async (req, res) => {
    try {
        const testOutcomes = [];
        
        for (let i = 1; i <= 5; i++) {
            if (req.files[`test${i}`]) {
                const file = req.files[`test${i}`][0];
                // Convert the file buffer to a Base64 string for MongoDB storage
                const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
                testOutcomes.push(base64Image);
            }
        }

        await new Report({ 
            instrument: req.body.instrumentId, 
            inspector: req.inspectorId, 
            analysisReport: req.body.analysisReport, 
            isGoodToUse: req.body.isGoodToUse, 
            testOutcomes 
        }).save();
        
        await Instrument.findByIdAndUpdate(req.body.instrumentId, { status: 'Document Approved' });
        res.redirect(`/inspect/${req.inspectorId}`);
    } catch (error) { 
        res.status(500).send('Server Error'); 
    }
});

// --- Owner Portal ---
app.get('/owner/:id', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        if (!owner || owner.firebaseUid !== req.user.uid) return res.status(403).send('Unauthorized');

        const searchQuery = req.query.search;
        let dbFilter = { owner: owner._id };
        if (searchQuery) dbFilter.instrumentId = { $regex: searchQuery, $options: 'i' };

        const instruments = await Instrument.find(dbFilter).sort({ dateSubmitted: -1 });
        const allInstruments = await Instrument.find({ owner: owner._id });
        
        const dueVerifications = await Certificate.find({ instrument: { $in: allInstruments.map(i => i._id) } }).populate('instrument').sort({ expiryDate: 1 });
        
        const metrics = {
            total: allInstruments.length,
            pending: allInstruments.filter(i => ['Pending', 'Pending Inspection', 'Inspector Assigned', 'Document Approved'].includes(i.status)).length,
            active: allInstruments.filter(i => i.status === 'Certificate Generated').length
        };

        res.render('owner/dashboard', { userId: owner._id, userEmail: req.user.email, firebaseConfig, instruments, dueVerifications, metrics, searchQuery: searchQuery || '' });
    } catch (error) { res.redirect('/login'); }
});

app.get('/owner/:id/apply', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        res.render('owner/apply', { userId: owner._id, userEmail: req.user.email, firebaseConfig });
    } catch (error) { res.redirect('/login'); }
});

app.post('/api/instruments', verifyToken, async (req, res) => {
    try {
        const owner = await User.findOne({ firebaseUid: req.user.uid });
        if (!owner) return res.status(403).send('Unauthorized');

        const newInstrument = new Instrument({
            owner: owner._id,
            instrumentId: req.body.instrumentId || 'INS-' + Math.floor(1000 + Math.random() * 9000),
            ownerName: req.body.ownerName || 'Unknown',
            contactNumber: req.body.contactNumber || '0000000000',
            address: { locality: req.body.locality, city: req.body.city, district: req.body.district, state: req.body.state },
            type: req.body.type, instrumentName: req.body.instrumentName, company: req.body.company, modelNo: req.body.modelNo, 
            paymentStatus: 'Pending', status: 'Pending Inspection'
        });

        await newInstrument.save();
        res.redirect(`/owner/${owner._id}/apply/pay/${newInstrument._id}`);
    } catch (error) { res.status(500).send('Error submitting application.'); }
});

app.get('/owner/:id/apply/pay/:instrumentId', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        const instrument = await Instrument.findById(req.params.instrumentId);
        res.render('owner/pay', { userId: owner._id, userEmail: req.user.email, firebaseConfig, instrument });
    } catch (error) { res.redirect('/login'); }
});

app.post('/api/instruments/:instrumentId/confirm-payment', verifyToken, async (req, res) => {
    try {
        const owner = await User.findOne({ firebaseUid: req.user.uid });
        if (req.body.transactionId !== '9696') return res.send(`<script>alert("Invalid code!"); window.history.back();</script>`);
        await Instrument.findOneAndUpdate({ _id: req.params.instrumentId, owner: owner._id }, { paymentStatus: 'Paid' });
        res.redirect(`/owner/${owner._id}`);
    } catch (error) { res.status(500).send('Error confirming payment.'); }
});

app.get('/owner/:id/status', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        const instruments = await Instrument.find({ owner: owner._id }).populate('assignedInspector', 'name').sort({ dateSubmitted: -1 });
        res.render('owner/status', { userId: owner._id, userEmail: req.user.email, firebaseConfig, instruments });
    } catch (error) { res.redirect('/login'); }
});

app.get('/owner/:id/certificate/:instrumentId', verifyToken, async (req, res) => {
    try {
        const certificate = await Certificate.findOne({ instrument: req.params.instrumentId }).populate('instrument');
        if (!certificate) return res.send("Certificate not generated yet.");
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.render('owner/certificate', { certificate, baseUrl, isPublicVerify: false });
    } catch (error) { res.redirect('/login'); }
});

// --- Public Certificate Verification / QR Scan Routes ---
app.get('/verify/:certificateNumber', async (req, res) => {
    try {
        const certNumber = (req.params.certificateNumber || '').trim();
        const certificate = await Certificate.findOne({ 
            certificateNumber: { $regex: new RegExp(`^${certNumber}$`, 'i') } 
        }).populate('instrument');

        if (!certificate) {
            return res.status(404).render('verify-not-found', { certificateNumber: certNumber });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.render('owner/certificate', { certificate, baseUrl, isPublicVerify: true });
    } catch (error) { 
        console.error("Verification Route Error:", error);
        res.status(500).send("Error verifying certificate."); 
    }
});

app.get('/verify', (req, res) => {
    if (req.query.cert) {
        return res.redirect(`/verify/${encodeURIComponent(req.query.cert.trim())}`);
    }
    res.redirect('/docs/qr-verification');
});

app.get('/certificate/verify/:certificateNumber', (req, res) => {
    res.redirect(`/verify/${req.params.certificateNumber}`);
});

app.get('/owner/:id/instruments', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        if (!owner || owner.firebaseUid !== req.user.uid) return res.status(403).send('Unauthorized');
        const instruments = await Instrument.find({ owner: owner._id }).sort({ dateSubmitted: -1 });
        res.render('owner/instruments', { userId: owner._id, userEmail: req.user.email, firebaseConfig, instruments });
    } catch (error) { res.redirect('/login'); }
});

app.get('/owner/:id/due-verifications', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        if (!owner || owner.firebaseUid !== req.user.uid) return res.status(403).send('Unauthorized');
        const dueVerifications = await Certificate.find({ instrument: { $in: (await Instrument.find({ owner: owner._id })).map(i => i._id) } }).populate('instrument').sort({ expiryDate: 1 }); 
        res.render('owner/due-verifications', { userId: owner._id, userEmail: req.user.email, firebaseConfig, dueVerifications });
    } catch (error) { res.redirect('/login'); }
});

app.get('/owner/:id/certificates', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.params.id);
        if (!owner || owner.firebaseUid !== req.user.uid) return res.status(403).send('Unauthorized');
        const certificates = await Certificate.find({ instrument: { $in: (await Instrument.find({ owner: owner._id })).map(i => i._id) } }).populate('instrument').sort({ issueDate: -1 }); 
        res.render('owner/certificates', { userId: owner._id, userEmail: req.user.email, firebaseConfig, certificates });
    } catch (error) { res.redirect('/login'); }
});




//docs routes
app.get('/docs/digital-verification', (req, res) => res.render('docs/digital-verification'));
app.get('/docs/inspector-assignment', (req, res) => res.render('docs/inspector-assignment'));
app.get('/docs/field-inspection', (req, res) => res.render('docs/field-inspection'));
app.get('/docs/certificates', (req, res) => res.render('docs/certificates'));
app.get('/docs/owner-portal', (req, res) => res.render('docs/owner-portal'));
app.get('/docs/inspector-portal', (req, res) => res.render('docs/inspector-portal'));
app.get('/docs/admin-portal', (req, res) => res.render('docs/admin-portal'));



app.listen(port, () => console.log(`App is running on http://localhost:${port}`));
