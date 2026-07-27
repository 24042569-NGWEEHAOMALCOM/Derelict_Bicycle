# Derelict Bicycle Management System

A React and Firebase application for managing abandoned and improperly parked bicycle reports for Nee Soon Town Council. Residents can submit and follow up on reports, while authenticated staff manage each case from a real-time dashboard.

## Features

### Resident portal

- Submit abandoned or improperly parked bicycle reports
- View report details and status updates
- Scan QR notice pages
- Claim a removed bicycle
- Report that a bicycle is not abandoned
- Acknowledge improper-parking warnings
- Earn points from verified reports and check lucky-draw eligibility

### Staff portal

- Secure staff login with Firebase Authentication
- Persistent **Staff Dashboard** navigation while signed in
- Automatic idle-session logout
- Real-time report statistics, filtering, and search
- Manage bicycle statuses and warning workflows
- Generate QR codes and printable notice tags
- Review resident claims and acknowledgements
- Run AI-assisted duplicate-image checks
- View bicycle locations and hotspot analytics
- Export reports and monthly lucky-draw results to Excel

## Staff access and navigation

1. Select **Staff Login** in the navigation bar.
2. Sign in with an authorized Firebase Authentication account.
3. After login, the navigation bar displays **Staff Dashboard** and **Logout**.
4. Use **Staff Dashboard** to return to `/staff` from any page. Authentication state is shared across the application, so navigating between Home and the staff dashboard does not require signing in again.
5. Inactive staff sessions are signed out after 15 minutes by default. Set `VITE_SESSION_TIMEOUT_MINUTES` to change this duration.

## Application workflow

1. A resident submits a bicycle report.
2. Staff review and verify the report.
3. Staff tag the bicycle and generate a QR notice when required.
4. The resident scans the QR code and submits the relevant response.
5. Staff review the response and update the case through removal or closure.
6. Dashboard statistics and report lists update in real time.

## Technology

- React 19
- Vite
- React Router
- Firebase Authentication, Firestore, App Check, and Firebase AI
- Bootstrap
- React Leaflet
- Cloudinary
- QRCode
- SheetJS

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/kakian/FYP-2610-0029-Monitor-Derelict-Bicycles-Team-0064.git
cd FYP-2610-0029-Monitor-Derelict-Bicycles-Team-0064
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and replace the placeholder values with the project credentials.

Required configuration includes:

- Firebase web application credentials
- Cloudinary cloud name and unsigned upload preset
- reCAPTCHA v3 site key for Firebase App Check
- Firebase AI model name
- Optional staff session timeout

Do not commit `.env` or expose private credentials in the repository.

### 4. Start the development server

```bash
npm run dev
```

Open `http://localhost:5173`.

For testing from another device on the same network:

```bash
npm run dev -- --host
```

Use the network URL displayed by Vite. QR codes use the application's current origin, so generate them from the URL that residents will access.

## Available commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Firebase access

Team members who need administrative access must be added to the Firebase project. Staff who use the application must have an authorized Firebase Authentication account.

Firestore access is controlled by [`firestore.rules`](firestore.rules).

## Contribution workflow

Before starting:

```bash
git pull origin main
```

After making and validating changes:

```bash
git add <files>
git commit -m "Describe the change"
git push origin main
```

Review `git status` and the staged diff before committing so unrelated local changes are not included.
