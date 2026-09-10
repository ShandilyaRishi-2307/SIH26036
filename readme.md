# TrueScale — Legal Metrology & Instrument Verification Platform

TrueScale is a comprehensive digital platform designed to automate and streamline the legal metrology lifecycle for measuring and weighing instruments—encompassing registration, field inspector scheduling, smart dispatching, mobile field report diagnostics with photographic evidence, admin approval workflows, and tamper-proof digital certificates with live QR verification.

---

## 🌟 Key Portals & Architecture

1. **Owner Portal (`/owner/:id`)**:
   - Register instruments & submit verification applications.
   - Pay statutory verification fees via UPI QR code simulation.
   - Live status tracker from application to field inspection to certificate issuance.
   - Access Digital Certificate Vault & monitor upcoming renewal cycles.

2. **Inspector Portal (`/inspect/:id`)**:
   - Inspector task board with active assignments & address routing.
   - Interactive calendar schedule for upcoming physical visits.
   - Dynamic internal sensor diagnostics checklist by instrument classification.
   - Multi-photo evidence upload & compliance outcome submission.
   - Reschedule request queue for closed premises or delayed visits.

3. **Admin Command Center (`/admin/dashboard`)**:
   - Gateway at `/admin/secret-gateway`.
   - Workload-balanced smart auto-assignment of field inspectors by state & district.
   - Field report review gallery with evidence viewer & approval / rejection triggers.
   - Reschedule queue manager for reallocating visit dates.
   - Permanent immutable audit log & certificate issuance ledger.

4. **Public QR Verification (`/verify/:certificateNumber`)**:
   - Publicly accessible QR code link on every certificate for instant on-field validation.

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Node.js `>= 18.0.0`
- MongoDB (Local or MongoDB Atlas)

### 2. Installation
```bash
git clone https://github.com/ShandilyaRishi-2307/demo_project.git
cd demo_project
npm install
```

### 3. Environment Configuration
Copy the `.env.example` file to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
PORT=3000
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.li66p3f.mongodb.net/truescale"

FIREBASE_API_KEY="your-api-key"
FIREBASE_AUTH_DOMAIN="truescale-4243e.firebaseapp.com"
FIREBASE_PROJECT_ID="truescale-4243e"
FIREBASE_STORAGE_BUCKET="truescale-4243e.firebasestorage.app"
FIREBASE_MESSAGING_SENDER_ID="403895394942"
FIREBASE_APP_ID="1:403895394942:web:2d03a8844d1c3fd00aae2f"
```

### 4. Run Development Server
```bash
npm run dev
# or
npm start
```
The server will start at `http://localhost:3000`.

---

## ☁️ Deployment Guide

### Deploying to Render / Railway / Heroku
1. Push this repository to GitHub.
2. In your hosting provider's dashboard, create a new **Web Service**.
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Configure Environment Variables in the hosting dashboard:
   - `PORT`: `3000` (or leave default provided by host)
   - `MONGODB_URI`: Your MongoDB Atlas connection URI
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
   - `FIREBASE_SERVICE_ACCOUNT`: Full Firebase Service Account JSON string (or provide `FIREBASE_CLIENT_EMAIL` & `FIREBASE_PRIVATE_KEY`)
6. Deploy! The `/health` endpoint is available for uptime checks.