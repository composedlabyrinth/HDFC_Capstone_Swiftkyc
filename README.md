# 🚀 SwiftKYC — Digital KYC Verification System

SwiftKYC is a modular and lightweight **KYC (Know Your Customer)** verification system designed for modern banking, fintech onboarding, and identity verification workflows.

It provides a **step-controlled customer onboarding flow**, robust document validation, and a powerful **admin review panel**, all powered by an efficient FastAPI backend and a minimal HTML/JS/CSS frontend.

---

## 💡 System Architecture

The system is split into two primary components: the FastAPI backend which handles business logic and storage, and the static frontend which provides the user interface.



### ⚙️ Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend** | Python 3.x, **FastAPI** | High-performance API server, routing, and workflow enforcement. |
| **Database** | **SQLAlchemy** (ORM), **Alembic** | Database modeling and migration management. |
| **Frontend** | HTML5, Vanilla JavaScript, CSS3 | Minimal, non-framework UI for customer and admin flows. |
| **Async Processing** | Celery/Standalone Worker (Optional) | Handles background tasks (e.g., future OCR processing). |

---

## 📌 Features

### 🔹 Customer KYC Flow
* Create and manage new KYC sessions.
* Guided, **step-by-step controlled workflow** for data integrity.
* Document upload (supports Aadhaar/PAN image files).
* Live **Selfie capture and upload**.
* Designed to be **OCR-validation ready** for future integration.

### 🔹 Admin Panel (Review Dashboard)
* **View all user KYC sessions** in a centralized dashboard.
* Dedicated **Document review interface**.
* Functionality to **Approve / Reject** KYC applications.
* Filter sessions by status (pending / approved / rejected).

### 🔹 Architecture Highlights
* **Modular Routing:** Cleanly separated API routes (`admin_kyc.py`, `routes_kyc_session.py`).
* **Clean Separation:** Strict separation of schemas, services, and DB models for maintainability.
* **Static UI:** Frontend is served directly from `app/static`.
* **Alembic Integration:** Database schema management is version-controlled.

---

## 📁 Folder Structure

```

HDFC_Capstone_Swiftkyc/
├── .venv/
├── swiftkyc/
│ ├── app/
│ │ ├── api/
│ │ │ └── v1/
│ │ │ ├── admin\_kyc.py         \# Admin-specific review routes
│ │ │ ├── routes\_health.py      \# Health check
│ │ │ └── routes\_kyc\_session.py \# Customer KYC workflow routes
│ │ ├── core/
│ │ ├── db/
│ │ ├── models/                 \# SQLAlchemy ORM definitions
│ │ ├── schemas/                \# Pydantic models for request/response
│ │ ├── services/               \# Business logic components
│ │ ├── static/                 \# Frontend assets (served as UI)
│ │ │ ├── app.js
│ │ │ ├── index.html            \# Main UI
│ │ │ └── styles.css
│ │ ├── utils/
│ │ └── workers/                \# Background worker tasks
│ ├── migrations/               \# Alembic migration scripts
│ ├── uploads/                  \# Storage for uploaded documents & selfies
│ ├── .env
│ ├── alembic.ini
│ ├── main.py                   \# FastAPI application entrypoint
│ ├── requirements.txt
│ └── worker.py                 \# Celery or standalone worker script
└── README.md

````

---

## 🔧 Installation & Setup

### 1️⃣ Clone the repository
```bash
git clone <repo-url>
cd CAPSTONEPROJECT
````

### 2️⃣ Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate    # Mac/Linux
# .venv\Scripts\activate     # Windows
```

### 3️⃣ Install dependencies

```bash
pip install -r swiftkyc/requirements.txt
```

### 4️⃣ Create the `.env` file

Create a file named `.env` in the `CAPSTONEPROJECT` root directory with the following content (adjust `DATABASE_URL` as needed):

```ini
DATABASE_URL=sqlite:///./swiftkyc.db
ENV=development
```

### 5️⃣ Run migrations

```bash
alembic upgrade head
```

### 6️⃣ Start the FastAPI server

```bash
uvicorn swiftkyc.main:app --reload
```

### 7️⃣ Access the Application

The FastAPI server will be running on port 8000 by default.

  * **Frontend (Customer/Admin UI):** `http://localhost:8000/`
  * **Swagger API Docs:** `http://localhost:8000/docs`

-----

## 📬 API Endpoints (Summary)

| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Health check endpoint |
| `/api/v1/kyc/session` | `POST` | Create a new KYC session |
| `/api/v1/kyc/session/{id}` | `PATCH` | Update session data (document upload, selfie, etc.) |
| `/api/v1/admin/kyc` | `GET` | Retrieve all KYC sessions for review |
| `/api/v1/admin/kyc/{id}` | `POST` | Approve/Reject a specific session by ID |

-----

## 🛠️ Development Notes

| Aspect | Location | Description |
| :--- | :--- | :--- |
| **Frontend UI** | `swiftkyc/app/static/` | Update UI by modifying `index.html`, `app.js`, and `styles.css`. |
| **File Storage** | `swiftkyc/uploads/` | All user uploads (photos, documents) are saved here. |
| **Communication** | REST-based | Backend and frontend use a purely REST communication model. |

## 📌 Future Enhancements

  * Full **OCR integration** for automated PAN/Aadhaar data extraction.
  * Implement **Video KYC** capabilities.
  * Integrate **Face match** / Liveness detection services.
  * Implement Advanced **RBAC (Role-Based Access Control)** for the admin panel.
  * Develop a **Multi-language UI** for broader accessibility.
