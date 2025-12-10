📄 SwiftKYC — Digital KYC Verification System

SwiftKYC is a lightweight, modular digital KYC (Know Your Customer) platform built for modern banking and fintech onboarding.
It provides a smooth customer KYC flow and a robust admin review dashboard.
The system includes document upload, document number validation, selfie capture, and step-controlled session handling — without any OCR service.

🚀 Features
Customer KYC Flow

Create KYC session using name, DOB, and mobile number

Guided multi-step KYC wizard

Document type selection (Aadhaar / PAN)

Upload document images (no OCR extraction)

Enter document number manually

Live selfie capture with camera

Real-time validation and UX feedback

Rich progress indicators

Backend Logic (No OCR)

FastAPI backend with clean, async architecture

Strict step-by-step workflow:

Create Session

Enter Document Type

Upload Document

Enter Document Number

Upload Selfie

Await Admin Review

Document validation:

Checks file format

Ensures proper step order

Selfie rejection logic based on file size:

Rejects images < 100 KB or > 4 MB

Admin endpoints for:

Approve

Reject

Fetch all KYC sessions

View individual session details

Frontend

Clean vanilla JavaScript frontend

Smooth step navigation

Document upload with loading modal & cancellation (AbortController)

Camera integration for selfie capture

Admin panel with full session list & detail view

Responsive layout

📁 Folder Structure
SwiftKYC/
│
├── swiftkyc-backend/
│   ├── app/
│   │   ├── routes/
│   │   │   └── kyc_session.py
│   │   ├── services/
│   │   │   └── face_validation.py   (file-size validation only)
│   │   ├── models/
│   │   ├── utils/
│   │   ├── db/
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── swiftkyc-frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── admin/
│   │   ├── index.html
│   │   ├── admin.js
│   │   └── admin.css
│   └── assets/
│
└── README.md

⚙️ Installation & Setup
Backend Setup (FastAPI)
1️⃣ Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate

2️⃣ Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

3️⃣ Run database migrations
alembic upgrade head

4️⃣ Start the FastAPI server
uvicorn app.main:app --reload


Backend runs at:
➡ http://localhost:8000

Swagger docs:
➡ http://localhost:8000/docs

Frontend Setup

No build tools required. Just open the HTML directly.

Customer KYC:

swiftkyc-frontend/index.html


Admin panel:

swiftkyc-frontend/admin/index.html

Docker Setup (Optional)
docker compose up --build


This will start:

Backend API

Worker (if configured)

PostgreSQL

Redis (optional)

🔌 API Examples
1. Create a KYC Session
POST /kyc/session/create
{
  "name": "Amit Verma",
  "dob": "1999-02-14",
  "mobile": "9876543210"
}

2. Enter Document Type
POST /kyc/session/{session_id}/enter-doc-type
{
  "doc_type": "AADHAAR"   # or PAN
}

3. Upload Document (no OCR used)
POST /kyc/session/{session_id}/validate-document
Content-Type: multipart/form-data
file=<document image>

4. Enter Document Number
POST /kyc/session/{session_id}/enter-doc-number
{
  "doc_number": "ABCDE1234F"
}

5. Upload Selfie
POST /kyc/session/{session_id}/upload-selfie
file=<jpeg/png>

6. Admin Fetch All Sessions
GET /admin/kyc

7. Approve Session
POST /admin/kyc/{session_id}/approve

8. Reject Session
POST /admin/kyc/{session_id}/reject

🛠 Tech Stack
Backend

Python 3.10+

FastAPI

SQLAlchemy

Alembic

PostgreSQL

Pillow (for image validation)

Pydantic

Frontend

HTML5

CSS3

Vanilla JavaScript

Camera API (getUserMedia)

Fetch API

DevOps

Docker

Docker Compose

Git & GitHub

🙌 Future Enhancements

Add OCR pipeline for PAN/Aadhaar

Add face match logic

Add optional video KYC

Improve admin analytics dashboard
