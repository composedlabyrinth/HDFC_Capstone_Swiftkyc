import asyncio
from uuid import UUID
from sqlalchemy import select
from app.models.customer import Customer


from app.db.session import async_session_maker
from app.models.kyc_document import KycDocument
from app.models.kyc_session import KycSession, KycStep, KycStatus
from app.services.document_validation import evaluate_document_quality
from app.services.face_validation import assess_selfie_match


# ---------------------------------------------------------
# Helper to run async functions safely inside RQ 
# ---------------------------------------------------------
def run_async(coro):
    """
    RQ workers run in a thread — not safe to call asyncio.run().
    Instead we reuse/create a loop manually.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # If a loop is already running, schedule task
        return asyncio.ensure_future(coro)
    else:
        return loop.run_until_complete(coro)


# ---------------------------------------------------------
# DOCUMENT VALIDATION JOB
# ---------------------------------------------------------
def validate_document_job(document_id: str):
    """RQ entrypoint — safe wrapper around async handler."""
    return run_async(_validate_document_job_async(UUID(document_id)))


async def _validate_document_job_async(document_id: UUID):
    async with async_session_maker() as db:
        # Load document
        result = await db.execute(
            select(KycDocument).where(KycDocument.id == document_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            return

        # Load session
        result = await db.execute(
            select(KycSession).where(KycSession.id == doc.session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return

        if not doc.storage_url:
            session.failure_reason = "No document image found for validation."
            await db.commit()
            return

        # Evaluate document
        try:
            quality = evaluate_document_quality(doc.storage_url)
        except Exception:
            session.failure_reason = "Could not process document image."
            await db.commit()
            return

        doc.quality_score = quality.quality_score
        doc.is_valid = quality.is_valid

        if not quality.is_valid:
            session.retries_scan += 1
            session.failure_reason = quality.reason

            if session.retries_scan >= 3:
                session.status = KycStatus.REJECTED
                session.failure_reason = (
                    quality.reason
                    + " Maximum attempts reached. Please use assisted KYC."
                )
            else:
                session.current_step = KycStep.SCAN_DOC

        else:
            session.failure_reason = None
            session.current_step = KycStep.SELFIE

        await db.commit()


# ---------------------------------------------------------
# SELFIE VALIDATION JOB
# ---------------------------------------------------------
def validate_selfie_job(session_id: str):
    """RQ entrypoint — safe async wrapper."""
    return run_async(_validate_selfie_job_async(UUID(session_id)))


async def _validate_selfie_job_async(session_id: UUID):
    from app.models.kyc_document import KycDocument

    async with async_session_maker() as db:
        # Load session
        result = await db.execute(
            select(KycSession).where(KycSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return

        if session.current_step != KycStep.KYC_CHECK or not session.selfie_url:
            return

        # Latest document
        result = await db.execute(
            select(KycDocument)
            .where(KycDocument.session_id == session.id)
            .order_by(KycDocument.created_at.desc())
        )
        doc = result.scalar_one_or_none()

        if not doc or not doc.storage_url:
            session.failure_reason = "No document found for face match."
            session.current_step = KycStep.SELFIE
            await db.commit()
            return

        # Validate selfie
        match = assess_selfie_match(
            doc_image_path=doc.storage_url,
            selfie_image_path=session.selfie_url,
        )

        session.face_match_score = match.score

        if not match.is_match:
            session.retries_selfie += 1

            if session.retries_selfie >= 3:
                session.status = KycStatus.REJECTED
                session.failure_reason = match.reason or "Selfie does not match."
                session.current_step = KycStep.KYC_CHECK
            else:
                session.failure_reason = (
                    match.reason
                    or "Selfie does not match. Please retake."
                )
                session.current_step = KycStep.SELFIE

        else:
            session.status = KycStatus.APPROVED
            session.failure_reason = None
            session.current_step = KycStep.COMPLETE

        await db.commit()
