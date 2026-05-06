## 🚀 Project Setup Guide (For Team Members)

### 1. Clone Repository

```bash
git clone https://github.com/24042569-NGWEEHAOMALCOM/Derelict_Bicycle.git
```

---

### 2. Navigate Into Project Folder

```bash
cd Derelict_Bicycle
```

---

### 3. Install Dependencies

```bash
npm install
```

---

### 4. Start Development Server

```bash
npm run dev
```

App will run on:

```text
http://localhost:5173
```

---

## 🔥 Firebase Setup

This project uses Firebase:
- Firestore Database
- Firebase Storage (upcoming)
- Authentication (upcoming)

### Important:
Team members must be added into the Firebase project to access:
- Firestore Console
- Firebase settings
- Authentication
- Storage

Contact project owner for Firebase access permissions.

---

## 📌 Current Features Implemented

### Resident Features
- Submit bicycle reports
- Track report status
- Scan QR notice pages
- Claim bicycle
- Report bicycle as not abandoned

### Staff Features
- View all reports
- Update bicycle statuses
- Generate QR codes
- Print QR notice tags

---

## 🔄 Current Workflow

1. Resident reports abandoned bicycle
2. Staff reviews report
3. Staff tags bicycle
4. QR code generated
5. Resident scans QR code
6. Resident can:
   - Claim bicycle
   - Report not abandoned
7. Staff dashboard updates automatically

---

## ⚠️ Important Notes

### QR Codes
QR codes currently use localhost during development:

```text
http://localhost:5173
```

For mobile testing on same network:

```bash
npm run dev -- --host
```

Use the Network IP shown by Vite.

---

## 🛠 Tech Stack

- React
- Vite
- Firebase Firestore
- Bootstrap
- QRCode Library

---

## 👨‍💻 Development Notes

Before pushing changes:

```bash
git add .
git commit -m "Your commit message"
git push
```

Always pull latest changes before starting work:

```bash
git pull origin main
```
