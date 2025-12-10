/* ============================================================
   SwiftKyc Frontend - app.js
   - Updated Admin Layout (Top Details, Left Filters)
   - FIXED: Camera stream stability (autoplay/playsinline)
   - FIXED: Selfie upload (Blob handling and FormData filename)
   - session detail moved to top (logic reflects UI change)
============================================================ */

const API_BASE = "/api/v1";
const KYC_BASE = `${API_BASE}/kyc`;
const ADMIN_BASE = `${API_BASE}/admin/kyc`;

let currentStep = 1;
let sessionId = null;
let currentDocType = null;
let statusPollInterval = null;

// Camera state for selfie capture
let videoStream = null;
let capturedBlob = null;

// Global message timeout handle
let globalMessageTimeout = null;

// ----------------- helpers -----------------
function setGlobalMessage(message, type = "error", autoDismiss = true, dismissSeconds = 6) {
    const bar = document.getElementById("global-message");
    if (!bar) return;
    // clear existing timeout
    if (globalMessageTimeout) {
        clearTimeout(globalMessageTimeout);
        globalMessageTimeout = null;
    }

    if (!message) {
        bar.textContent = "";
        bar.style.background = "none";
        bar.style.color = "";
        bar.style.transition = "opacity 0.25s";
        bar.style.opacity = "0";
        // clear after short delay to allow CSS transition
        setTimeout(() => {
            if (bar) { bar.style.opacity = ""; }
        }, 300);
        return;
    }

    bar.textContent = message;
    bar.style.opacity = "1";
    if (type === "success") {
        bar.style.background = "rgba(34,197,94,0.08)";
        bar.style.color = "#22c55e";
    } else if (type === "info") {
        bar.style.background = "rgba(37,99,235,0.08)";
        bar.style.color = "#2563eb";
    } else {
        bar.style.background = "rgba(239,68,68,0.08)";
        bar.style.color = "#ef4444";
    }

    // Auto-dismiss after N seconds (unless disabled)
    if (autoDismiss && message) {
        globalMessageTimeout = setTimeout(() => {
            setGlobalMessage(null);
            globalMessageTimeout = null;
        }, dismissSeconds * 1000);
    }
}

async function apiFetch(url, options = {}) {
    const finalOptions = {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    };

    if (finalOptions.body instanceof FormData) {
        delete finalOptions.headers["Content-Type"];
    }

    const res = await fetch(url, finalOptions);
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
        let message = "Something went wrong. Please try again.";
        if (data) {
            if (typeof data.message === "string") message = data.message;
            else if (Array.isArray(data.detail) && data.detail.length > 0) message = data.detail[0].msg || message;
            else if (data.detail && typeof data.detail === "string") message = data.detail;
            else if (data.error_code || data.error) message = data.message || message;
        }
        throw new Error(message);
    }
    return data;
}

function buildQueryString(params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") search.append(key, value);
    });
    const qs = search.toString();
    return qs ? `?${qs}` : "";
}

function computeAge(dobStr) {
    if (!dobStr) return 0;
    const dob = new Date(dobStr);
    if (Number.isNaN(dob.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function updateCurrentYear() {
    const span = document.getElementById("current-year");
    if (span) span.textContent = new Date().getFullYear().toString();
}

function stopStatusPolling() {
    if (statusPollInterval) {
        clearInterval(statusPollInterval);
        statusPollInterval = null;
    }
}

// ----------------- wizard UI -----------------
function goToStep(stepNumber) {
    currentStep = stepNumber;
    const steps = document.querySelectorAll(".wizard-step");
    steps.forEach((stepEl) => {
        const step = Number(stepEl.getAttribute("data-step"));
        stepEl.classList.toggle("wizard-step-active", step === stepNumber);
    });
    const indicators = document.querySelectorAll(".wizard-step-indicator");
    indicators.forEach((ind) => {
        const step = Number(ind.getAttribute("data-step"));
        ind.classList.toggle("wizard-step-indicator-active", step === stepNumber);
    });
    const progressFill = document.getElementById("progress-bar-fill");
    const labelStep = document.getElementById("progress-step-label");
    const labelName = document.getElementById("progress-step-name");
    const maxSteps = 7;
    const percentage = (stepNumber / maxSteps) * 100;
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (labelStep) labelStep.textContent = `Step ${stepNumber} of ${maxSteps}`;
    if (labelName) {
        const nameMap = {
            1: "Basic Details", 2: "Create Session", 3: "Select Document", 4: "Enter Doc Number",
            5: "Upload Document", 6: "Selfie Capture", 7: "Status & Assisted KYC",
        };
        labelName.textContent = nameMap[stepNumber] || "";
    }
    setGlobalMessage(null);
}

function switchView(viewName) {
    const customerView = document.getElementById("customer-view");
    const adminView = document.getElementById("admin-view");
    const navCustomer = document.getElementById("nav-customer");
    const navAdmin = document.getElementById("nav-admin");
    if (viewName === "admin") {
        customerView.hidden = true;
        adminView.hidden = false;
        navCustomer.classList.remove("active");
        navAdmin.classList.add("active");
    } else {
        customerView.hidden = false;
        adminView.hidden = true;
        navCustomer.classList.add("active");
        navAdmin.classList.remove("active");
    }
}

// ----------------- step implementations -----------------
function setupBasicDetailsStep() {
    const btnNext = document.getElementById("btn-basic-next");
    const dobInput = document.getElementById("dob");
    const ageWarning = document.getElementById("age-warning");
    if (!btnNext) return;
    btnNext.addEventListener("click", () => {
        const dobValue = dobInput.value;
        const age = computeAge(dobValue);
        if (age < 18) {
            ageWarning.hidden = false;
            setGlobalMessage("You must be at least 18 years old to complete digital KYC. Please contact your bank for alternative options.", "error");
            return;
        }
        ageWarning.hidden = true;
        goToStep(2);
    });
}

function setupSessionStep() {
    const btnBack = document.getElementById("btn-session-back");
    const btnCreate = document.getElementById("btn-create-session");
    const mobileInput = document.getElementById("mobile");
    const sessionIdDisplay = document.getElementById("session-id-display");
    const sessionStatusDisplay = document.getElementById("session-status-display");
    if (!btnCreate) return;
    btnBack.addEventListener("click", () => goToStep(1));
    btnCreate.addEventListener("click", async () => {
        const mobile = (mobileInput.value || "").trim();
        if (!/^\d{10}$/.test(mobile)) {
            setGlobalMessage("Please enter a valid 10-digit mobile number.", "error");
            return;
        }
        setGlobalMessage("Creating your KYC session…", "info");
        try {
            const payload = { mobile };
            const data = await apiFetch(`${KYC_BASE}/session`, { method: "POST", body: JSON.stringify(payload) });
            sessionId = data.session_id || data.id || data.sessionId;
            const status = data.status || "IN_PROGRESS";
            if (sessionIdDisplay) sessionIdDisplay.textContent = sessionId || "—";
            if (sessionStatusDisplay) sessionStatusDisplay.textContent = status;
            setGlobalMessage("KYC session created successfully.", "success");
            goToStep(3);
        } catch (error) {
            setGlobalMessage(error.message, "error");
        }
    });
}

function setupSelectDocStep() {
    const btnBack = document.getElementById("btn-select-doc-back");
    const btnContinue = document.getElementById("btn-select-doc-continue");
    if (!btnContinue) return;
    btnBack.addEventListener("click", () => goToStep(2));
    btnContinue.addEventListener("click", async () => {
        if (!sessionId) { setGlobalMessage("Please create a KYC session first.", "error"); return; }
        const selected = document.querySelector('input[name="doc_type"]:checked');
        if (!selected) { setGlobalMessage("Please select a document type to continue.", "error"); return; }
        currentDocType = selected.value;
        setGlobalMessage("Saving selected document type…", "info");
        try {
            const payload = { doc_type: currentDocType };
            await apiFetch(`${KYC_BASE}/session/${sessionId}/select-document`, { method: "POST", body: JSON.stringify(payload) });
            setGlobalMessage("Document type saved. You can now enter the document number.", "success");
            goToStep(4);
            updateDocNumberHints();
        } catch (error) {
            setGlobalMessage(error.message, "error");
        }
    });
}

function updateDocNumberHints() {
    const labelHint = document.getElementById("doc-number-label-hint");
    const formatHint = document.getElementById("doc-number-format-hint");
    if (!labelHint || !formatHint) return;
    if (currentDocType === "PAN") {
        labelHint.textContent = "(e.g. PAN: ABCDE1234F)";
        formatHint.textContent = "PAN: 10 characters (5 letters, 4 digits, 1 letter). Example: ABCDE1234F.";
    } else if (currentDocType === "AADHAAR") {
        labelHint.textContent = "(e.g. Aadhaar: 123412341234)";
        formatHint.textContent = "Aadhaar: exactly 12 digits (numbers only). No spaces or dashes.";
    } else {
        labelHint.textContent = "(enter the document number as printed)";
        formatHint.textContent = "Enter the document number exactly as printed on your document.";
    }
}

function setupDocNumberStep() {
    const btnBack = document.getElementById("btn-doc-number-back");
    const btnContinue = document.getElementById("btn-doc-number-continue");
    const input = document.getElementById("doc-number-input");
    const errorBox = document.getElementById("doc-number-error");
    if (!btnContinue) return;
    btnBack.addEventListener("click", () => goToStep(3));
    btnContinue.addEventListener("click", async () => {
        if (!sessionId) { setGlobalMessage("Please create a KYC session first.", "error"); return; }
        const docNumber = (input.value || "").trim();
        if (!docNumber) { errorBox.textContent = "Document number is required."; return; }
        errorBox.textContent = "";
        setGlobalMessage("Validating document number format…", "info");
        try {
            const payload = { doc_number: docNumber };
            await apiFetch(`${KYC_BASE}/session/${sessionId}/enter-doc-number`, { method: "POST", body: JSON.stringify(payload) });
            setGlobalMessage("Document number accepted.", "success");
            goToStep(5);
        } catch (error) {
            errorBox.textContent = error.message;
            setGlobalMessage(null);
        }
    });
}

// ----------------- upload doc -----------------
function basicImageQualityCheck(file) {
    const feedback = [];
    if (!file) { feedback.push("Please select a document image to upload."); return feedback; }
    const sizeKB = file.size / 1024;
    if (sizeKB < 80) feedback.push("Image seems very small. It may be low resolution or blurry. Try capturing a clearer photo.");
    else if (sizeKB > 4096) feedback.push("Image is larger than 4 MB. Consider retaking with a slightly lower resolution.");
    if (!["image/jpeg", "image/png"].includes(file.type)) feedback.push("Only JPEG and PNG images are allowed.");
    return feedback;
}

function setupUploadDocStep() {
    const btnBack = document.getElementById("btn-upload-doc-back");
    const btnContinue = document.getElementById("btn-upload-doc-continue");
    const fileInput = document.getElementById("doc-file");
    const feedbackBox = document.getElementById("doc-quality-feedback");
    const statusBox = document.getElementById("doc-upload-status");
    if (!btnContinue) return;
    btnBack.addEventListener("click", () => goToStep(4));
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        const feedback = basicImageQualityCheck(file);
        feedbackBox.textContent = feedback.join(" ");
    });
    btnContinue.addEventListener("click", async () => {
        if (!sessionId) { setGlobalMessage("Please create a KYC session first.", "error"); return; }
        const file = fileInput.files[0];
        const feedback = basicImageQualityCheck(file);
        feedbackBox.textContent = feedback.join(" ");
        if (!file) { setGlobalMessage("Please select a document image to upload.", "error"); return; }
        setGlobalMessage("Uploading and validating your document…", "info");
        statusBox.textContent = "Uploading… Validating document (Step 2/4)…";
        const formData = new FormData();
        formData.append("file", file);
        try {
            await apiFetch(`${KYC_BASE}/session/${sessionId}/validate-document`, { method: "POST", body: formData });
            statusBox.textContent = "Document uploaded. Running quality checks on server…";
            setGlobalMessage("Document uploaded successfully. Proceeding to selfie step.", "success");
            goToStep(6);
        } catch (error) {
            statusBox.textContent = "";
            setGlobalMessage(error.message, "error");
        }
    });
}

// ----------------- CAMERA helpers for selfie -----------------
async function startCamera() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setGlobalMessage("Camera API not supported in this browser.", "error");
            return;
        }
        // request camera (front)
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const video = document.getElementById("selfie-video");
        if (!video) return;
        video.srcObject = videoStream;
        video.style.display = "block";
        
        // FIX: Ensure play() is called properly to avoid freezing
        try {
            await video.play();
        } catch (playErr) {
            console.warn("Autoplay blocked or interrupted:", playErr);
        }

        // show capture & close btn, hide open btn
        document.getElementById("btn-capture-selfie").hidden = false;
        document.getElementById("btn-close-camera").hidden = false;
        document.getElementById("btn-open-camera").hidden = true;
        setGlobalMessage("Camera started. Position your face in the frame and click Capture.", "info");
        // clear previous preview
        const preview = document.getElementById("selfie-preview");
        if (preview) { preview.style.display = "none"; preview.src = ""; }
    } catch (err) {
        console.error("startCamera error:", err);
        setGlobalMessage("Unable to access camera. Please allow camera permissions or use file upload.", "error");
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    const video = document.getElementById("selfie-video");
    if (video) { video.pause(); video.srcObject = null; video.style.display = "none"; }
    document.getElementById("btn-capture-selfie").hidden = true;
    document.getElementById("btn-close-camera").hidden = true;
    document.getElementById("btn-open-camera").hidden = false;
    setGlobalMessage(null);
}

function assignFileToInput(file, inputEl) {
    // helper to set a File object to a file input using DataTransfer
    try {
        const dt = new DataTransfer();
        dt.items.add(file);
        inputEl.files = dt.files;
    } catch (err) {
        // Some older browsers may not support DataTransfer constructor — ignore silently
        console.warn("assignFileToInput failed:", err);
    }
}

function captureSelfie() {
    const video = document.getElementById("selfie-video");
    const canvas = document.getElementById("selfie-canvas");
    const preview = document.getElementById("selfie-preview");
    if (!video || !canvas || !preview) {
        setGlobalMessage("Camera not ready.", "error");
        return;
    }
    // size canvas to video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // convert to blob
    canvas.toBlob((blob) => {
        if (!blob) {
            setGlobalMessage("Capture failed. Try again.", "error");
            return;
        }
        capturedBlob = blob;
        // show preview
        preview.src = URL.createObjectURL(blob);
        preview.style.display = "block";
        
        // FIX: stop camera AFTER blob is created
        stopCamera();
        
        setGlobalMessage("Selfie captured. It was converted into a file and is ready to upload.", "success");
        // convert blob to File and assign to file input so user sees file selected
        try {
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            const selfieInput = document.getElementById("selfie-file");
            if (selfieInput) assignFileToInput(file, selfieInput);
        } catch (err) {
            // if File constructor unsupported, fallback: let capturedBlob be used on submit
            console.warn("Could not auto-assign file input, fallback to capturedBlob on upload.", err);
        }
    }, "image/jpeg", 0.9);
}

// ----------------- Selfie step wiring -----------------
function setupSelfieStep() {
    const btnBack = document.getElementById("btn-selfie-back");
    const btnContinue = document.getElementById("btn-selfie-continue");
    const fileInput = document.getElementById("selfie-file");
    const statusBox = document.getElementById("selfie-upload-status");

    if (!btnContinue) return;

    // camera control buttons
    const btnOpen = document.getElementById("btn-open-camera");
    const btnCapture = document.getElementById("btn-capture-selfie");
    const btnClose = document.getElementById("btn-close-camera");

    if (btnBack) btnBack.addEventListener("click", () => goToStep(5));

    if (btnOpen) btnOpen.addEventListener("click", async () => {
        await startCamera();
    });

    if (btnCapture) btnCapture.addEventListener("click", () => captureSelfie());

    if (btnClose) btnClose.addEventListener("click", () => stopCamera());

    btnContinue.addEventListener("click", async () => {
        if (!sessionId) { setGlobalMessage("Please create a KYC session first.", "error"); return; }

        let uploadPayload = null;
        
        // LOGIC UPDATE: Prioritize input file, fallback to captured blob
        if (fileInput.files.length > 0) {
            uploadPayload = fileInput.files[0];
        } else if (capturedBlob) {
            uploadPayload = capturedBlob;
        }

        if (!uploadPayload) { setGlobalMessage("Please capture or upload a selfie image to upload.", "error"); return; }

        // Check type if it is a File object (Blobs from canvas are typically explicitly image/jpeg)
        if (uploadPayload instanceof File && uploadPayload.type && !["image/jpeg", "image/png"].includes(uploadPayload.type)) {
             setGlobalMessage("Only JPEG and PNG images are allowed for selfie.", "error"); return; 
        }

        const sizeKB = uploadPayload.size / 1024;
        if (sizeKB < 80) { setGlobalMessage("Selfie image is quite small; it may look blurry. Consider retaking with better lighting.", "error"); return; }

        setGlobalMessage("Uploading your selfie and running face match…", "info");
        statusBox.textContent = "Uploading… Validating selfie & face match…";
        const formData = new FormData();
        
        // FIX: Explicitly append filename for Blobs so backend sees it as a file upload
        if (uploadPayload instanceof File) {
            formData.append("file", uploadPayload);
        } else {
            formData.append("file", uploadPayload, "selfie.jpg");
        }

        try {
            await apiFetch(`${KYC_BASE}/session/${sessionId}/selfie`, { method: "POST", body: formData });
            setGlobalMessage("Selfie uploaded. We are finalizing the KYC check.", "success");
            goToStep(7);
            startStatusPolling();
            // clear captured blob after successful upload
            capturedBlob = null;
            // clear selfie input
            if (fileInput) fileInput.value = "";
        } catch (error) {
            statusBox.textContent = "";
            setGlobalMessage(error.message, "error");
        }
    });
}

// ----------------- Status & assisted KYC -----------------
async function refreshKycStatus() {
    if (!sessionId) return;
    try {
        const data = await apiFetch(`${KYC_BASE}/session/${sessionId}`, { method: "GET" });
        const sessionIdEl = document.getElementById("status-session-id");
        const currentStepEl = document.getElementById("status-current-step");
        const statusEl = document.getElementById("status-kyc-status");
        const failureEl = document.getElementById("status-failure-reason");
        const retriesDocEl = document.getElementById("status-retries-doc");
        const retriesSelfieEl = document.getElementById("status-retries-selfie");
        const faceScoreEl = document.getElementById("status-face-score");

        if (sessionIdEl) sessionIdEl.textContent = data.id || data.session_id || sessionId;
        if (currentStepEl) currentStepEl.textContent = data.current_step || "—";
        if (statusEl) statusEl.textContent = data.status || "—";
        if (failureEl) failureEl.textContent = data.failure_reason || "None";
        if (retriesDocEl) retriesDocEl.textContent = data.retries_scan ?? data.retries_doc ?? "0";
        if (retriesSelfieEl) retriesSelfieEl.textContent = data.retries_selfie ?? "0";
        if (faceScoreEl) faceScoreEl.textContent = data.face_match_score != null ? data.face_match_score.toFixed(2) : "—";

        const assistedSection = document.getElementById("assisted-kyc-section");
        if (assistedSection) assistedSection.hidden = data.status !== "REJECTED";

        if (["APPROVED","REJECTED","ABANDONED"].includes(data.status)) stopStatusPolling();
    } catch (error) {
        setGlobalMessage(error.message, "error");
        stopStatusPolling();
    }
}

function startStatusPolling() {
    stopStatusPolling();
    refreshKycStatus();
    statusPollInterval = setInterval(refreshKycStatus, 5000);
}

function setupStatusStep() {
    const btnRefresh = document.getElementById("btn-refresh-status");
    const btnVideoKyc = document.getElementById("btn-video-kyc");
    const btnVideoKycHome = document.getElementById("btn-video-kyc-home");

    if (btnRefresh) btnRefresh.addEventListener("click", () => refreshKycStatus());

    // Video KYC permanent button (homepage header)
    if (btnVideoKycHome) {
        btnVideoKycHome.addEventListener("click", () => {
            setGlobalMessage("Your request for Video KYC has been received. A verification officer will initiate a video call within the next 5 minutes. Please ensure you are in a well-lit area.", "success");
        });
    }

    // In-case assisted section has hidden btn (kept hidden by default), wire it too
    if (btnVideoKyc) {
        btnVideoKyc.addEventListener("click", () => {
            setGlobalMessage("Your request for Video KYC has been received. A verification officer will initiate a video call within the next 5 minutes. Please ensure you are in a well-lit area.", "success");
        });
    }
}

// ----------------- Help assistant -----------------
function setupHelpAssistantFaq() {
    const questions = document.querySelectorAll(".assistant-question");
    questions.forEach((btn) => {
        btn.addEventListener("click", () => {
            const key = btn.getAttribute("data-faq");
            const answer = document.querySelector(`[data-faq-answer="${key}"]`);
            if (answer) answer.hidden = !answer.hidden;
        });
    });
}

// ----------------- Admin panel (single date filter + empty-state message) -----------------
async function loadAdminSessions() {
    const statusSelect = document.getElementById("filter-status");
    const docTypeSelect = document.getElementById("filter-doc-type");
    const dateInput = document.getElementById("filter-date");
    const tbody = document.getElementById("admin-sessions-body");
    if (!tbody) return;

    const params = {
        status: statusSelect ? statusSelect.value : "",
        doc_type: docTypeSelect ? docTypeSelect.value : "",
    };

    // If user selected a single date, send both created_from and created_to as that date
    if (dateInput && dateInput.value) {
        params.created_from = dateInput.value;
        params.created_to = dateInput.value;
    }

    const qs = buildQueryString(params);
    try {
        const data = await apiFetch(`${ADMIN_BASE}/sessions${qs}`, { method: "GET" });
        tbody.innerHTML = "";

        // If the server returns an array, check length; handle zero matches with a professional empty-state row
        if (!Array.isArray(data) || data.length === 0) {
            const tr = document.createElement("tr");
            tr.classList.add("empty-row");
            tr.innerHTML = `<td colspan="7" style="padding:18px;text-align:center;color:var(--gray-600);">
                No sessions matched your filters.
                Try clearing or broadening the filters to view more sessions.
            </td>`;
            tbody.appendChild(tr);
            return;
        }

        data.forEach((item) => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-session-id", item.session_id || item.id);
            tr.innerHTML = `
                <td>${item.session_id || item.id}</td>
                <td>${item.customer_id || "—"}</td>
                <td>${item.status || "—"}</td>
                <td>${item.current_step || "—"}</td>
                <td>${item.primary_doc_type || "—"}</td>
                <td>${item.created_at || "—"}</td>
                <td>${item.updated_at || "—"}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        setGlobalMessage(error.message, "error");
    }
}

async function loadAdminSessionDetail(sessionId) {
    const emptyState = document.getElementById("admin-session-empty-state");
    const content = document.getElementById("admin-session-detail-content");
    const sessionIdEl = document.getElementById("admin-detail-session-id");
    const customerIdEl = document.getElementById("admin-detail-customer-id");
    const statusEl = document.getElementById("admin-detail-status");
    const currentStepEl = document.getElementById("admin-detail-current-step");
    const failureEl = document.getElementById("admin-detail-failure-reason");
    const selfieUrlEl = document.getElementById("admin-detail-selfie-url");
    const faceScoreEl = document.getElementById("admin-detail-face-score");
    const retriesSelectEl = document.getElementById("admin-detail-retries-select");
    const retriesScanEl = document.getElementById("admin-detail-retries-scan");
    const retriesUploadEl = document.getElementById("admin-detail-retries-upload");
    const retriesSelfieEl = document.getElementById("admin-detail-retries-selfie");
    const docsBody = document.getElementById("admin-documents-body");

    try {
        const data = await apiFetch(`${ADMIN_BASE}/sessions/${sessionId}`, { method: "GET" });
        if (emptyState) emptyState.hidden = true;
        if (content) content.hidden = false;

        if (sessionIdEl) sessionIdEl.textContent = data.session_id || data.id || sessionId;
        if (customerIdEl) customerIdEl.textContent = data.customer_id || "—";
        if (statusEl) statusEl.textContent = data.status || "—";
        if (currentStepEl) currentStepEl.textContent = data.current_step || "—";
        if (failureEl) failureEl.textContent = data.failure_reason || "—";
        if (selfieUrlEl) selfieUrlEl.textContent = data.selfie_url || "—";
        if (faceScoreEl) faceScoreEl.textContent = data.face_match_score != null ? data.face_match_score.toFixed(2) : "—";
        if (retriesSelectEl) retriesSelectEl.textContent = data.retries_select ?? "0";
        if (retriesScanEl) retriesScanEl.textContent = data.retries_scan ?? "0";
        if (retriesUploadEl) retriesUploadEl.textContent = data.retries_upload ?? "0";
        if (retriesSelfieEl) retriesSelfieEl.textContent = data.retries_selfie ?? "0";

        if (docsBody) {
            docsBody.innerHTML = "";
            (data.documents || []).forEach((doc) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${doc.document_id || doc.id}</td>
                    <td>${doc.doc_type || "—"}</td>
                    <td>${doc.doc_number || "—"}</td>
                    <td>${doc.storage_url || "—"}</td>
                    <td>${doc.is_valid === true ? "Yes" : doc.is_valid === false ? "No" : "—"}</td>
                    <td>${doc.quality_score != null ? doc.quality_score.toFixed(2) : "—"}</td>
                    <td>${doc.created_at || "—"}</td>
                `;
                docsBody.appendChild(tr);
            });
        }
        
        // Scroll to top of detail view smoothly when loaded
        const detailSection = document.querySelector(".admin-session-detail");
        if(detailSection) detailSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        setGlobalMessage(error.message, "error");
    }
}

function setupAdminPanel() {
    const btnApplyFilters = document.getElementById("btn-admin-apply-filters");
    const btnResetFilters = document.getElementById("btn-admin-reset-filters");
    const sessionsBody = document.getElementById("admin-sessions-body");
    const btnApprove = document.getElementById("btn-admin-approve");
    const btnReject = document.getElementById("btn-admin-reject");

    if (!btnApplyFilters || !sessionsBody) return;

    btnApplyFilters.addEventListener("click", () => loadAdminSessions());

    btnResetFilters.addEventListener("click", () => {
        document.getElementById("filter-status").value = "";
        document.getElementById("filter-doc-type").value = "";
        const dateEl = document.getElementById("filter-date");
        if (dateEl) dateEl.value = "";
        loadAdminSessions();
    });

    // Row click → load detail
    sessionsBody.addEventListener("click", (event) => {
        const tr = event.target.closest("tr");
        if (!tr) return;
        const sid = tr.getAttribute("data-session-id");
        if (!sid) return;
        loadAdminSessionDetail(sid);
    });

    if (btnApprove) {
        btnApprove.addEventListener("click", async () => {
            const sid = document.getElementById("admin-detail-session-id").textContent.trim();
            if (!sid || sid === "—") { setGlobalMessage("Select a session before approving.", "error"); return; }
            try {
                await apiFetch(`${ADMIN_BASE}/sessions/${sid}/approve`, { method: "POST", body: JSON.stringify({}) });
                setGlobalMessage("KYC session approved.", "success");
                loadAdminSessionDetail(sid);
                loadAdminSessions();
            } catch (error) { setGlobalMessage(error.message, "error"); }
        });
    }

    if (btnReject) {
        btnReject.addEventListener("click", async () => {
            const sid = document.getElementById("admin-detail-session-id").textContent.trim();
            if (!sid || sid === "—") { setGlobalMessage("Select a session before rejecting.", "error"); return; }
            try {
                await apiFetch(`${ADMIN_BASE}/sessions/${sid}/reject`, { method: "POST", body: JSON.stringify({}) });
                setGlobalMessage("KYC session rejected.", "success");
                loadAdminSessionDetail(sid);
                loadAdminSessions();
            } catch (error) { setGlobalMessage(error.message, "error"); }
        });
    }

    // Load initial list
    loadAdminSessions();
}

// navigation
function setupNav() {
    const navCustomer = document.getElementById("nav-customer");
    const navAdmin = document.getElementById("nav-admin");
    navCustomer.addEventListener("click", () => switchView("customer"));
    navAdmin.addEventListener("click", () => switchView("admin"));
}

// initial bootstrap
function init() {
    updateCurrentYear();
    setupNav();
    setupBasicDetailsStep();
    setupSessionStep();
    setupSelectDocStep();
    setupDocNumberStep();
    setupUploadDocStep();
    setupSelfieStep();
    setupStatusStep();
    setupHelpAssistantFaq();
    setupAdminPanel();

    // some helpful bindings: progress step indicators clickable
    const indicators = document.querySelectorAll(".wizard-step-indicator");
    indicators.forEach((ind) => {
        ind.addEventListener("click", () => {
            const step = Number(ind.getAttribute("data-step"));
            if (!Number.isNaN(step)) goToStep(step);
        });
    });
}

document.addEventListener("DOMContentLoaded", init);