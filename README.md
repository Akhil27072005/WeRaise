# 👥 WeRaise Crowdfunding Platform

**WeRaise** is a comprehensive, full-stack crowdfunding application designed to securely connect project creators and backers.  
Built with the **MERN stack ethos** but utilizing **PostgreSQL** for persistence, the platform simulates real-world transactional and social features in a clean, modern interface.

This project emphasizes **secure authentication**, **client-side validation**, **dual-role user management (Backer/Creator)**, and **third-party integrations** (PayPal, Cloudinary).

---

## ✨ Core Features & Functionality

### 🔐 Authentication & Security

- **Secure JWT Flow:** Implements a custom JSON Web Token strategy using Access Tokens and Refresh Tokens for persistent user sessions and secured API access.  
- **Google OAuth 2.0:** Seamless one-click login and registration via Passport.js integration.  
- **Email Verification & Reset:** Integrated Nodemailer service for critical transactional emails (password reset links, email verification).  
- **Authorization:** All critical routes (payments, creation, profile editing) are protected by Express middleware.

---

### 💰 Transactional Flow

- **2-Step Secure Pledging:** Implements the recommended server-side PayPal integration:  
  1. Frontend requests Order ID from the backend.  
  2. Backend calls PayPal API to capture funds upon user approval.  
- **Custom Forms:** Profile allows secure modal-based management of payment methods and payout accounts.  
- **Client Validation:** Robust form validation powered by Zod.

---

### 🛠️ Campaign & User Management

- **Dual Roles:** Single user account manages both backer history (pledges, status) and creator campaigns (stats, analytics view).  
- **Creation Wizard:** Multi-step wizard form for creators, including Cloudinary image upload integrated via Multer.  
- **Interactions:** Campaigns feature a live comments section for backer-creator engagement.

---

## 💻 Tech Stack Deep Dive

| **Component** | **Technology** | **Role in Project** |
|----------------|----------------|----------------------|
| **Frontend** | React, TypeScript, Tailwind CSS | Composable, responsive UI; modern component design. |
| **Backend** | Node.js, Express.js (TypeScript) | Scalable REST API, handles all business logic. |
| **Database** | PostgreSQL | Primary persistent data store, chosen for reliability and scalability. |
| **Auth** | Passport.js, jsonwebtoken | OAuth flow handling and token creation/verification. |
| **Payments** | PayPal Checkout SDK | Server-side communication for secure order processing (Sandbox mode). |
| **Media** | Cloudinary, Multer | Cloud hosting and secure handling of campaign images. |
| **Client HTTP** | Axios, @paypal/react-paypal-js | Secure API client and dedicated PayPal UI integration. |

---

## 🚀 Setup Instructions

### 1. Prerequisites

- **Node.js (v18+)** and **npm/yarn** installed.  
- A running **PostgreSQL** database instance.  
- Credentials obtained from:
  - Google Cloud (OAuth)
  - Cloudinary
  - PayPal Developer (Sandbox)

---

### 2. Environment Variables (`.env`)

Create a `.env` file in the `/backend` directory and fill in all required secrets:

```env
# --- Server & Database ---
PORT=3001
DATABASE_URL="postgres://user:password@host:port/dbname"

# --- Supabase Configuration ---
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"


# --- Authentication & Security ---
JWT_ACCESS_SECRET="YOUR_SECURE_JWT_ACCESS_SECRET"
JWT_REFRESH_SECRET="YOUR_SECURE_JWT_REFRESH_SECRET"

# --- Google OAuth ---
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_CALLBACK_URL="http://localhost:3001/auth/google/callback" 

# --- Cloudinary & File Storage ---
CLOUDINARY_CLOUD_NAME="YOUR_CLOUD_NAME"
CLOUDINARY_API_KEY="YOUR_API_KEY"
CLOUDINARY_API_SECRET="YOUR_API_SECRET"

# --- Email Services (Nodemailer) ---
EMAIL_HOST_SERVICE="Gmail" 
EMAIL_USER="YOUR_SECURE_SMTP_USERNAME"
EMAIL_PASS="YOUR_16_CHARACTER_APP_PASSWORD" 
EMAIL_FROM_NAME="WeRaise Platform"
EMAIL_FROM_ADDRESS="noreply@werase.com"

# --- PayPal Sandbox ---
PAYPAL_CLIENT_ID="YOUR_PAYPAL_SANDBOX_CLIENT_ID"
PAYPAL_CLIENT_SECRET="YOUR_PAYPAL_SANDBOX_CLIENT_SECRET"
```

### 3. Backend Setup & Testing

```
cd backend

npm install

psql -f models/schema.sql your_db_name

ts-node seed.ts

npm start
```

### 4. Frontend Setup

```
cd client

npm install

npm start
```

## 🌐 API Endpoint Reference

| **Method** | **Endpoint Path** | **Description** | **Security Status** |
|-------------|-------------------|------------------|---------------------|
| **POST** | `/api/user/register` | User registration, issues JWTs. | PUBLIC |
| **POST** | `/api/user/refresh-token` | Renews expired Access Token. | PUBLIC |
| **GET** | `/api/user/me` | Retrieves current user profile and settings. | PROTECTED (Auth Required) |
| **POST** | `/api/campaigns` | Creates a new campaign (includes image upload). | PROTECTED (Auth Required) |
| **POST** | `/api/pledges/paypal/create-order` | Initiates PayPal transaction and gets Order ID. | PROTECTED (Auth Required) |
| **POST** | `/api/pledges/paypal/capture-order` | Finalizes payment, captures funds, and records pledge. | PROTECTED (Auth Required) |
| **GET** | `/api/campaigns` | Retrieves all campaigns (Discovery). | PUBLIC |
| **GET** | `/api/pledges/history` | Retrieves current user's complete pledge history. | PROTECTED (Auth Required) |
