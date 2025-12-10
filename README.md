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
    * Checks file format and file size.
    * **Selfie Rejection Logic (File Size Only):** Rejects images **< 100 KB** or **> 4 MB** to prevent low-quality/excessively large files.
    * Ensures proper step order before accepting data.
* **Admin Endpoints:** For manual review, including `Approve`, `Reject`, `Fetch all sessions`, and `View individual session details`.

### 🌐 Frontend (Vanilla JS)
* **Clean Vanilla JavaScript:** Zero build tools required for simplicity.
* **Smooth Step Navigation:** Manages the multi-step wizard logic.
* **Robust Uploads:** Document upload with loading modal and cancellation using `AbortController`.
* **Camera Integration:** Uses the browser's `getUserMedia` API for selfie capture.
* **Admin Panel:** Full session list and detail view for reviewers.
* **Responsive Layout:** Optimized for mobile and desktop.

## 📁 Folder Structure
