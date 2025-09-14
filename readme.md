# 🚀 Finance Tracker - Smart Financial Management System

A modern, AI-powered finance tracking application built with React, Redux, and Material-UI. Features intelligent document processing, real-time analytics, and comprehensive financial insights with beautiful dark/light mode support.

---

## 📋 Table of Contents

- [Features](#-features)
- [Demo](#-demo)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Steps to Run Locally](#-steps-to-run-locally)
- [Environment Variables](#-environment-variables)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## ✨ Features

### 🤖 AI-Powered Document Processing
- Smart OCR with Tesseract.js + Google Vision API
- Automatic receipt and bank statement parsing
- AI-powered expense categorization (Google Gemini 1.5 Flash)
- Manual review and correction system

### 📊 Advanced Analytics & Reporting
- Real-time dashboard with animated charts
- Daily, weekly, monthly trends
- Category-based insights
- Export data as PDF, CSV, Excel

### 💫 Modern User Experience
- Dark/Light mode with smooth transitions
- Responsive design (mobile-first)
- Glassmorphism UI
- Progressive Web App support

---

## 🎥 Demo

🔗 *Live Demo*: [https://expense-tracker-demo.vercel.app](https://expense-tracker-demo.vercel.app)[Video](https://drive.google.com/file/d/1ghSz7YQMsPT2ghpAl6uZSi1fLfMGNx22/view?usp=sharing)

---

## 📱 Screenshots

<div align="center">

### Dashboard Overview  
### Transaction Management  
### AI-Powered Upload  
### Analytics & Insights  

</div>

---

## 🛠 Tech Stack

### Frontend
- React 18
- Redux Toolkit
- Material-UI v5
- Framer Motion
- Recharts
- Day.js

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Multer (file uploads)

### AI & Cloud
- Google Gemini 1.5 Flash
- Tesseract.js
- Google Vision API
- Cloudinary

### Development Tools
- Vite
- ESLint + Prettier
- Husky (Git hooks)

---

## 📁 Project Structure

finance-tracker/ ├── frontend/       # React app ├── backend/        # Node.js + Express app ├── docs/           # Documentation ├── docker-compose.yml └── README.md

---

## 📋 Prerequisites

- Node.js v18+  
- npm v8+ or yarn  
- MongoDB v6+  
- Git  

---

## 🚀 Steps to Run Locally

bash
# 1. Clone the repository
git clone https://github.com/Amitkr-2004/Finance.git
cd Finance

# 2. Setup and run backend
cd backend
npm install

# Create .env file and update environment variables (see below)
npm run dev

# 3. Setup and run frontend
cd ../frontend
npm install
npm start

Frontend: http://localhost:3000

Backend: http://localhost:5000



---

🔧 Environment Variables

Backend (/backend/.env)

PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/finance-tracker
JWT_SECRET=your-secret
JWT_EXPIRE=7d

# AI Services
GEMINI_API_KEY=your-google-gemini-api-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/vision.json
GOOGLE_PROJECT_ID=your-google-project-id

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
FRONTEND_URL=http://localhost:3000

Frontend (/frontend/.env.local)

REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_AI_FEATURES=true


---

📖 Usage

1. Register/Login to your account


2. Upload receipts or statements


3. Review & edit AI-extracted transactions


4. Analyze trends in the Analytics page


5. Export data as needed




---

📚 API Documentation

Auth

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/profile

Transactions

GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id

Upload

POST /api/upload/receipt
POST /api/upload/bank-statement


---

🤝 Contributing

1. Fork the repo


2. Create a branch (git checkout -b feature/awesome-feature)


3. Commit changes (git commit -m 'Add awesome feature')


4. Push (git push origin feature/awesome-feature)


5. Open a Pull Request




---

📄 License

MIT License © 2024 Amit Kumar


---

📧 Support & Contact

GitHub: @Amitkr-2004

Email: your-email@example.com



---

<div align="center">⭐ If you like this project, don’t forget to star the repo!

Built with ❤ using React, Node.js, and modern web technologies.

</div>

---