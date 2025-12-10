from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.db.session import get_db
from app.models.customer import Customer
from app.models.kyc_session import KycSession, KycStep, KycStatus
from app.schemas.kyc_session import KycSessionCreateRequest, KycSessionResponse

from app.schemas.kyc_document import (
    DocumentSelectRequest,
    DocumentSelectResponse,
    DocumentUploadResponse,
    DocumentNumberRequest,
    DocumentNumberResponse, 
)
from app.models.kyc_document import KycDocument, DocumentType
from app.utils.normalization import normalize_pan, normalize_aadhaar



router = APIRouter(
    prefix="/kyc",
    tags=["KYC"],
)


@router.post(
    "/session",
    response_model=KycSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new KYC session for a mobile number",
)
async def create_kyc_session(
    payload: KycSessionCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> KycSessionResponse:
    """
    Create (or reuse) a Customer based on mobile number,
    then create a new KYC session in IN_PROGRESS state,
    starting at the SELECT_DOC step.
    """

    # 1. Fetch existing customer or create new
    result = await db.execute(
        select(Customer).where(Customer.mobile == payload.mobile)
    )
    customer = result.scalar_one_or_none()

    if customer is None:
        customer = Customer(mobile=payload.mobile)
        db.add(customer)
        await db.flush()  # ensures customer.id is available

    # 2. Create new KYC session for this customer
    kyc_session = KycSession(
        customer_id=customer.id,
        # status and current_step are set by default in the model
    )

    db.add(kyc_session)
    await db.commit()
    await db.refresh(kyc_session)

    return KycSessionResponse(
        session_id=kyc_session.id,
        customer_id=customer.id,
        status=kyc_session.status.value,
        current_step=kyc_session.current_step.value,
        created_at=kyc_session.created_at,
    )

from uuid import UUID
from app.schemas.kyc_session import KycSessionDetailResponse


@router.get(
    "/session/{session_id}",
    response_model=KycSessionDetailResponse,
    summary="Get the current KYC session status"
)
async def get_kyc_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> KycSessionDetailResponse:
    """
    Fetch the KYC session by ID.
    Used by the frontend to poll status and track progress.
    """
    result = await db.execute(
        select(KycSession).where(KycSession.id == session_id)
    )
    kyc_session = result.scalar_one_or_none()

    if not kyc_session:
        raise HTTPException(
            status_code=404,
            detail="KYC session not found",
        )

    
    return KycSessionDetailResponse(
        session_id=kyc_session.id,
        customer_id=kyc_session.customer_id,
        status=kyc_session.status.value,
        current_step=kyc_session.current_step.value,
        retries_select=kyc_session.retries_select,
        retries_scan=kyc_session.retries_scan,
        retries_upload=kyc_session.retries_upload,
        retries_selfie=kyc_session.retries_selfie,
        failure_reason=kyc_session.failure_reason,
        created_at=kyc_session.created_at,
        updated_at=kyc_session.updated_at,
    )


@router.post(
    "/session/{session_id}/select-document",
    response_model=DocumentSelectResponse,
    summary="Select KYC document type"
)
async def select_document_type(
    session_id: UUID,
    payload: DocumentSelectRequest,
    db: AsyncSession = Depends(get_db)
) -> DocumentSelectResponse:

    # 1. Validate session exists
    result = await db.execute(
        select(KycSession).where(KycSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="KYC session not found"
        )

    # 2. Ensure correct current step
    if session.current_step != KycStep.SELECT_DOC:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot select document at step {session.current_step.value}"
        )

    # 3. Validate document type
    try:
        doc_type_enum = DocumentType(payload.doc_type.upper())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid document type. Allowed: AADHAAR, PAN, PASSPORT, VOTER_ID"
        )

    # 4. Create document record
    doc = KycDocument(
        session_id=session.id,
        doc_type=doc_type_enum
    )

    db.add(doc)

    # 5. Move session to next step
    session.current_step = KycStep.SCAN_DOC

    await db.commit()
    await db.refresh(doc)
    await db.refresh(session)

    return DocumentSelectResponse(
        session_id=session.id,
        document_id=doc.id,
        doc_type=doc.doc_type.value,
        next_step=session.current_step.value
    )

@router.post(
    "/session/{session_id}/enter-doc-number",
    response_model=DocumentNumberResponse,
    summary="Enter PAN/Aadhaar number (before scanning)",
)
async def enter_doc_number(
    session_id: UUID,
    payload: DocumentNumberRequest,
    db: AsyncSession = Depends(get_db),
) -> DocumentNumberResponse:
    """
    Save a user-entered PAN/Aadhaar number for the latest document in this session.
    Performs strict normalization + format validation. If format is valid, number is saved
    and user proceeds to scanning (SCAN_DOC). If invalid, returns descriptive error.
    (No duplicate lookup is performed here — that was intentionally removed.)
    """

    # 1. Validate session exists
    result = await db.execute(select(KycSession).where(KycSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail={"error_code": "SESSION_NOT_FOUND", "message": "KYC session not found."})

    # 2. Must be at SCAN_DOC step (we want user to enter number before scanning)
    if session.current_step != KycStep.SCAN_DOC:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "INVALID_STEP", "message": f"Cannot enter document number at step {session.current_step.value}."},
        )

    # 3. Load latest document for this session
    result = await db.execute(
        select(KycDocument)
        .where(KycDocument.session_id == session_id)
        .order_by(KycDocument.created_at.desc())
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=400, detail={"error_code": "NO_DOCUMENT", "message": "No document record found. Select document type first."})

    # 4. Only support PAN/AADHAAR for manual entry in MVP
    if doc.doc_type not in (DocumentType.PAN, DocumentType.AADHAAR):
        raise HTTPException(
            status_code=400,
            detail={"error_code": "UNSUPPORTED_DOC_TYPE", "message": "Manual entry only supported for PAN and AADHAAR in this endpoint."},
        )

    # 5. Normalize and strictly validate number using helpers + extra checks
    raw = payload.doc_number or ""
    raw = raw.strip()

    if doc.doc_type == DocumentType.PAN:
        normalized = normalize_pan(raw)
        # normalize_pan returns the PAN uppercased with spaces removed if looks good,
        # but it may return the raw input if it didn't match pattern — we enforce pattern here.
        pan_pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]$"
        if not re.fullmatch(pan_pattern, normalized):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_PAN_FORMAT",
                    "message": "PAN format invalid. Expected 10 chars: 5 letters, 4 digits, 1 letter. Example: 'ABCDE1234F'. Please re-enter.",
                },
            )

    else:  # DocumentType.AADHAAR
        normalized = normalize_aadhaar(raw)
        # ensure exactly 12 digits
        if not re.fullmatch(r"^\d{12}$", normalized):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_AADHAAR_FORMAT",
                    "message": "Aadhaar format invalid. Expected exactly 12 digits (numbers only). Please re-enter without spaces or dashes.",
                },
            )

    # 6. Save normalized number to document record
    doc.doc_number = normalized

    await db.commit()
    await db.refresh(doc)
    await db.refresh(session)

    # 7. Return success (user stays at SCAN_DOC; next step is to upload & validate the document image)
    return DocumentNumberResponse(
        session_id=session.id,
        document_id=doc.id,
        doc_number=doc.doc_number,
        next_step=session.current_step.value,
    )


from fastapi import File, UploadFile
from app.schemas.kyc_document import DocumentUploadResponse
from app.utils.storage import save_uploaded_file
from app.workers.connection import document_queue
from app.workers.tasks import validate_document_job


@router.post(
    "/session/{session_id}/validate-document",
    response_model=DocumentUploadResponse,
    summary="Upload document & queue validation job"
)
async def validate_document(
    session_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
) -> DocumentUploadResponse:

    # 1. Validate file type
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG and PNG images are allowed"
        )

    # 2. Validate session exists
    result = await db.execute(
        select(KycSession).where(KycSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(404, "KYC session not found")

    # 3. Ensure correct step
    if session.current_step != KycStep.SCAN_DOC:
        raise HTTPException(
            400,
            f"Cannot validate document during step {session.current_step.value}"
        )

    # 4. Fetch the latest document record
    result = await db.execute(
        select(KycDocument)
        .where(KycDocument.session_id == session_id)
        .order_by(KycDocument.created_at.desc())
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            400,
            "No document record found. Select document type first."
        )

    # 5. Save image locally
    saved_path = save_uploaded_file(session_id, file)

    # 6. Update document record
    doc.storage_url = saved_path
    doc.is_valid = None           # reset for new validation
    doc.quality_score = None      # reset for new validation

    # 7. Move session to VALIDATE_DOC
    session.current_step = KycStep.VALIDATE_DOC
    session.failure_reason = None  # clear old failures

    await db.commit()
    await db.refresh(doc)
    await db.refresh(session)

    # 8. Queue RQ validation job
    document_queue.enqueue(
    "app.workers.tasks.validate_document_job",
    str(doc.id),
)

    return DocumentUploadResponse(
        document_id=doc.id,
        session_id=session.id,
        storage_url=saved_path,
        next_step=session.current_step.value,
        updated_at=session.updated_at,
    )

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.kyc_session import KycSession, KycStep
from app.models.kyc_document import KycDocument
from app.schemas.kyc_session import KycSessionDetailResponse
from app.utils.storage import save_selfie_file
from app.workers.connection import document_queue

@router.post(
    "/session/{session_id}/selfie",
    response_model=KycSessionDetailResponse,
    summary="Upload selfie and queue face validation",
)
async def upload_selfie(
    session_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> KycSessionDetailResponse:
    # 1. Validate file type
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG and PNG images are allowed for selfie.",
        )

    # 2. Load session
    result = await db.execute(
        select(KycSession).where(KycSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="KYC session not found.")

    # Must be at SELFIE step
    if session.current_step != KycStep.SELFIE:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot upload selfie during step {session.current_step.value}.",
        )

    # 3. Save selfie file
    selfie_path = save_selfie_file(session_id, file)
    session.selfie_url = selfie_path
    session.face_match_score = None
    session.failure_reason = None

    # Move to KYC_CHECK (background face match)
    session.current_step = KycStep.KYC_CHECK

    await db.commit()
    await db.refresh(session)

    # 4. Enqueue async face validation job
    # We pass session_id so worker can load selfie + document
    from app.workers.connection import selfie_queue

    selfie_queue.enqueue(
    "app.workers.tasks.validate_selfie_job",
    str(session.id),
    )


    from app.schemas.kyc_session import KycSessionDetailResponse

    return KycSessionDetailResponse(
    session_id=session.id,
    customer_id=session.customer_id,
    status=session.status.value,
    current_step=session.current_step.value,
    retries_select=session.retries_select,
    retries_scan=session.retries_scan,
    retries_upload=session.retries_upload,
    retries_selfie=session.retries_selfie,
    failure_reason=session.failure_reason,
    created_at=session.created_at,
    updated_at=session.updated_at,
)
