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
git clone https://github.com/composedlabyrinth/HDFC_Capstone_Swiftkyc
cd swiftkyc
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

Create a file named `.env` in the root directory with the following content (adjust `DATABASE_URL` as needed):

```ini
POSTGRES_DSN=postgresql+asyncpg://swiftkyc:<yourpassword>@localhost:5432/swiftkycdb
REDIS_URL=redis://..
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
 

-----

## 📬 API Endpoints (Summary)

| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Health check endpoint |
| `/api/v1/kyc/session` | `POST` | Create a new KYC session |
| `/api/v1/kyc/session/{id}` | `PATCH` | Update session data (select doc type, document upload, selfie, etc.) |
| `/api/v1/admin/kyc` | `GET` | Retrieve all KYC sessions for review |
| `/api/v1/admin/kyc/{id}` | `POST` | Approve/Reject a specific session by ID |

-----

## Project Screenshots
<img width="1889" height="972" alt="image" src="https://github.com/user-attachments/assets/914d3fab-acb5-4f68-a71b-ad7290e6b60b" />
<img width="1875" height="963" alt="Screenshot 2025-12-11 005113" src="https://github.com/user-attachments/assets/ceda1eec-2ebb-45fa-9d06-f76d4f786c54" />
<img width="1895" height="178" alt="image" src="https://github.com/user-attachments/assets/6a2fe250-2991-4bff-8874-2abfc9b93753" />
<img width="1873" height="964" alt="Screenshot 2025-12-11 005559" src="https://github.com/user-attachments/assets/b3d8d3fc-9687-4c67-854f-e3e00f1afe5f" />
<img width="1229" height="873" alt="Screenshot 2025-12-11 005619" src="https://github.com/user-attachments/assets/d49c32a5-77fb-46f3-8079-f5b48e160228" />
<img width="1219" height="864" alt="Screenshot 2025-12-11 005631" src="https://github.com/user-attachments/assets/cff82df8-2233-438f-95af-66c99e36194c" />
<img width="1233" height="877" alt="Screenshot 2025-12-11 005643" src="https://github.com/user-attachments/assets/ce2b600a-1157-4e58-8862-ffb5df669b40" />
<img width="1266" height="930" alt="Screenshot 2025-12-11 005659" src="https://github.com/user-attachments/assets/ccb5ccbb-3e49-4036-9375-c6027a624e28" />
<img width="1229" height="960" alt="Screenshot 2025-12-11 005903" src="https://github.com/user-attachments/assets/df974c76-4862-437f-b930-7e3597014779" />






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
