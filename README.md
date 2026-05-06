# Derelict Bicycle Management System

## 📌 Overview
This project is a web-based Derelict Bicycle Management System designed to assist Nee Soon Town Council in managing abandoned bicycles at HDB void decks.

The system improves the current manual workflow by providing a centralized platform for reporting, tracking, tagging, and managing bicycles throughout their lifecycle.

---

## 🎯 Objectives
- Reduce manual tracking of derelict bicycles  
- Improve communication between residents and town council  
- Provide transparency in the tagging and removal process  
- Enhance operational efficiency using a digital system  

---

## 👥 Target Users
- **Residents**: Report abandoned bicycles and claim ownership  
- **Town Council Staff**: Manage reports, tagging, removal, and storage  

---

## 🧩 Key Features

### 🔹 Resident Features
- Report suspected abandoned bicycles  
- Upload photos and location details  
- View bicycle status via QR code  
- Submit claim for tagged bicycles  

### 🔹 Staff Features
- View and manage reported bicycles  
- Generate and print QR code tags  
- Track bicycle status (Reported → Tagged → Removed → Stored → Claimed/Recycled)  
- Search and filter records  
- Dashboard for monitoring trends  

---

## 🔄 System Workflow
1. Resident reports a suspected abandoned bicycle  
2. Staff verifies and tags the bicycle with a QR code  
3. Bicycle enters notice period before removal  
4. Owner can scan QR code to claim or report  
5. If claimed → case closed  
6. If unclaimed → bicycle is removed and stored  
7. Unclaimed bicycles are eventually recycled  

---

## ⚙️ Tech Stack
- **Frontend**: React + JavaScript
- **Build Tool**: Vite
- **Database**: Firebase Firestore
- **Backend Services**: Firebase
- **Version Control**: GitHub
- **Hosting**: To be confirmed

---

## 📦 Installation (For Development)

```bash
# Clone repository
git clone <your-repo-link>

# Navigate into project
cd <project-folder>

# Install dependencies
npm install

# Run development server
npm run dev
```