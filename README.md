# 📄 SwiftKYC — Digital KYC Verification System

SwiftKYC is a lightweight, modular digital **KYC (Know Your Customer)** platform built for modern banking and fintech onboarding. It provides a smooth, step-controlled customer KYC flow and a robust admin review dashboard *without* relying on complex OCR (Optical Character Recognition) services.

## ✨ High-Level System Architecture

SwiftKYC follows a client-server architecture. The frontend guides the customer through the steps, while the FastAPI backend enforces the workflow and handles validation.

## 🚀 Features

### Customer KYC Flow
* **Create KYC Session:** Initiates the session using basic details (Name, DOB, Mobile).
* **Guided Multi-Step Wizard:** A seamless, step-controlled user experience.
* **Document Handling (No OCR):**
    * Document type selection (**Aadhaar / PAN**).
    * Upload document images.
    * Manual entry of document number.
* **Live Selfie Capture:** Utilizes the camera API for real-time photo capture.
* **Real-time Validation & UX Feedback:** Provides rich progress indicators and immediate feedback on steps.

### 🛡️ Backend Logic (FastAPI - No OCR)
The backend enforces a strict, step-by-step workflow for data integrity.
* **Clean, Async Architecture:** Built with FastAPI for high performance.
* **Strict Step-by-Step Workflow:**
    1.  `Create Session`
    2.  `Enter Document Type`
    3.  `Upload Document`
    4.  `Enter Document Number`
    5.  `Upload Selfie`
    6.  `Await Admin Review`
* **Document & Selfie Validation (Basic):**
    * Checks file format and ensures proper step order.
    * **Selfie Rejection Logic (File Size Only):** Rejects images **< 100 KB** or **> 4 MB** to prevent low-quality/excessively large files.
* **Admin Endpoints:** For manual review, including `Approve`, `Reject`, `Fetch all sessions`, and `View individual session details`.

### 🌐 Frontend (Vanilla JS)
* **Clean Vanilla JavaScript:** Zero build tools required for simplicity.
* **Smooth Step Navigation:** Manages the multi-step wizard logic.
* **Robust Uploads:** Document upload with loading modal and cancellation using `AbortController`.
* **Camera Integration:** Uses the browser's `getUserMedia` API for selfie capture.
* **Admin Panel:** Full session list and detail view for reviewers.
* **Responsive Layout:** Optimized for mobile and desktop.

## 📁 Folder Structure

```bash
SwiftKYC/
│
├── swiftkyc-backend/
│   ├── app/
│   │   ├── routes/
│   │   │   └── kyc_session.py    # FastAPI routes for KYC steps
│   │   ├── services/
│   │   │   └── face_validation.py  # File-size validation only
│   │   ├── models/             # Database models (SQLAlchemy)
│   │   ├── utils/              # Utility functions
│   │   ├── db/                 # Database configuration
│   │   └── main.py             # FastAPI application entry point
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── swiftkyc-frontend/
│   ├── index.html              # Customer KYC start page
│   ├── app.js                  # Customer KYC logic
│   ├── styles.css
│   ├── admin/
│   │   ├── index.html          # Admin panel page
│   │   ├── admin.js            # Admin panel logic
│   │   └── admin.css
│   └── assets/
│
└── README.md
```

## ⚙️ Installation & Setup

### Backend Setup (FastAPI)

1.  **Create and activate virtual environment**
    ```bash
    python -m venv .venv
    # On Windows:
    .\.venv\Scriptsctivate
    # On Linux/macOS:
    source .venv/bin/activate
    ```
2.  **Install dependencies**
    ```bash
    pip install --upgrade pip
    pip install -r swiftkyc-backend/requirements.txt
    ```
3.  **Run database migrations** (Requires PostgreSQL to be running and configured)
    ```bash
    alembic upgrade head
    ```
4.  **Start the FastAPI server**
    ```bash
    cd swiftkyc-backend
    uvicorn app.main:app --reload
    ```
    * **Backend runs at:** ➡ `http://localhost:8000`
    * **Swagger docs:** ➡ `http://localhost:8000/docs`

### Frontend Setup
No build tools are required. Just open the HTML files directly in your browser.

* **Customer KYC:** `swiftkyc-frontend/index.html`
* **Admin panel:** `swiftkyc-frontend/admin/index.html`

### Docker Setup (Optional)
This is the recommended way to run the entire stack (FastAPI, DB, etc.)
```bash
docker compose up --build
```

This will start:

  * Backend API
  * PostgreSQL
  * *Worker (if configured)*
  * *Redis (optional)*

## 🔌 API Examples

| Step | Method | Path | Body / Description |
| :--- | :--- | :--- | :--- |
| **1. Create Session** | `POST` | `/kyc/session/create` | `{"name": "Amit Verma", "dob": "1999-02-14", "mobile": "9876543210"}` |
| **2. Enter Doc Type** | `POST` | `/kyc/session/{session_id}/enter-doc-type` | `{"doc_type": "AADHAAR"}` **(or `PAN`)** |
| **3. Upload Document**| `POST` | `/kyc/session/{session_id}/validate-document` | **Content-Type: `multipart/form-data`** (`file=<document image>`) |
| **4. Enter Doc Number**| `POST` | `/kyc/session/{session_id}/enter-doc-number` | `{"doc_number": "ABCDE1234F"}` |
| **5. Upload Selfie** | `POST` | `/kyc/session/{session_id}/upload-selfie` | **Content-Type: `multipart/form-data`** (`file=<jpeg/png>`) |
| **6. Admin Fetch All**| `GET` | `/admin/kyc` | *(No body)* |
| **7. Admin Approve** | `POST` | `/admin/kyc/{session_id}/approve` | *(No body)* |
| **8. Admin Reject** | `POST` | `/admin/kyc/{session_id}/reject` | *(No body)* |

## 🛠 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Python 3.10+ | Primary language |
| **Web Framework**| FastAPI | High-performance, async framework |
| **Database** | PostgreSQL | Robust, open-source RDBMS |
| **ORM/Migrations** | SQLAlchemy, Alembic | Database toolkit and migration engine |
| **Data Validation**| Pydantic | Python data parsing and validation |
| **Image Handling** | Pillow | Basic image operations (for file size check) |
| **Frontend** | HTML5, CSS3 | Structure and styling |
| **Interactivity** | Vanilla JavaScript | Front-end logic, no heavy frameworks |
| **APIs** | Camera API (`getUserMedia`), Fetch API | For selfie capture and network requests |
| **DevOps** | Docker, Docker Compose | Containerization for easy setup |

## 🙌 Future Enhancements

  * Add full **OCR pipeline** for automated PAN/Aadhaar data extraction.
  * Integrate **face match logic** between the document photo and the live selfie.
  * Add optional **video KYC** flow.
  * Improve **admin analytics dashboard** with metrics and reporting.
