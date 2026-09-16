
from __future__ import annotations

"""
CRM V2 – SerpHawk  |  FastAPI Backend
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Body
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlmodel import Session
from modules.scraper import research_and_map_company
from pydantic import BaseModel, Field as PydanticField

from database import engine, SentEmail
from sqlmodel import select

def register_sent_emails_endpoint(app, get_session):
    from fastapi import Depends
    from sqlmodel import Session
    @app.get("/sent-emails")
    def get_sent_emails(client_id: int = None, limit: int = 50, session: Session = Depends(get_session)):
        query = select(SentEmail).order_by(SentEmail.sent_at.desc())
        if client_id:
            query = query.where(SentEmail.client_id == client_id)
        emails = session.exec(query.limit(limit)).all()
        return [
            {
                "id": e.id,
                "client_id": e.client_id,
                "to_email": e.to_email,
                "subject": e.subject,
                "english_body": e.english_body,
                "spanish_body": e.spanish_body,
                "recommended_services": e.recommended_services,
                "manual": e.manual,
                "draft_json": e.draft_json,
                "sent_at": e.sent_at.isoformat() if e.sent_at else None
            }
            for e in emails
        ]

import hashlib
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import text

from database import (
    ActivityLog,
    CallLog,
    ChatMessage,
    ClientFileUpload,
    ClientProfile,
    ClientStatus,
    CompetitorAnalysis,
    Document,
    EmailLog,
    Invoice,
    KeywordRankEntry,
    MessageThread,
    Milestone,
    NPSSurvey,
    Notification,
    Project,
    Proposal,
    Remark,
    ServiceCatalog,
    ServiceRequest,
    Task,
    TaskComment,
    User,
    create_db_and_tables,
    engine,
)


# ─────────────────────────────────────────────────────────────────────────────
# App + CORS
# ─────────────────────────────────────────────────────────────────────────────

def get_session():
    with Session(engine) as session:
        yield session


def _ensure_database_indexes():
    """Create critical indexes for frequently accessed paths."""
    stmts = [
        "CREATE INDEX IF NOT EXISTS idx_message_threads_client_id ON message_threads (client_id)",
        "CREATE INDEX IF NOT EXISTS idx_message_threads_created_at ON message_threads (created_at)",
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages (thread_id)",
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_ts ON chat_messages (thread_id, timestamp)",
        'CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles ("userId")',
        "CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests (client_id)",
        "CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests (status)",
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))

app = FastAPI(title="SerpHawk CRM", version="2.0.0")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    _ensure_database_indexes()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Serve uploaded files
from fastapi.staticfiles import StaticFiles
import os
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ─────────────────────────────────────────────────────────────────────────────
# Email Notification Helper
# ─────────────────────────────────────────────────────────────────────────────
def _send_notification_email(to_email: str, subject: str, body_html: str):
    """Best-effort email notification. Fails silently so it never blocks API responses."""
    try:
        from modules.email_sender import send_email_outlook
        sender = os.environ.get("SENDER_EMAIL", "")
        password = os.environ.get("SENDER_PASSWORD", "")
        if sender and password:
            send_email_outlook(to_email, subject, body_html, sender, password)
    except Exception as e:
        print(f"[Notification email failed] {e}")


def get_session():
    with Session(engine) as session:
        yield session

# Register /sent-emails endpoint after app and get_session are defined
register_sent_emails_endpoint(app, get_session)

# --- Simple In-Memory Cache for Company Analysis ---
company_analysis_cache = {}

# --- Research and Service Mapping Endpoint ---
class ResearchMapRequest(BaseModel):
    company_url: str

@app.post("/research-map-company")
async def research_map_company_endpoint(body: ResearchMapRequest, background_tasks: BackgroundTasks = None):
    try:
        result = await research_and_map_company(body.company_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Smart Research: company name → full analysis + draft + contact email ---
class SmartResearchRequest(BaseModel):
    company_name: str
    company_url: Optional[str] = None

@app.post("/smart-research")
async def smart_research(body: SmartResearchRequest):
    """
    Takes a company name (and optional URL), researches it via LLM,
    finds business contact email, recommends services, and generates an email draft.
    """
    import json as _json
    from modules.fallback_analyzer import analyze_company_name_fallback
    from modules.market_analyzer import match_services
    from modules.llm_engine import get_openai_client, generate_email

    company_name = body.company_name.strip()

    # Step 1: Try scraping website if URL given, otherwise use LLM knowledge
    company_info = {}
    website_content = ""
    if body.company_url and body.company_url.strip():
        try:
            from modules.scraper import scrape_website
            website_content = await scrape_website(body.company_url.strip())
            if not website_content.startswith("ERROR"):
                from modules.llm_engine import analyze_content
                company_info = analyze_content(website_content)
            else:
                company_info = analyze_company_name_fallback(company_name)
        except Exception:
            company_info = analyze_company_name_fallback(company_name)
    else:
        company_info = analyze_company_name_fallback(company_name)

    company_info.setdefault("company_name", company_name)

    # Step 2: Find business contact email via LLM
    contact_email = None
    contact_name = None
    contact_role = None
    try:
        client = get_openai_client()
        email_prompt = f"""You are a business intelligence expert. For the company "{company_name}", find or infer the most likely business contact email address.

Rules:
- If this is a well-known company, use your knowledge of their real domain (e.g. @flipkart.com, @amazon.com)
- For the email, prefer patterns like: info@domain, hello@domain, contact@domain, sales@domain, or partnerships@domain
- Also suggest the most likely contact person name and role (e.g. "Marketing Manager")
- If you found emails from website scraping data, prefer those

{f'Website data contacts: {_json.dumps(company_info.get("contacts", []))}' if company_info.get("contacts") else ''}

Return JSON only:
{{
    "email": "the best business contact email",
    "name": "likely contact person name or null",
    "role": "likely role or null",
    "confidence": "high/medium/low",
    "reasoning": "brief explanation of how you determined this"
}}"""

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return valid JSON only. Be accurate and specific."},
                {"role": "user", "content": email_prompt}
            ],
            response_format={"type": "json_object"}
        )
        contact_data = _json.loads(resp.choices[0].message.content)
        contact_email = contact_data.get("email")
        contact_name = contact_data.get("name")
        contact_role = contact_data.get("role")
    except Exception:
        # Fallback: try to extract from company_info contacts
        contacts = company_info.get("contacts", [])
        if contacts and isinstance(contacts, list) and len(contacts) > 0:
            c = contacts[0]
            contact_email = c.get("email")
            contact_name = c.get("name")
            contact_role = c.get("role")

    # Step 3: Service matching
    services_result = {}
    try:
        market_data = {
            "industry": company_info.get("likely_industry", company_info.get("industry", "")),
            "business_model": company_info.get("business_model", ""),
            "pain_points": company_info.get("common_pain_points", company_info.get("pain_points", [])),
        }
        services_result = match_services(market_data, company_info)
    except Exception:
        services_result = {
            "recommended_services": [
                {"service_name": "Organic SEO", "why_relevant": "Improve online visibility", "expected_impact": "More qualified leads"},
                {"service_name": "Local SEO", "why_relevant": "Dominate local search", "expected_impact": "Increased local customers"}
            ],
            "email_hook": f"Growth opportunities for {company_name}",
            "package_suggestion": "Growth"
        }

    # Step 4: Generate email draft (pass recommended services so they appear in draft)
    draft = {}
    try:
        contact_for_email = {"name": contact_name, "role": contact_role} if contact_name else None
        recommended = services_result.get("recommended_services", [])
        draft = generate_email(company_info, contact=contact_for_email, recommended_services=recommended)
    except Exception:
        draft = {
            "subject": f"Growth Partnership Opportunity – {company_name}",
            "english_body": f"Hi,\n\nI came across {company_name} and was impressed by what you do. I'd love to explore how our SEO and digital marketing services could help accelerate your growth.\n\nBest regards",
            "spanish_body": f"Hola,\n\nEncontré {company_name} y me impresionó lo que hacen. Me encantaría explorar cómo nuestros servicios de SEO y marketing digital podrían ayudar a acelerar su crecimiento.\n\nSaludos",
        }

    return {
        "company_info": company_info,
        "company_url": body.company_url or company_info.get("website") or "",
        "contact": {
            "email": contact_email,
            "name": contact_name,
            "role": contact_role,
        },
        "recommended_services": services_result.get("recommended_services", []),
        "email_hook": services_result.get("email_hook", ""),
        "package_suggestion": services_result.get("package_suggestion", ""),
        "draft": draft,
    }

# --- Send Manual: create client + record email + activity ---
class SendManualRequest(BaseModel):
    to_email: str
    company_name: str
    subject: str
    english_body: str
    spanish_body: Optional[str] = None
    recommended_services: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    website_url: Optional[str] = None

@app.post("/send-manual")
def send_manual(body: SendManualRequest, session: Session = Depends(get_session)):
    """
    Records a manually sent email, creates a client (User + ClientProfile) if not existing,
    and logs an activity entry.
    """
    from datetime import datetime
    import hashlib

    # Step 1: Find or create User by email
    user = session.exec(select(User).where(User.email == body.to_email)).first()
    if not user:
        hashed_pw = hashlib.sha256("password123".encode()).hexdigest()
        user = User(
            email=body.to_email,
            password=hashed_pw,
            name=body.contact_name or body.company_name or "New Client",
            role="Client",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    # Step 2: Find or create ClientProfile
    client_profile = session.exec(
        select(ClientProfile).where(ClientProfile.userId == user.id)
    ).first()
    if not client_profile:
        client_profile = ClientProfile(
            userId=user.id,
            companyName=body.company_name,
            websiteUrl=body.website_url or None,
            status="Active",
            recommended_services=body.recommended_services,
            lastActivity="Outreach email sent",
            lastActivityDate=datetime.utcnow().isoformat(),
        )
        session.add(client_profile)
        session.commit()
        session.refresh(client_profile)
    else:
        # Update existing profile
        client_profile.lastActivity = "Outreach email sent"
        client_profile.lastActivityDate = datetime.utcnow().isoformat()
        if body.recommended_services:
            client_profile.recommended_services = body.recommended_services
        session.add(client_profile)
        session.commit()
        session.refresh(client_profile)

    # Step 3: Save SentEmail record
    sent_email = SentEmail(
        client_id=client_profile.id,
        to_email=body.to_email,
        subject=body.subject,
        english_body=body.english_body,
        spanish_body=body.spanish_body or "",
        recommended_services=body.recommended_services or "",
        manual=True,
        sent_at=datetime.utcnow(),
    )
    session.add(sent_email)
    session.commit()
    session.refresh(sent_email)

    # Step 4: Log activity
    try:
        activity = ActivityLog(
            client_id=client_profile.id,
            action=f"Manual outreach email sent to {body.to_email}",
            details=f"Subject: {body.subject} | Services: {body.recommended_services or 'N/A'}",
            timestamp=datetime.utcnow(),
        )
        session.add(activity)
        session.commit()
    except Exception:
        pass  # Activity logging is best-effort

    return {
        "success": True,
        "client_id": client_profile.id,
        "user_id": user.id,
        "sent_email_id": sent_email.id,
        "message": f"Client created and email recorded for {body.to_email}",
    }


# --- Delete client endpoint ---
@app.delete("/clients/{client_id}")
def delete_client(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    session.delete(cp)
    session.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic request/response models
# ─────────────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    role: str = "Client"


class ClientCreateRequest(BaseModel):
    companyName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str = "Active"
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None


class ClientUpdateRequest(BaseModel):
    companyName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    gmbName: Optional[str] = None
    seoStrategy: Optional[str] = None
    tagline: Optional[str] = None
    websiteUrl: Optional[str] = None
    nextMilestone: Optional[str] = None
    nextMilestoneDate: Optional[str] = None
    lastActivity: Optional[str] = None
    lastActivityDate: Optional[str] = None
    assignedEmployeeId: Optional[int] = None
    customFields: Optional[dict] = None


class AssignEmployeeRequest(BaseModel):
    employee_id: int


class KeywordRequest(BaseModel):
    keyword: str


class RemarkCreateRequest(BaseModel):
    content: str
    authorId: Optional[int] = None
    isInternal: bool = True


class ActivityCreateRequest(BaseModel):
    action: str
    method: Optional[str] = None
    content: Optional[str] = None
    details: Optional[str] = None
    authorId: Optional[int] = None


class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "Planning"
    progress: int = 0
    employeeIds: List[int] = []
    internIds: List[int] = []
    clientIds: List[int] = []


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    employeeIds: Optional[List[int]] = None
    internIds: Optional[List[int]] = None
    clientIds: Optional[List[int]] = None


class ServiceCreateRequest(BaseModel):
    name: str
    cost: float = 0.0
    intro_description: str = ""
    full_description: Optional[str] = None
    handler_role: str = "Employee"
    image_url: Optional[str] = None
    past_results: Optional[str] = None
    is_active: bool = True


class ServiceRequestCreate(BaseModel):
    service_id: int = PydanticField(alias="serviceId")
    client_email: str = PydanticField(alias="clientEmail")

    class Config:
        allow_population_by_field_name = True


class QuoteRequest(BaseModel):
    requestId: int
    quoted_amount: float
    quote_message: str
    team_info: Optional[str] = None
    quote_doc_url: Optional[str] = None
    assigned_employee_id: Optional[int] = None


class SendMessageRequest(BaseModel):
    thread_id: int
    sender_id: int
    content: str


class SendClientMessageRequest(BaseModel):
    client_id: int
    content: str


class CallCreateRequest(BaseModel):
    phone_number: str
    duration_seconds: Optional[int] = None
    summary: Optional[str] = None


class CallSummaryRequest(BaseModel):
    summary: str


class SetupDomainRequest(BaseModel):
    domain: str


class GenerateEmailRequest(BaseModel):
    company_url: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    sender_email: Optional[str] = None
    to_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    manual: Optional[bool] = False
    english_body: Optional[str] = None
    spanish_body: Optional[str] = None
    recommended_services: Optional[str] = None
    client_id: Optional[int] = None


class SendLeadRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    sender_email: Optional[str] = None
    english_body: Optional[str] = None
    spanish_body: Optional[str] = None
    recommended_services: Optional[str] = None
    manual: Optional[bool] = False
    draft_json: Optional[str] = None
    client_id: Optional[int] = None


# ── New Feature Pydantic Models ───────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "Todo"
    priority: str = "Medium"
    due_date: Optional[str] = None
    client_id: Optional[int] = None
    project_id: Optional[int] = None
    assigned_to: Optional[int] = None
    created_by: Optional[int] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    assigned_to: Optional[int] = None


class TaskCommentCreateRequest(BaseModel):
    content: str
    author_id: Optional[int] = None


class InvoiceCreateRequest(BaseModel):
    client_id: int
    service_request_id: Optional[int] = None
    amount: float
    tax: float = 0.0
    due_date: Optional[str] = None
    notes: Optional[str] = None
    line_items: Optional[List[dict]] = []


class InvoiceUpdateRequest(BaseModel):
    status: Optional[str] = None
    amount: Optional[float] = None
    tax: Optional[float] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    line_items: Optional[List[dict]] = None


class NotificationCreateRequest(BaseModel):
    user_id: int
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None


class MilestoneCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    client_id: Optional[int] = None
    due_date: Optional[str] = None
    status: str = "Pending"
    order: int = 0


class MilestoneUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    order: Optional[int] = None


class NPSRespondRequest(BaseModel):
    score: int
    feedback: Optional[str] = None


class ProposalCreateRequest(BaseModel):
    title: str
    client_id: Optional[int] = None
    service_request_id: Optional[int] = None
    content: Optional[str] = None
    status: str = "Draft"
    valid_until: Optional[str] = None
    total_value: Optional[float] = None
    created_by: Optional[int] = None


class ProposalUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    valid_until: Optional[str] = None
    total_value: Optional[float] = None


class FileUploadRequest(BaseModel):
    client_id: int
    uploaded_by: Optional[int] = None
    filename: str
    file_url: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    description: Optional[str] = None


class KeywordRankRequest(BaseModel):
    client_id: int
    keyword: str
    position: Optional[int] = None
    url: Optional[str] = None
    search_engine: str = "Google"
    notes: Optional[str] = None
    recorded_by: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _check_password(plain: str, hashed: str) -> bool:
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


def _user_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role}


def _client_dict(cp: ClientProfile, session: Session) -> dict:
    user = session.get(User, cp.userId) if cp.userId else None
    return {
        "id": cp.id,
        "userId": cp.userId,
        "email": user.email if user else None,
        "name": user.name if user else None,
        "companyName": cp.companyName,
        "phone": cp.phone,
        "address": cp.address,
        "status": cp.status,
        "gmbName": cp.gmbName,
        "seoStrategy": cp.seoStrategy,
        "tagline": cp.tagline,
        "targetKeywords": cp.targetKeywords or [],
        "websiteUrl": cp.websiteUrl,
        "recommended_services": cp.recommended_services,
        "nextMilestone": cp.nextMilestone,
        "nextMilestoneDate": cp.nextMilestoneDate,
        "lastActivity": cp.lastActivity,
        "lastActivityDate": cp.lastActivityDate,
        "assignedEmployeeId": cp.assignedEmployeeId,
        "projectId": cp.projectId,
        "projectName": cp.projectName,
        "payment_status": cp.payment_status,
        "sitemap_url": cp.sitemap_url,
        "cms_type": cp.cms_type,
        "customFields": cp.customFields or {},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/login")
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Support both hashed and plain-text passwords (plain for dev seeds)
    if not (_check_password(body.password, user.password) or body.password == user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    result = _user_dict(user)
    if user.role == "Client":
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
        if cp:
            result["client_id"] = cp.id
    return {"user": result}


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/users")
def create_user(body: CreateUserRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        email=body.email,
        password=_hash_password(body.password),
        name=body.name,
        role=body.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    if body.role == "Client":
        cp = ClientProfile(userId=user.id)
        session.add(cp)
        session.commit()
    return {"user": _user_dict(user)}


@app.delete("/users/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Employees & Interns
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/employees")
def list_employees(session: Session = Depends(get_session)):
    employees = session.exec(select(User).where(User.role == "Employee")).all()
    return {"employees": [_user_dict(u) for u in employees]}


@app.get("/interns")
def list_interns(session: Session = Depends(get_session)):
    interns = session.exec(select(User).where(User.role == "Intern")).all()
    return {"interns": [_user_dict(u) for u in interns]}


# ─────────────────────────────────────────────────────────────────────────────
# Client Statuses
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/client-statuses")
def list_client_statuses(session: Session = Depends(get_session)):
    statuses = session.exec(select(ClientStatus)).all()
    if not statuses:
        # Return sensible defaults if table is empty
        statuses = [
            {"id": 1, "name": "Active", "color": "bg-emerald-500"},
            {"id": 2, "name": "Hold", "color": "bg-amber-500"},
            {"id": 3, "name": "Pending", "color": "bg-slate-400"},
        ]
        return {"statuses": statuses}
    return {"statuses": [{"id": s.id, "name": s.name, "color": s.color} for s in statuses]}


# ─────────────────────────────────────────────────────────────────────────────
# Clients
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/clients")
def list_clients(
    status: Optional[str] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(ClientProfile)
    
    # Filter by status if provided
    if status:
        q = q.where(ClientProfile.status == status)
    
    # Filter by search term if provided
    if search:
        search_term = f"%{search}%"
        q = q.where(
            (ClientProfile.companyName.ilike(search_term)) |
            (ClientProfile.projectName.ilike(search_term)) |
            (ClientProfile.websiteUrl.ilike(search_term))
        )
    
    clients = session.exec(q).all()
    return {"clients": [_client_dict(c, session) for c in clients]}


@app.post("/clients")
def create_client(body: ClientCreateRequest, session: Session = Depends(get_session)):
    user = None
    if body.email:
        user = session.exec(select(User).where(User.email == body.email)).first()
        if not user:
            user = User(
                email=body.email,
                password=_hash_password(body.password or "changeme"),
                name=body.name,
                role="Client",
            )
            session.add(user)
            session.commit()
            session.refresh(user)

    cp = ClientProfile(
        userId=user.id if user else None,
        companyName=body.companyName,
        phone=body.phone,
        address=body.address,
        status=body.status,
    )
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return {"client": _client_dict(cp, session)}


@app.get("/clients/{client_id}")
def get_client(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"client": _client_dict(cp, session)}


@app.put("/clients/{client_id}")
def update_client(
    client_id: int, body: ClientUpdateRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        if field == "customFields" and val is not None:
            cp.customFields = {**(cp.customFields or {}), **val}
        else:
            setattr(cp, field, val)
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return {"client": _client_dict(cp, session)}


@app.post("/clients/{client_id}/assign-employee")
def assign_employee(
    client_id: int, body: AssignEmployeeRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    cp.assignedEmployeeId = body.employee_id
    session.add(cp)
    session.commit()
    return {"ok": True}


@app.post("/clients/{client_id}/keywords")
def add_keyword(
    client_id: int, body: KeywordRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    kws = list(cp.targetKeywords or [])
    if body.keyword not in kws:
        kws.append(body.keyword)
    cp.targetKeywords = kws
    session.add(cp)
    session.commit()
    return {"keywords": cp.targetKeywords}


@app.delete("/clients/{client_id}/keywords")
def remove_keyword(
    client_id: int, keyword: str = Query(...), session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    cp.targetKeywords = [k for k in (cp.targetKeywords or []) if k != keyword]
    session.add(cp)
    session.commit()
    return {"keywords": cp.targetKeywords}


@app.get("/clients/{client_id}/remarks")
def get_client_remarks(client_id: int, session: Session = Depends(get_session)):
    remarks = session.exec(
        select(Remark).where(Remark.clientId == client_id).order_by(Remark.createdAt.desc())
    ).all()
    return {
        "remarks": [
            {
                "id": r.id,
                "content": r.content,
                "authorId": r.authorId,
                "isInternal": r.isInternal,
                "createdAt": r.createdAt.isoformat(),
            }
            for r in remarks
        ]
    }


@app.post("/clients/{client_id}/remarks")
def add_client_remark(
    client_id: int, body: RemarkCreateRequest, session: Session = Depends(get_session)
):
    r = Remark(
        content=body.content,
        authorId=body.authorId,
        clientId=client_id,
        isInternal=body.isInternal,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return {
        "id": r.id,
        "content": r.content,
        "authorId": r.authorId,
        "isInternal": r.isInternal,
        "createdAt": r.createdAt.isoformat(),
    }


@app.get("/clients/{client_id}/activities")
def get_client_activities(client_id: int, session: Session = Depends(get_session)):
    logs = session.exec(
        select(ActivityLog)
        .where(ActivityLog.clientId == client_id)
        .order_by(ActivityLog.createdAt.desc())
    ).all()
    return {
        "activities": [
            {
                "id": a.id,
                "action": a.action,
                "method": a.method,
                "content": a.content,
                "details": a.details,
                "createdAt": a.createdAt.isoformat(),
            }
            for a in logs
        ]
    }


@app.post("/clients/{client_id}/activities")
def add_client_activity(
    client_id: int, body: ActivityCreateRequest, session: Session = Depends(get_session)
):
    log = ActivityLog(
        clientId=client_id,
        userId=body.authorId,
        action=body.action,
        method=body.method,
        content=body.content,
        details=body.details,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return {"id": log.id, "action": log.action, "createdAt": log.createdAt.isoformat()}


@app.get("/clients/{client_id}/emails")
def get_client_emails(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"emails": []}


# ─────────────────────────────────────────────────────────────────────────────
# Admin – Client X-Ray
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/admin/client-xray/{client_id}")
def admin_client_xray(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    remarks = session.exec(select(Remark).where(Remark.clientId == client_id)).all()
    activities = session.exec(
        select(ActivityLog).where(ActivityLog.clientId == client_id)
    ).all()
    service_reqs = session.exec(
        select(ServiceRequest).where(ServiceRequest.client_id == client_id)
    ).all()

    # Enrich active services for client x-ray.
    active_services = []
    for sr in service_reqs:
        svc = session.get(ServiceCatalog, sr.service_id)
        active_services.append({
            "request_id": sr.id,
            "status": sr.status,
            "service_id": sr.service_id,
            "service_name": svc.name if svc else "Unknown Service",
            "quoted_amount": sr.quoted_amount,
            "quote_message": sr.quote_message,
            "requested_at": sr.requested_at.isoformat(),
            "assigned_employee_name": (session.get(User, sr.assigned_employee_id).name if sr.assigned_employee_id and session.get(User, sr.assigned_employee_id) else "Unassigned"),
        })

    latest_audit = session.exec(
        select(SEOAudit).where(SEOAudit.clientId == client_id).order_by(SEOAudit.last_run.desc()).limit(1)
    ).first()

    latest_analytics = session.exec(
        select(AnalyticsData).where(AnalyticsData.clientId == client_id).order_by(AnalyticsData.last_synced.desc()).limit(1)
    ).first()

    return {
        "client": _client_dict(cp, session),
        "remarks": [
            {"id": r.id, "content": r.content, "createdAt": r.createdAt.isoformat()}
            for r in remarks
        ],
        "activities": [
            {"id": a.id, "action": a.action, "createdAt": a.createdAt.isoformat()}
            for a in activities
        ],
        "service_requests": [
            {"id": sr.id, "status": sr.status, "service_id": sr.service_id}
            for sr in service_reqs
        ],
        "active_services": active_services,
        "latest_audit": {
            "health_score": latest_audit.health_score if latest_audit else None,
            "page_speed_desktop": latest_audit.page_speed_desktop if latest_audit else None,
            "page_speed_mobile": latest_audit.page_speed_mobile if latest_audit else None,
            "core_web_vitals_passed": latest_audit.core_web_vitals_passed if latest_audit else False,
            "last_run": latest_audit.last_run.isoformat() if latest_audit else None,
        },
        "latest_analytics": {
            "sessions": latest_analytics.sessions if latest_analytics else None,
            "pageviews": latest_analytics.pageviews if latest_analytics else None,
            "gsc_impressions": latest_analytics.gsc_impressions if latest_analytics else None,
            "gsc_ctr": latest_analytics.gsc_ctr if latest_analytics else None,
            "gsc_position": latest_analytics.gsc_position if latest_analytics else None,
            "last_synced": latest_analytics.last_synced.isoformat() if latest_analytics else None,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Projects
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/projects")
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project)).all()
    return {"projects": [_project_dict(p) for p in projects]}


@app.post("/projects")
def create_project(body: ProjectCreateRequest, session: Session = Depends(get_session)):
    p = Project(
        name=body.name,
        description=body.description,
        status=body.status,
        progress=body.progress,
        employeeIds=body.employeeIds,
        internIds=body.internIds,
        clientIds=body.clientIds,
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"project": _project_dict(p)}


@app.get("/projects/{project_id}")
def get_project(project_id: int, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    remarks = session.exec(select(Remark).where(Remark.projectId == project_id)).all()
    return {
        "project": _project_dict(p),
        "remarks": [
            {"id": r.id, "content": r.content, "createdAt": r.createdAt.isoformat()}
            for r in remarks
        ],
    }


@app.put("/projects/{project_id}")
def update_project(
    project_id: int, body: ProjectUpdateRequest, session: Session = Depends(get_session)
):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    p.updatedAt = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"project": _project_dict(p)}


@app.delete("/projects/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


@app.post("/projects/{project_id}/remarks")
def add_project_remark(
    project_id: int, body: RemarkCreateRequest, session: Session = Depends(get_session)
):
    r = Remark(
        content=body.content,
        authorId=body.authorId,
        projectId=project_id,
        isInternal=body.isInternal,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return {"id": r.id, "content": r.content, "createdAt": r.createdAt.isoformat()}


def _project_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "progress": p.progress,
        "employeeIds": p.employeeIds or [],
        "internIds": p.internIds or [],
        "clientIds": p.clientIds or [],
        "createdAt": p.createdAt.isoformat(),
        "updatedAt": p.updatedAt.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Services (Catalog + Requests)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/services")
def list_services(session: Session = Depends(get_session)):
    svcs = session.exec(select(ServiceCatalog).where(ServiceCatalog.is_active == True)).all()
    return {
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "cost": s.cost,
                "intro_description": s.intro_description,
                "full_description": s.full_description,
                "handler_role": s.handler_role,
                "image_url": s.image_url,
                "past_results": s.past_results,
            }
            for s in svcs
        ]
    }


@app.post("/services")
def create_service(body: ServiceCreateRequest, session: Session = Depends(get_session)):
    svc = ServiceCatalog(**body.model_dump())
    session.add(svc)
    session.commit()
    session.refresh(svc)
    return {"service": {"id": svc.id, "name": svc.name}}


@app.post("/services/request")
def request_service(body: ServiceRequestCreate, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.client_email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Client user not found")
    cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Client profile not found")

    sr = ServiceRequest(service_id=body.service_id, client_id=cp.id)
    session.add(sr)
    session.commit()
    session.refresh(sr)

    # Create a message thread for this request
    thread = MessageThread(
        service_request_id=sr.id,
        client_id=cp.id,
    )
    session.add(thread)
    session.commit()
    session.refresh(thread)

    # Optional system message to start conversation
    session.add(ChatMessage(
        thread_id=thread.id,
        sender_id=user.id,
        content=f"Client {user.name or user.email} requested service ID {body.service_id}.",
        is_system=True,
    ))

    # Notify admins about new request
    admins = session.exec(select(User).where(User.role.in_(("Admin", "Employee")))).all()
    for admin in admins:
        session.add(Notification(
            user_id=admin.id,
            title="New Service Request",
            message=f"{cp.companyName or user.email} requested a new service.",
            type="info",
            link="/admin/requests",
        ))
    session.commit()

    # Send email to admins for awareness (best-effort)
    for admin in admins:
        if admin.email:
            _send_notification_email(
                admin.email,
                "New Client Service Request",
                f"<p>{cp.companyName or user.email} requested service ID <strong>{body.service_id}</strong>.</p>"
            )

    return {"request": {"id": sr.id, "status": sr.status}}


@app.get("/services/my-requests")
def my_requests(client_email: str = Query(...), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == client_email)).first()
    if not user:
        return {"requests": []}
    cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
    if not cp:
        return {"requests": []}
    reqs = session.exec(select(ServiceRequest).where(ServiceRequest.client_id == cp.id)).all()
    return {
        "requests": [
            {
                "id": r.id,
                "status": r.status,
                "service_id": r.service_id,
                "service_name": r.service.name if r.service else None,
                "quoted_amount": r.quoted_amount,
                "quote_message": r.quote_message,
                "quote_doc_url": r.quote_doc_url,
                "team_info": r.team_info,
                "requested_at": r.requested_at.isoformat(),
            }
            for r in reqs
        ]
    }


@app.get("/services/requests")
def all_service_requests(session: Session = Depends(get_session)):
    reqs = session.exec(select(ServiceRequest)).all()
    result = []
    for r in reqs:
        cp = session.get(ClientProfile, r.client_id)
        user = session.get(User, cp.userId) if cp and cp.userId else None
        svc = session.get(ServiceCatalog, r.service_id)
        emp = session.get(User, r.assigned_employee_id) if r.assigned_employee_id else None
        result.append(
            {
                "id": r.id,
                "status": r.status,
                "service_id": r.service_id,
                "service_name": svc.name if svc else None,
                "client_id": r.client_id,
                "client_name": user.name if user else None,
                "client_email": user.email if user else None,
                "assigned_employee_id": r.assigned_employee_id,
                "assigned_employee_name": emp.name if emp else None,
                "quoted_amount": r.quoted_amount,
                "quote_message": r.quote_message,
                "quote_doc_url": r.quote_doc_url,
                "team_info": r.team_info,
                "requested_at": r.requested_at.isoformat(),
                "quote_sent_at": r.quote_sent_at.isoformat() if r.quote_sent_at else None,
            }
        )
    return {"requests": result}


@app.post("/services/quote")
def send_quote(body: QuoteRequest, session: Session = Depends(get_session)):
    sr = session.get(ServiceRequest, body.requestId)
    if not sr:
        raise HTTPException(status_code=404, detail="Request not found")
    sr.quoted_amount = body.quoted_amount
    sr.quote_message = body.quote_message
    sr.team_info = body.team_info
    sr.quote_doc_url = body.quote_doc_url
    sr.status = "Quoted"
    sr.quote_sent_at = datetime.utcnow()
    if body.assigned_employee_id:
        sr.assigned_employee_id = body.assigned_employee_id
    session.add(sr)
    session.commit()

    # Notify client about quote sent
    cp = session.get(ClientProfile, sr.client_id)
    if cp and cp.userId:
        client_user = session.get(User, cp.userId)
        if client_user and client_user.email:
            _send_notification_email(
                client_user.email,
                f"Quote for service request #{sr.id}",
                f"<p>Your quote is ready for request #{sr.id}. Please check your dashboard to accept it.</p>"
            )
        session.add(Notification(
            user_id=client_user.id if client_user else cp.userId,
            title="Quote Sent",
            message=f"A quote has been sent for your service request #{sr.id}.",
            type="info",
            link="/store?tab=requests",
        ))

    # Add message to thread for visibility
    thread = session.exec(select(MessageThread).where(MessageThread.service_request_id == sr.id)).first()
    if thread:
        admin_user = session.get(User, body.assigned_employee_id) if body.assigned_employee_id else session.exec(select(User).where(User.role == "Admin")).first()
        if admin_user:
            session.add(ChatMessage(
                thread_id=thread.id,
                sender_id=admin_user.id,
                content=f"Quote sent: ${body.quoted_amount}. {body.quote_message}",
                is_system=True,
            ))
    session.commit()

    return {"ok": True}


@app.post("/services/accept-quote/{request_id}")
def accept_quote(request_id: int, session: Session = Depends(get_session)):
    sr = session.get(ServiceRequest, request_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Request not found")
    sr.status = "Accepted"
    sr.client_accepted_quote = True
    sr.accepted_at = datetime.utcnow()
    session.add(sr)
    session.commit()

    cp = session.get(ClientProfile, sr.client_id)
    # send admin/admin-team notification to confirm acceptance
    admins = session.exec(select(User).where(User.role.in_(("Admin", "Employee")))).all()
    for admin in admins:
        session.add(Notification(
            user_id=admin.id,
            title="Client Accepted Quote",
            message=f"Client {cp.companyName or cp.userId} accepted quote for request #{sr.id}.",
            type="success",
            link="/admin/requests",
        ))

    # Post system message to thread
    thread = session.exec(select(MessageThread).where(MessageThread.service_request_id == sr.id)).first()
    if thread:
        system_sender = session.exec(select(User).where(User.role == "Admin")).first()
        if system_sender:
            session.add(ChatMessage(
                thread_id=thread.id,
                sender_id=system_sender.id,
                content=f"Service request #{sr.id} was accepted by client.",
                is_system=True,
            ))

    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Admin – Services Overview
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/admin/services-overview")
def admin_services_overview(session: Session = Depends(get_session)):
    reqs = session.exec(select(ServiceRequest)).all()
    statuses = {}
    for r in reqs:
        statuses[r.status] = statuses.get(r.status, 0) + 1
    svcs = session.exec(select(ServiceCatalog)).all()
    return {
        "total_requests": len(reqs),
        "by_status": statuses,
        "services": [{"id": s.id, "name": s.name, "active": s.is_active} for s in svcs],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Messages
# ─────────────────────────────────────────────────────────────────────────────
WELCOME_MESSAGE_TEXT = "Welcome to the new beginning"


def _ensure_threads_and_welcome_messages(
    session: Session,
    client_ids: List[int],
    support_user_id: int,
):
    """Create one thread per client if missing and seed a default welcome message."""
    valid_client_ids = [cid for cid in client_ids if cid is not None]
    if not valid_client_ids:
        return

    existing_threads = session.exec(
        select(MessageThread).where(MessageThread.client_id.in_(valid_client_ids))
    ).all()
    thread_by_client = {t.client_id: t for t in existing_threads}

    created_threads: List[MessageThread] = []
    for client_id in valid_client_ids:
        if client_id in thread_by_client:
            continue
        thread = MessageThread(
            client_id=client_id,
            employee_id=support_user_id,
            status="Active",
        )
        session.add(thread)
        created_threads.append(thread)

    if created_threads:
        session.commit()
        for thread in created_threads:
            session.refresh(thread)
            thread_by_client[thread.client_id] = thread

    all_threads = list(thread_by_client.values())
    if not all_threads:
        return

    thread_ids = [t.id for t in all_threads if t.id is not None]
    if not thread_ids:
        return

    existing_message_thread_ids = session.exec(
        select(ChatMessage.thread_id)
        .where(ChatMessage.thread_id.in_(thread_ids))
        .distinct()
    ).all()
    threads_with_messages = set(existing_message_thread_ids)

    messages_added = False
    for thread in all_threads:
        if thread.id in threads_with_messages:
            continue
        session.add(
            ChatMessage(
                thread_id=thread.id,
                sender_id=support_user_id,
                content=WELCOME_MESSAGE_TEXT,
                is_system=True,
            )
        )
        messages_added = True

    if messages_added:
        session.commit()


@app.get("/messages/{user_id}")
def get_message_threads(
    user_id: int,
    thread_limit: int = Query(default=120, ge=10, le=500),
    message_limit: int = Query(default=30, ge=5, le=100),
    session: Session = Depends(get_session),
):
    from collections import defaultdict

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    support_user = session.exec(select(User).where(User.role == "Admin")).first()
    if not support_user:
        support_user = session.exec(select(User).where(User.role == "Employee")).first()
    if not support_user:
        support_user = user

    if user.role in ("Admin", "Employee"):
        all_clients = session.exec(select(ClientProfile)).all()
        _ensure_threads_and_welcome_messages(
            session=session,
            client_ids=[c.id for c in all_clients if c.id is not None],
            support_user_id=support_user.id,
        )
        threads = session.exec(
            select(MessageThread)
            .limit(thread_limit)
        ).all()
    else:
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user_id)).first()
        if not cp:
            return {"threads": []}
        _ensure_threads_and_welcome_messages(
            session=session,
            client_ids=[cp.id],
            support_user_id=support_user.id,
        )
        threads = session.exec(
            select(MessageThread).where(MessageThread.client_id == cp.id)
            .limit(thread_limit)
        ).all()

    if not threads:
        return {"threads": []}

    thread_ids = [t.id for t in threads]

    # Batch-fetch client profiles
    client_ids = [t.client_id for t in threads]
    clients: dict = {}
    if client_ids:
        clients = {
            c.id: c
            for c in session.exec(select(ClientProfile).where(ClientProfile.id.in_(client_ids))).all()
        }

    # Batch-fetch service requests
    sr_ids = list({t.service_request_id for t in threads if t.service_request_id})
    service_requests: dict = {}
    if sr_ids:
        service_requests = {
            sr.id: sr
            for sr in session.exec(select(ServiceRequest).where(ServiceRequest.id.in_(sr_ids))).all()
        }

    # Batch-fetch service catalog entries
    svc_ids = list({sr.service_id for sr in service_requests.values() if sr.service_id})
    services: dict = {}
    if svc_ids:
        services = {
            s.id: s
            for s in session.exec(select(ServiceCatalog).where(ServiceCatalog.id.in_(svc_ids))).all()
        }

    # Batch-fetch all messages for all threads in one query
    max_total_messages = max(100, thread_limit * message_limit)
    all_messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.thread_id.in_(thread_ids))
        .order_by(ChatMessage.timestamp.desc())
        .limit(max_total_messages)
    ).all()
    all_messages = sorted(all_messages, key=lambda m: (m.thread_id, m.timestamp))

    # Collect all user IDs needed (employees + message senders)
    user_ids_needed = {t.employee_id for t in threads if t.employee_id}
    user_ids_needed.update(m.sender_id for m in all_messages)
    users_map: dict = {}
    if user_ids_needed:
        users_map = {
            u.id: u
            for u in session.exec(select(User).where(User.id.in_(list(user_ids_needed)))).all()
        }

    # Group messages by thread_id
    msgs_by_thread: dict = defaultdict(list)
    for m in all_messages:
        thread_messages = msgs_by_thread[m.thread_id]
        thread_messages.append(m)
        if len(thread_messages) > message_limit:
            thread_messages.pop(0)

    result = []
    for t in threads:
        client = clients.get(t.client_id)
        sr = service_requests.get(t.service_request_id)
        svc = services.get(sr.service_id) if sr else None
        emp = users_map.get(t.employee_id) if t.employee_id else None
        msgs = msgs_by_thread.get(t.id, [])
        
        # Determine display name: prioritize service name, then company name, then project name
        display_name = None
        if svc:
            display_name = svc.name
        elif client and client.companyName:
            display_name = client.companyName
        elif client and client.projectName:
            display_name = client.projectName
        else:
            display_name = "Conversation"

        latest_message_ts = None
        if msgs:
            latest_message_ts = msgs[-1].timestamp.isoformat()
        else:
            latest_message_ts = t.created_at.isoformat() if getattr(t, 'created_at', None) else datetime.utcnow().isoformat()

        result.append(
            {
                "thread_id": t.id,
                "client_id": t.client_id,
                "service_request_id": t.service_request_id,
                "display_name": display_name,
                "service_name": svc.name if svc else "Service",
                "service_status": sr.status if sr else "Unknown",
                "company_name": client.companyName if client else None,
                "client_name": client.projectName if client else None,
                "handler": emp.name if emp else "Support Team",
                "latest_message_ts": latest_message_ts,
                "messages": [
                    {
                        "id": m.id,
                        "sender": _get_sender_name_from_map(m.sender_id, users_map),
                        "content": m.content,
                        "timestamp": m.timestamp.isoformat(),
                        "isMe": m.sender_id == user_id,
                    }
                    for m in msgs
                ],
            }
        )

    # Sort threads with newest messages first
    def _thread_sort_key(item):
        try:
            return datetime.fromisoformat(item.get("latest_message_ts") or "1970-01-01T00:00:00")
        except Exception:
            return datetime(1970, 1, 1)

    result.sort(key=_thread_sort_key, reverse=True)

    # Strip helper field before returning
    for entry in result:
        if "latest_message_ts" in entry:
            del entry["latest_message_ts"]

    return {"threads": result}


@app.post("/messages/send-to-client")
def send_message_to_client(
    body: SendClientMessageRequest,
    session: Session = Depends(get_session)
):
    """Send a message to a client. Creates thread if needed."""
    try:
        # Get the first admin user, or the first user if no admin exists
        admin = session.exec(select(User).where(User.role == "Admin")).first()
        if not admin:
            admin = session.exec(select(User)).first()
        
        if not admin:
            raise HTTPException(status_code=400, detail="No users found in system")
        
        admin_id = admin.id
        
        # Get or create message thread for this client
        client = session.get(ClientProfile, body.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Check if thread already exists
        thread = session.exec(
            select(MessageThread).where(MessageThread.client_id == body.client_id)
        ).first()
        
        if not thread:
            # Create new thread
            thread = MessageThread(
                client_id=body.client_id,
                employee_id=admin_id,
                status="Active"
            )
            session.add(thread)
            session.commit()
            session.refresh(thread)
        
        # Create and send message
        msg = ChatMessage(
            thread_id=thread.id,
            sender_id=admin_id,
            content=body.content,
        )
        session.add(msg)
        session.commit()
        session.refresh(msg)
        
        return {
            "success": True,
            "message_id": msg.id,
            "thread_id": thread.id,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/messages/send")
def send_message(body: SendMessageRequest, session: Session = Depends(get_session)):
    thread = session.get(MessageThread, body.thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    msg = ChatMessage(
        thread_id=body.thread_id,
        sender_id=body.sender_id,
        content=body.content,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return {
        "id": msg.id,
        "sender": _get_sender_name(msg.sender_id, session),
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
    }


def _get_sender_name(sender_id: int, session: Session) -> str:
    u = session.get(User, sender_id)
    return u.name or u.email if u else "Unknown"


def _get_sender_name_from_map(sender_id: int, users_map: dict) -> str:
    u = users_map.get(sender_id)
    return (u.name or u.email) if u else "Unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Calls
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/calls")
def list_calls(unsummarized: Optional[bool] = None, session: Session = Depends(get_session)):
    q = select(CallLog).order_by(CallLog.received_at.desc())
    calls = session.exec(q).all()
    result = []
    for c in calls:
        d = _call_dict(c)
        if unsummarized is True and d.get("summary"):
            continue
        result.append(d)
    return {"calls": result}


@app.post("/calls")
def log_call(body: CallCreateRequest, session: Session = Depends(get_session)):
    c = CallLog(
        phone_number=body.phone_number,
        duration_seconds=body.duration_seconds,
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return {"call": _call_dict(c)}


@app.put("/calls/{call_id}")
def update_call(
    call_id: int, body: Dict[str, Any], session: Session = Depends(get_session)
):
    c = session.get(CallLog, call_id)
    if not c:
        raise HTTPException(status_code=404, detail="Call not found")
    for field, val in body.items():
        if hasattr(c, field):
            setattr(c, field, val)
    session.add(c)
    session.commit()
    session.refresh(c)
    return {"call": _call_dict(c)}


@app.post("/calls/{call_id}/summary")
def add_call_summary(
    call_id: int, body: CallSummaryRequest, session: Session = Depends(get_session)
):
    c = session.get(CallLog, call_id)
    if not c:
        raise HTTPException(status_code=404, detail="Call not found")
    # CallLog model doesn't have a summary field yet; ignore gracefully
    return {"ok": True}


def _call_dict(c: CallLog) -> dict:
    return {
        "id": c.id,
        "phone_number": c.phone_number,
        "received_at": c.received_at.isoformat(),
        "duration_seconds": c.duration_seconds,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Documents / OCR
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import UploadFile, File
from modules.llm_engine import analyze_document

@app.post("/documents/ocr")
async def ocr_document(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = analyze_document(image_bytes)
        if "error" in result:
            return {"error": result["error"]}
        return result
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Activities (global)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/activities")
def list_activities(session: Session = Depends(get_session)):
    logs = session.exec(
        select(ActivityLog).order_by(ActivityLog.createdAt.desc()).limit(100)
    ).all()
    return {
        "activities": [
            {
                "id": a.id,
                "action": a.action,
                "method": a.method,
                "content": a.content,
                "details": a.details,
                "createdAt": a.createdAt.isoformat(),
            }
            for a in logs
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# Email Agent
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/generate")
def generate_email(body: GenerateEmailRequest, background_tasks: BackgroundTasks = None):
    try:
        from modules.llm_engine import generate_email as _gen, analyze_content
        from modules.scraper import scrape_website
        from modules.email_sender import send_email_outlook
        import os
        from database import SentEmail
        import json
        session = next(get_session())

        # --- Static Email Template ---
        OUTREACH_SUBJECT = "Let's grow {company_name} together!"
        OUTREACH_BODY_EN = (
            "Hi {company_name},\n\n"
            "We'd love to help {company_name} grow online with our services: {services}.\n\n"
            "Best,\nDapros Team"
        )
        OUTREACH_BODY_ES = (
            "Hola {company_name},\n\n"
            "Nos encantaría ayudar a {company_name} a crecer en línea con nuestros servicios: {services}.\n\n"
            "Saludos,\nEquipo Dapros"
        )
        INBOUND_SUBJECT = "Thank you for reaching out, {company_name}!"
        INBOUND_BODY_EN = (
            "Hi {company_name},\n\n"
            "Thank you for your interest in our services: {services}. We'll get back to you soon.\n\n"
            "Best,\nDapros Team"
        )
        INBOUND_BODY_ES = (
            "Hola {company_name},\n\n"
            "Gracias por su interés en nuestros servicios: {services}. Nos pondremos en contacto pronto.\n\n"
            "Saludos,\nEquipo Dapros"
        )


        # Always use LLM to analyze and generate email, even if only company name or email is provided
        if body.company_url:
            text = scrape_website(body.company_url)
        else:
            text = f"{body.company_name or ''} {body.to_email or ''}"
            # Use LLM for company research, service mapping, and draft generation based on company name and website (no scraping)
            llm_input = f"Company Name: {body.company_name or ''}\nWebsite: {body.company_url or ''}"
            analysis = analyze_content(llm_input)
            company_name = analysis.get("company_name") or body.company_name or "Your Company"
            services = ", ".join(analysis.get("key_value_props") or ["SEO", "PPC", "Web Development"])
            # Try to extract company email from analysis.contacts
            company_email = None
            contacts = analysis.get("contacts") or []
            for c in contacts:
                if c.get("email"):
                    company_email = c["email"]
                    break
            # Use LLM to generate outreach and inbound drafts
            outreach_llm = _gen(analysis)
            inbound_llm = _gen(analysis)
            outreach_subject = outreach_llm.get("subject") or OUTREACH_SUBJECT.format(company_name=company_name)
            outreach_body_en = outreach_llm.get("english_body") or OUTREACH_BODY_EN.format(company_name=company_name, services=services)
            outreach_body_es = outreach_llm.get("spanish_body") or OUTREACH_BODY_ES.format(company_name=company_name, services=services)
            inbound_subject = inbound_llm.get("subject") or INBOUND_SUBJECT.format(company_name=company_name)
            inbound_body_en = inbound_llm.get("english_body") or INBOUND_BODY_EN.format(company_name=company_name, services=services)
            inbound_body_es = inbound_llm.get("spanish_body") or INBOUND_BODY_ES.format(company_name=company_name, services=services)

        sender = body.sender_email or os.getenv("EMAIL_SENDER", "")
        password = os.getenv("EMAIL_PASSWORD", "")
        # Only send the email if manual is False and all required fields are present
        if not body.manual and all([body.to_email, body.subject, body.body, sender, password]):
            try:
                send_email_outlook(
                    to_email=body.to_email,
                    subject=body.subject,
                    body=body.body,
                    sender_email=sender,
                    sender_password=password,
                )
            except Exception as e:
                print(f"Email send failed: {e}")
        # If any required field is missing, skip sending and just generate the draft

        # Only save to database if required fields are present
        # Provide default subject and content if missing, so frontend always gets a visible draft
        # Build the draft object for both outreach and inbound
        draft_obj = {
            "outreach": {
                "subject": outreach_subject,
                "english_body": outreach_body_en,
                "spanish_body": outreach_body_es,
            },
            "inbound": {
                "subject": inbound_subject,
                "english_body": inbound_body_en,
                "spanish_body": inbound_body_es,
            },
            "company_name": company_name,
            "services": services,
                "to_email": company_email or body.to_email,
            "manual": body.manual,
            "sent_at": datetime.utcnow().isoformat(),
            "client_id": body.client_id
        }
        # Always save the email and log activity, even if some fields are missing
        client_id = body.client_id
        if not client_id:
            from database import ClientProfile
            # Try to find existing client by email
            existing_client = session.exec(select(ClientProfile).where(ClientProfile.email == body.to_email)).first() if hasattr(ClientProfile, 'email') else None
            if existing_client:
                client_id = existing_client.id
            else:
                # Create new client profile
                cp = ClientProfile(
                    companyName=draft_obj["company_name"] or "Unknown Company",
                    email=body.to_email or f"unknown_contact_{datetime.utcnow().timestamp()}@placeholder.com",
                    status="Active"
                )
                session.add(cp)
                session.commit()
                session.refresh(cp)
                client_id = cp.id
        # Save the outreach draft to DB, using placeholders if needed
        email_db_obj = {
            "to_email": body.to_email or f"unknown_contact_{datetime.utcnow().timestamp()}@placeholder.com",
            "subject": draft_obj["outreach"].get("subject") or "[No Subject]",
            "english_body": draft_obj["outreach"].get("english_body") or "[No Body]",
            "spanish_body": draft_obj["outreach"].get("spanish_body") or "[No Spanish Body]",
            "recommended_services": draft_obj.get("services") or "",
            "manual": body.manual,
            "draft_json": json.dumps(draft_obj),
            "sent_at": draft_obj["sent_at"],
            "client_id": client_id
        }
        sent_email = SentEmail(**email_db_obj)
        session.add(sent_email)
        session.commit()
        session.refresh(sent_email)

        # --- Log activity for this client ---
        from database import ActivityLog
        activity = ActivityLog(
            clientId=client_id,
            action="Email Generated",
            method="Email",
            content=f"Generated outreach email for {draft_obj.get('company_name') or '[Unknown Company]'} ({body.company_url or ''}) to {body.to_email or '[Unknown Email]'}",
            details=draft_obj["outreach"].get("subject") or "[No Subject]"
        )
        session.add(activity)
        session.commit()

        # Schedule LLM draft generation in the background if needed
        if background_tasks is not None:
            background_tasks.add_task(generate_llm_draft_task, sent_email.id, body.dict())

        return {"ok": True, "email_id": sent_email.id, "draft": draft_obj, "client_id": client_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Background task to update SentEmail with LLM-generated draft
def generate_llm_draft_task(sent_email_id, body_dict):
    import time
    import json
    from modules.llm_engine import analyze_content, generate_email as llm_generate_email
    from modules.scraper import scrape_website
    from database import Session, SentEmail, engine
    session = Session(engine)
    try:
        # Scrape and analyze
        text = scrape_website(body_dict.get("company_url", "")) if body_dict.get("company_url") else ""
        analysis = analyze_content(text) if text else {}
        llm_result = llm_generate_email(analysis, None)
        # Update SentEmail record
        sent_email = session.get(SentEmail, sent_email_id)
        if sent_email:
            sent_email.subject = llm_result.get("subject", sent_email.subject)
            sent_email.english_body = llm_result.get("english_body", sent_email.english_body)
            sent_email.spanish_body = llm_result.get("spanish_body", sent_email.spanish_body)
            sent_email.draft_json = json.dumps(llm_result)
            session.add(sent_email)
            session.commit()
    except Exception as e:
        print(f"LLM draft background task failed: {e}")
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard Stats
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/dashboard-stats")
def dashboard_stats(
    role: str = Query("Client"),
    email: str = Query(""),
    session: Session = Depends(get_session),
):
    if role == "Client":
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            return {"isClient": True}
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
        if not cp:
            return {"isClient": True}

        service_reqs = session.exec(
            select(ServiceRequest).where(ServiceRequest.client_id == cp.id)
        ).all()
        active_services = [
            r for r in service_reqs if r.status in ("Accepted", "In Progress")
        ]
        pending_quotes = [r for r in service_reqs if r.status == "Quoted"]

        # Resolve service names for active services and quotes
        def _resolve_service_name(service_id):
            if not service_id:
                return "Service"
            svc = session.get(ServiceCatalog, service_id)
            return svc.name if svc else "Service"

        # Milestones for this client
        milestones = session.exec(
            select(Milestone)
            .where(Milestone.client_id == cp.id)
            .order_by(Milestone.order, Milestone.created_at)
        ).all()

        # Invoices for this client
        invoices = session.exec(
            select(Invoice)
            .where(Invoice.client_id == cp.id)
            .order_by(Invoice.created_at.desc())
        ).all()

        # Files for this client
        files = session.exec(
            select(ClientFileUpload)
            .where(ClientFileUpload.client_id == cp.id)
            .order_by(ClientFileUpload.created_at.desc())
        ).all()

        # Recent activities for this client
        activities = session.exec(
            select(ActivityLog)
            .where(ActivityLog.clientId == cp.id)
            .order_by(ActivityLog.createdAt.desc())
            .limit(20)
        ).all()

        # Notifications for this user
        notifications = session.exec(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(10)
        ).all()

        # Proposals for this client
        proposals = session.exec(
            select(Proposal)
            .where(Proposal.client_id == cp.id)
            .order_by(Proposal.created_at.desc())
        ).all()

        # Projects for this client (clientIds is a JSON list)
        all_projects = session.exec(select(Project)).all()
        projects = [p for p in all_projects if cp.id in (p.clientIds or [])]

        # Invoice summary stats
        total_billed = sum(inv.total for inv in invoices)
        total_paid = sum(inv.total for inv in invoices if inv.status == "Paid")
        total_pending_inv = sum(inv.total for inv in invoices if inv.status in ("Sent", "Draft"))
        total_overdue = sum(inv.total for inv in invoices if inv.status == "Overdue")

        return {
            "isClient": True,
            "companyName": cp.companyName or "",
            "projectName": cp.projectName or "",
            "website": cp.websiteUrl or "",
            "status": cp.status,
            "seoStrategy": cp.seoStrategy or "",
            "recommended_services": cp.recommended_services or "",
            "targetKeywords": cp.targetKeywords or [],
            "nextMilestone": cp.nextMilestone or "",
            "nextMilestoneDate": cp.nextMilestoneDate or "",
            "active_services_list": [
                {"id": r.id, "service_id": r.service_id, "status": r.status, "service_name": _resolve_service_name(r.service_id)}
                for r in active_services
            ],
            "pending_quotes_list": [
                {
                    "id": r.id,
                    "service_id": r.service_id,
                    "quoted_amount": r.quoted_amount,
                    "quote_message": r.quote_message,
                    "service_name": _resolve_service_name(r.service_id),
                }
                for r in pending_quotes
            ],
            "pending_requests_count": len([r for r in service_reqs if r.status == "Pending"]),
            "milestones": [
                {
                    "id": m.id, "title": m.title, "description": m.description,
                    "due_date": m.due_date, "status": m.status, "order": m.order,
                    "created_at": m.created_at.isoformat(),
                }
                for m in milestones
            ],
            "invoices": [
                {
                    "id": inv.id, "invoice_number": inv.invoice_number,
                    "amount": inv.amount, "tax": inv.tax, "total": inv.total,
                    "status": inv.status, "due_date": inv.due_date,
                    "notes": inv.notes, "line_items": inv.line_items or [],
                    "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                    "created_at": inv.created_at.isoformat(),
                }
                for inv in invoices
            ],
            "invoice_summary": {
                "total_billed": total_billed,
                "total_paid": total_paid,
                "total_pending": total_pending_inv,
                "total_overdue": total_overdue,
            },
            "files": [
                {
                    "id": f.id, "filename": f.filename, "file_url": f.file_url,
                    "file_size": f.file_size, "mime_type": f.mime_type,
                    "description": f.description, "created_at": f.created_at.isoformat(),
                }
                for f in files
            ],
            "activities": [
                {
                    "id": a.id, "action": a.action, "method": a.method,
                    "content": a.content, "details": a.details,
                    "createdAt": a.createdAt.isoformat(),
                }
                for a in activities
            ],
            "notifications": [
                {
                    "id": n.id, "title": n.title, "message": n.message,
                    "type": n.type, "link": n.link, "is_read": n.is_read,
                    "created_at": n.created_at.isoformat(),
                }
                for n in notifications
            ],
            "unread_notifications_count": sum(1 for n in notifications if not n.is_read),
            "proposals": [
                {
                    "id": p.id, "title": p.title, "status": p.status,
                    "total_value": p.total_value, "valid_until": p.valid_until,
                    "created_at": p.created_at.isoformat(),
                }
                for p in proposals
            ],
            "projects": [
                {
                    "id": p.id, "name": p.name, "status": p.status,
                    "progress": p.progress,
                    "created_at": p.createdAt.isoformat(),
                }
                for p in projects
            ],
        }

    # Admin / Employee stats
    total_clients = len(session.exec(select(ClientProfile)).all())
    active_clients = len(
        session.exec(select(ClientProfile).where(ClientProfile.status == "Active")).all()
    )
    pending_clients = len(
        session.exec(select(ClientProfile).where(ClientProfile.status == "Pending")).all()
    )
    hold_clients = len(
        session.exec(select(ClientProfile).where(ClientProfile.status == "Hold")).all()
    )
    total_projects = len(session.exec(select(Project)).all())
    total_employees = len(
        session.exec(select(User).where(User.role == "Employee")).all()
    )
    total_interns = len(
        session.exec(select(User).where(User.role == "Intern")).all()
    )
    total_activities = len(session.exec(select(ActivityLog)).all())
    total_calls = len(session.exec(select(CallLog)).all())

    # Build real 7-day chart data from database
    labels = []
    activity_chart = []
    email_chart = []
    call_chart = []
    all_activities = session.exec(select(ActivityLog)).all()
    all_emails = session.exec(select(SentEmail)).all()
    all_calls_list = session.exec(select(CallLog)).all()
    total_emails_sent = len(all_emails)
    for i in range(6, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        labels.append(day.strftime("%b %d"))
        activity_chart.append(sum(1 for a in all_activities if a.createdAt and day_start <= a.createdAt < day_end))
        email_chart.append(sum(1 for e in all_emails if e.sent_at and day_start <= e.sent_at < day_end))
        call_chart.append(sum(1 for c in all_calls_list if c.createdAt and day_start <= c.createdAt < day_end))

    recent_activities = session.exec(
        select(ActivityLog).order_by(ActivityLog.createdAt.desc()).limit(10)
    ).all()

    return {
        "total": total_clients,
        "active": active_clients,
        "pending": pending_clients,
        "hold": hold_clients,
        "totalProjects": total_projects,
        "totalEmployees": total_employees,
        "totalInterns": total_interns,
        "totalActivities": total_activities,
        "totalCalls": total_calls,
        "totalEmailsSent": total_emails_sent,
        "chartLabels": labels,
        "activityChart": activity_chart,
        "emailChart": email_chart,
        "callChart": call_chart,
        "recentActivities": [
            {
                "id": a.id,
                "action": a.action,
                "method": a.method,
                "content": a.content,
                "createdAt": a.createdAt.isoformat() if a.createdAt else None,
            }
            for a in recent_activities
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Client Timeline (unified)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/clients/{client_id}/timeline")
def client_timeline(client_id: int, session: Session = Depends(get_session)):
    """Unified timeline: activities, emails, calls, invoices, milestones, files."""
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    events: list[dict] = []

    # Activities
    for a in session.exec(select(ActivityLog).where(ActivityLog.clientId == client_id)).all():
        events.append({
            "type": "activity", "id": a.id,
            "title": a.action or a.method or "Activity",
            "detail": a.content or "",
            "date": a.createdAt.isoformat() if a.createdAt else None,
        })

    # Emails
    for e in session.exec(select(SentEmail).where(SentEmail.client_id == client_id)).all():
        events.append({
            "type": "email", "id": e.id,
            "title": f"Email: {e.subject or 'No subject'}",
            "detail": e.to_email or "",
            "date": e.sent_at.isoformat() if e.sent_at else None,
        })

    # Calls
    for c in session.exec(select(CallLog).where(CallLog.client_id == client_id)).all():
        events.append({
            "type": "call", "id": c.id,
            "title": f"Call: {c.phone_number or 'Unknown'}",
            "detail": c.description or "",
            "date": c.createdAt.isoformat() if c.createdAt else None,
        })

    # Invoices
    for inv in session.exec(select(Invoice).where(Invoice.client_id == client_id)).all():
        events.append({
            "type": "invoice", "id": inv.id,
            "title": f"Invoice #{inv.invoice_number} — ${inv.total}",
            "detail": f"Status: {inv.status}",
            "date": inv.created_at.isoformat() if inv.created_at else None,
        })

    # Milestones
    for m in session.exec(select(Milestone).where(Milestone.client_id == client_id)).all():
        events.append({
            "type": "milestone", "id": m.id,
            "title": f"Milestone: {m.title}",
            "detail": f"Status: {m.status}",
            "date": m.created_at.isoformat() if m.created_at else None,
        })

    # Files
    for f in session.exec(select(ClientFileUpload).where(ClientFileUpload.client_id == client_id)).all():
        events.append({
            "type": "file", "id": f.id,
            "title": f"File: {f.filename}",
            "detail": f.description or "",
            "date": f.created_at.isoformat() if f.created_at else None,
        })

    # Sort newest first
    events.sort(key=lambda x: x["date"] or "", reverse=True)
    return {"timeline": events}


# ─────────────────────────────────────────────────────────────────────────────
# Global Search
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/search")
def global_search(q: str = Query("", min_length=1), session: Session = Depends(get_session)):
    results: list[dict] = []
    term = f"%{q}%"

    # Clients - search by company name, project name, or associated user email
    for c in session.exec(
        select(ClientProfile).where(
            (ClientProfile.companyName.ilike(term)) | 
            (ClientProfile.projectName.ilike(term)) |
            (ClientProfile.websiteUrl.ilike(term))
        ).limit(5)
    ).all():
        results.append({"type": "client", "id": c.id, "title": c.companyName or "Client", "sub": c.projectName or "", "link": f"/clients/{c.id}"})

    # Also search users (by email) and find their associated clients
    for u in session.exec(
        select(User).where((User.email.ilike(term)) | (User.name.ilike(term)))
    ).all():
        # Find clients linked to this user
        client_profile = session.exec(select(ClientProfile).where(ClientProfile.userId == u.id)).first()
        if client_profile:
            results.append({"type": "client", "id": client_profile.id, "title": client_profile.companyName or u.name or "Client", "sub": u.email or "", "link": f"/clients/{client_profile.id}"})

    # Projects
    for p in session.exec(select(Project).where(Project.name.ilike(term)).limit(5)).all():
        results.append({"type": "project", "id": p.id, "title": p.name, "sub": p.status or "", "link": f"/projects/{p.id}"})

    # Tasks
    for t in session.exec(select(Task).where(Task.title.ilike(term)).limit(5)).all():
        results.append({"type": "task", "id": t.id, "title": t.title, "sub": t.status or "", "link": "/tasks"})

    # Invoices
    for inv in session.exec(select(Invoice).where(Invoice.invoice_number.ilike(term)).limit(5)).all():
        results.append({"type": "invoice", "id": inv.id, "title": f"Invoice #{inv.invoice_number}", "sub": f"${inv.total} — {inv.status}", "link": "/invoices"})

    return {"results": results, "query": q}


# ─────────────────────────────────────────────────────────────────────────────
# Monitor Stats (real data)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/monitor-stats")
def monitor_stats(session: Session = Depends(get_session)):
    """Real aggregated stats for the monitor/analytics page."""
    # Total rankings tracked
    all_rankings = session.exec(select(KeywordRankEntry)).all()
    total_keywords = len(set(r.keyword for r in all_rankings))
    avg_position = round(sum(r.position for r in all_rankings if r.position) / max(len(all_rankings), 1), 1) if all_rankings else 0

    # Recent rankings for the table
    recent = session.exec(
        select(KeywordRankEntry).order_by(KeywordRankEntry.recorded_at.desc()).limit(20)
    ).all()
    # De-duplicate by keyword (keep latest)
    seen = set()
    keyword_rows = []
    for r in recent:
        if r.keyword not in seen:
            seen.add(r.keyword)
            keyword_rows.append({
                "keyword": r.keyword,
                "position": r.position,
                "url": r.url,
                "search_engine": r.search_engine,
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            })

    # Project completion stats
    projects = session.exec(select(Project)).all()
    completed_projects = len([p for p in projects if p.status == "Completed"])
    total_projects = len(projects)
    avg_progress = round(sum(p.progress or 0 for p in projects) / max(total_projects, 1))

    # Invoice revenue stats
    invoices = session.exec(select(Invoice)).all()
    total_revenue = sum(inv.total for inv in invoices)
    paid_revenue = sum(inv.total for inv in invoices if inv.status == "Paid")
    pending_revenue = sum(inv.total for inv in invoices if inv.status in ("Sent", "Draft"))

    # Weekly activity counts (last 10 weeks)
    weekly_activity = []
    for i in range(9, -1, -1):
        start = datetime.utcnow() - timedelta(weeks=i + 1)
        end = datetime.utcnow() - timedelta(weeks=i)
        count = len(session.exec(
            select(ActivityLog).where(ActivityLog.createdAt >= start, ActivityLog.createdAt < end)
        ).all())
        weekly_activity.append({"week": f"W{10 - i}", "count": count})

    return {
        "total_keywords": total_keywords,
        "avg_position": avg_position,
        "keyword_rows": keyword_rows,
        "total_projects": total_projects,
        "completed_projects": completed_projects,
        "avg_progress": avg_progress,
        "total_revenue": round(total_revenue, 2),
        "paid_revenue": round(paid_revenue, 2),
        "pending_revenue": round(pending_revenue, 2),
        "weekly_activity": weekly_activity,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Setup / Audit
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/setup/verify-domain")
def verify_domain(body: SetupDomainRequest):
    domain = re.sub(r"https?://", "", body.domain).strip("/")
    return {"domain": domain, "verified": True, "message": "Domain looks good"}


@app.post("/audit/trigger")
def trigger_audit(body: dict = {}, session: Session = Depends(get_session)):
    """Real SEO audit: fetches the domain, analyzes HTML for common SEO issues."""
    import httpx
    from bs4 import BeautifulSoup
    import time

    domain = body.get("domain") or body.get("email", "")
    # Try to resolve a client domain from email
    if "@" in domain:
        user = session.exec(select(User).where(User.email == domain)).first()
        if user:
            cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
            if cp and cp.websiteUrl:
                domain = cp.websiteUrl
    if not domain:
        return {"success": False, "message": "No domain to audit"}

    url = domain if domain.startswith("http") else f"https://{domain}"
    url = url.rstrip("/")

    issues = {}
    health = 100
    page_speed = 0
    issues_count = 0

    try:
        start = time.time()
        r = httpx.get(url, follow_redirects=True, timeout=15, headers={"User-Agent": "SerpHawk-Audit/1.0"})
        load_time = round(time.time() - start, 2)
        page_speed = max(10, min(100, int(100 - load_time * 15)))
        html = r.text
        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_tag = soup.find("title")
        title_text = title_tag.get_text(strip=True) if title_tag else ""
        if not title_text:
            issues["title_tag"] = "Missing — add a unique <title> tag"
            health -= 15
            issues_count += 1
        elif len(title_text) > 70:
            issues["title_tag"] = f"Too long ({len(title_text)} chars) — keep under 60-70"
            health -= 5
            issues_count += 1
        else:
            issues["title_tag"] = f"Pass — '{title_text[:50]}..." if len(title_text) > 50 else f"Pass — '{title_text}'"

        # Meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc_content = meta_desc["content"] if meta_desc and meta_desc.get("content") else ""
        if not desc_content:
            issues["meta_description"] = "Missing — add a 150-160 char meta description"
            health -= 10
            issues_count += 1
        elif len(desc_content) > 160:
            issues["meta_description"] = f"Too long ({len(desc_content)} chars)"
            health -= 3
            issues_count += 1
        else:
            issues["meta_description"] = "Pass"

        # H1
        h1s = soup.find_all("h1")
        if len(h1s) == 0:
            issues["h1_tag"] = "Missing — every page needs one H1"
            health -= 10
            issues_count += 1
        elif len(h1s) > 1:
            issues["h1_tag"] = f"Multiple H1s found ({len(h1s)}) — use only one"
            health -= 5
            issues_count += 1
        else:
            issues["h1_tag"] = f"Pass — '{h1s[0].get_text(strip=True)[:50]}'"

        # Images without alt
        imgs = soup.find_all("img")
        no_alt = [i for i in imgs if not i.get("alt")]
        if no_alt:
            issues["image_alt_tags"] = f"{len(no_alt)} of {len(imgs)} images missing alt text"
            health -= min(10, len(no_alt) * 2)
            issues_count += len(no_alt)
        else:
            issues["image_alt_tags"] = f"Pass — all {len(imgs)} images have alt text" if imgs else "No images found"

        # HTTPS
        if not url.startswith("https"):
            issues["https"] = "Not using HTTPS — critical security issue"
            health -= 15
            issues_count += 1
        else:
            issues["https"] = "Pass — HTTPS enabled"

        # Canonical
        canonical = soup.find("link", attrs={"rel": "canonical"})
        if not canonical:
            issues["canonical_tag"] = "Missing — add a canonical URL"
            health -= 5
            issues_count += 1
        else:
            issues["canonical_tag"] = "Pass"

        # Viewport
        viewport = soup.find("meta", attrs={"name": "viewport"})
        if not viewport:
            issues["mobile_viewport"] = "Missing — not mobile-friendly"
            health -= 10
            issues_count += 1
        else:
            issues["mobile_viewport"] = "Pass — viewport meta present"

        # Open Graph
        og = soup.find("meta", attrs={"property": "og:title"})
        if not og:
            issues["open_graph"] = "Missing OG tags — poor social sharing"
            health -= 3
            issues_count += 1
        else:
            issues["open_graph"] = "Pass"

        # Internal links count
        links = soup.find_all("a", href=True)
        internal = [l for l in links if l["href"].startswith("/") or domain.replace("https://", "").replace("http://", "") in l["href"]]
        issues["internal_links"] = f"{len(internal)} internal links found" if internal else "No internal links — poor for SEO"
        if not internal:
            health -= 5
            issues_count += 1

        health = max(0, min(100, health))

    except Exception as e:
        return {"success": True, "audit": {
            "health_score": 0, "page_speed_desktop": 0, "issues_count": 1,
            "tech_seo_issues": {"connection": f"Could not reach {url}: {str(e)}"},
            "domain": url, "load_time": 0,
        }}

    return {
        "success": True,
        "audit": {
            "health_score": health,
            "page_speed_desktop": page_speed,
            "issues_count": issues_count,
            "tech_seo_issues": issues,
            "domain": url,
            "load_time": load_time,
        },
    }


@app.get("/audit/export")
def export_audit_pdf(email: str = Query(""), domain: str = Query(""), session: Session = Depends(get_session)):
    """Generate PDF audit report."""
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    # Run a quick audit to get fresh data
    audit_result = trigger_audit({"domain": domain or email}, session)
    audit = audit_result.get("audit", {})

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=50, bottomMargin=40)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("AuditTitle", parent=styles["Title"], fontSize=22, textColor=colors.HexColor("#1e293b"))
    heading = ParagraphStyle("AuditH2", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#334155"), spaceBefore=20)
    normal = styles["Normal"]

    elements = []
    elements.append(Paragraph("SERP Hawk — SEO Audit Report", title_style))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(f"Domain: {audit.get('domain', domain or 'N/A')}", normal))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%B %d, %Y')}", normal))
    elements.append(Spacer(1, 20))

    # Summary table
    summary_data = [
        ["Health Score", f"{audit.get('health_score', 0)}/100"],
        ["Page Speed", f"{audit.get('page_speed_desktop', 0)}/100"],
        ["Issues Found", str(audit.get('issues_count', 0))],
        ["Load Time", f"{audit.get('load_time', 0)}s"],
    ]
    t = Table(summary_data, colWidths=[200, 250])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))

    # Technical findings
    elements.append(Paragraph("Technical SEO Findings", heading))
    for key, val in audit.get("tech_seo_issues", {}).items():
        label = key.replace("_", " ").title()
        status = "PASS" if "Pass" in str(val) else "ISSUE"
        color = "#059669" if status == "PASS" else "#dc2626"
        elements.append(Paragraph(f'<font color="{color}"><b>[{status}]</b></font> {label}: {val}', normal))
        elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 30))
    elements.append(Paragraph("— Generated by SERP Hawk | Team DaPros", ParagraphStyle("Footer", parent=normal, fontSize=9, textColor=colors.grey)))

    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="serphawk-audit-{(domain or "report").replace("https://","").replace("/","_")}.pdf"'
    })


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "app": "SerpHawk CRM API", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Tasks & Kanban Board
# ─────────────────────────────────────────────────────────────────────────────
def _task_dict(t: Task, session: Session) -> dict:
    assignee = session.get(User, t.assigned_to) if t.assigned_to else None
    creator = session.get(User, t.created_by) if t.created_by else None
    client = session.get(ClientProfile, t.client_id) if t.client_id else None
    client_user = session.get(User, client.userId) if client and client.userId else None
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date,
        "client_id": t.client_id,
        "client_name": client_user.name if client_user else (client.companyName if client else None),
        "project_id": t.project_id,
        "assigned_to": t.assigned_to,
        "assignee_name": assignee.name if assignee else None,
        "created_by": t.created_by,
        "creator_name": creator.name if creator else None,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


@app.get("/tasks")
def list_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    q = select(Task).order_by(Task.created_at.desc())
    if status:
        q = q.where(Task.status == status)
    if assigned_to:
        q = q.where(Task.assigned_to == assigned_to)
    if client_id:
        q = q.where(Task.client_id == client_id)
    if project_id:
        q = q.where(Task.project_id == project_id)
    tasks = session.exec(q).all()
    return {"tasks": [_task_dict(t, session) for t in tasks]}


@app.post("/tasks")
def create_task(body: TaskCreateRequest, session: Session = Depends(get_session)):
    t = Task(**body.model_dump())
    session.add(t)
    session.commit()
    session.refresh(t)
    # Notify assigned user
    if t.assigned_to:
        notif = Notification(
            user_id=t.assigned_to,
            title="New Task Assigned",
            message=f"You have been assigned: {t.title}",
            type="info",
            link="/tasks",
        )
        session.add(notif)
        session.commit()
    return {"task": _task_dict(t, session)}


@app.get("/tasks/{task_id}")
def get_task(task_id: int, session: Session = Depends(get_session)):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    comments = session.exec(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at)
    ).all()
    result = _task_dict(t, session)
    result["comments"] = [
        {
            "id": c.id,
            "content": c.content,
            "author_id": c.author_id,
            "author_name": (lambda u: u.name if u else "Unknown")(session.get(User, c.author_id)),
            "created_at": c.created_at.isoformat(),
        }
        for c in comments
    ]
    return {"task": result}


@app.put("/tasks/{task_id}")
def update_task(task_id: int, body: TaskUpdateRequest, session: Session = Depends(get_session)):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(t, field, val)
    t.updated_at = datetime.utcnow()
    session.add(t)
    session.commit()
    session.refresh(t)
    return {"task": _task_dict(t, session)}


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, session: Session = Depends(get_session)):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(t)
    session.commit()
    return {"ok": True}


@app.post("/tasks/{task_id}/comments")
def add_task_comment(
    task_id: int, body: TaskCommentCreateRequest, session: Session = Depends(get_session)
):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    c = TaskComment(task_id=task_id, author_id=body.author_id, content=body.content)
    session.add(c)
    session.commit()
    session.refresh(c)
    author = session.get(User, c.author_id) if c.author_id else None
    return {
        "id": c.id,
        "content": c.content,
        "author_id": c.author_id,
        "author_name": author.name if author else "Unknown",
        "created_at": c.created_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Invoices & Payments
# ─────────────────────────────────────────────────────────────────────────────
def _invoice_dict(inv: Invoice, session: Session) -> dict:
    cp = session.get(ClientProfile, inv.client_id) if inv.client_id else None
    u = session.get(User, cp.userId) if cp and cp.userId else None
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "client_id": inv.client_id,
        "client_name": u.name if u else (cp.companyName if cp else None),
        "client_email": u.email if u else None,
        "service_request_id": inv.service_request_id,
        "amount": inv.amount,
        "tax": inv.tax,
        "total": inv.total,
        "status": inv.status,
        "due_date": inv.due_date,
        "notes": inv.notes,
        "line_items": inv.line_items or [],
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "created_at": inv.created_at.isoformat(),
        "updated_at": inv.updated_at.isoformat(),
    }


def _generate_invoice_number(session: Session) -> str:
    count = len(session.exec(select(Invoice)).all())
    return f"INV-{datetime.utcnow().year}-{str(count + 1).zfill(4)}"


@app.get("/invoices")
def list_invoices(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(Invoice).order_by(Invoice.created_at.desc())
    if client_id:
        q = q.where(Invoice.client_id == client_id)
    if status:
        q = q.where(Invoice.status == status)
    invoices = session.exec(q).all()
    return {"invoices": [_invoice_dict(i, session) for i in invoices]}


@app.post("/invoices")
def create_invoice(body: InvoiceCreateRequest, session: Session = Depends(get_session)):
    total = round(body.amount + body.tax, 2)
    inv = Invoice(
        invoice_number=_generate_invoice_number(session),
        client_id=body.client_id,
        service_request_id=body.service_request_id,
        amount=body.amount,
        tax=body.tax,
        total=total,
        due_date=body.due_date,
        notes=body.notes,
        line_items=body.line_items or [],
    )
    session.add(inv)
    session.commit()
    session.refresh(inv)

    # --- Add invoice to client my-files ---
    from database import ClientFileUpload
    invoice_filename = f"Invoice_{inv.invoice_number}.json"
    invoice_file_url = f"/api/invoices/{inv.id}/download"  # You may want to implement this endpoint to serve PDF/JSON
    file_entry = ClientFileUpload(
        client_id=inv.client_id,
        uploaded_by=None,  # Admin
        filename=invoice_filename,
        file_url=invoice_file_url,
        file_size=None,
        mime_type="application/json",
        description=f"Invoice {inv.invoice_number} generated for client.",
    )
    session.add(file_entry)
    session.commit()

    # Email notification to client
    if inv.client_id:
        cp = session.get(ClientProfile, inv.client_id)
        if cp and cp.userId:
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"New Invoice #{inv.invoice_number} from DaPros",
                    f"<h2>New Invoice</h2><p>Hi {cp.companyName or 'there'},</p><p>A new invoice <strong>#{inv.invoice_number}</strong> for <strong>${inv.total}</strong> has been created.</p><p>Please log in to your dashboard to view details.</p><p>— Team DaPros</p>",
                )
            notif = Notification(
                user_id=cp.userId,
                title="New Invoice Created",
                message=f"Invoice #{inv.invoice_number} for ${inv.total} is ready.",
                type="info",
                link="/invoices",
            )
            session.add(notif)
            session.commit()

    return {"invoice": _invoice_dict(inv, session)}


@app.post("/invoices/from-quote/{request_id}")
def invoice_from_quote(request_id: int, session: Session = Depends(get_session)):
    sr = session.get(ServiceRequest, request_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    if not sr.quoted_amount:
        raise HTTPException(status_code=400, detail="No quoted amount on this request")
    svc = session.get(ServiceCatalog, sr.service_id)
    inv = Invoice(
        invoice_number=_generate_invoice_number(session),
        client_id=sr.client_id,
        service_request_id=sr.id,
        amount=sr.quoted_amount,
        tax=0.0,
        total=sr.quoted_amount,
        line_items=[{"description": svc.name if svc else "Service", "amount": sr.quoted_amount}],
    )
    session.add(inv)
    session.commit()
    session.refresh(inv)
    # Notify client
    cp = session.get(ClientProfile, sr.client_id)
    if cp and cp.userId:
        notif = Notification(
            user_id=cp.userId,
            title="New Invoice Generated",
            message=f"Invoice {inv.invoice_number} for ${inv.total:.2f} has been created.",
            type="info",
            link="/invoices",
        )
        session.add(notif)
        session.commit()
    return {"invoice": _invoice_dict(inv, session)}


@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, session: Session = Depends(get_session)):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"invoice": _invoice_dict(inv, session)}


@app.put("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: int, body: InvoiceUpdateRequest, session: Session = Depends(get_session)
):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(inv, field, val)
    if "amount" in updates or "tax" in updates:
        inv.total = round((inv.amount or 0) + (inv.tax or 0), 2)
    if updates.get("status") == "Paid":
        inv.paid_at = datetime.utcnow()
    inv.updated_at = datetime.utcnow()
    session.add(inv)
    session.commit()
    session.refresh(inv)

    # Notify client when invoice is sent
    if updates.get("status") == "Sent" and inv.client_id:
        cp = session.get(ClientProfile, inv.client_id)
        if cp and cp.userId:
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"Invoice #{inv.invoice_number} Sent — DaPros",
                    f"<h2>Invoice Ready for Payment</h2><p>Hi {cp.companyName or 'there'},</p><p>Invoice <strong>#{inv.invoice_number}</strong> for <strong>${inv.total}</strong> has been sent to you.</p><p>Due date: {inv.due_date or 'TBD'}</p><p>— Team DaPros</p>",
                )

    return {"invoice": _invoice_dict(inv, session)}


@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, session: Session = Depends(get_session)):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    session.delete(inv)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/notifications/{user_id}")
def get_notifications(
    user_id: int,
    unread_only: bool = False,
    session: Session = Depends(get_session),
):
    q = select(Notification).where(Notification.user_id == user_id).order_by(
        Notification.created_at.desc()
    )
    if unread_only:
        q = q.where(Notification.is_read == False)
    notifs = session.exec(q).all()
    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ],
        "unread_count": sum(1 for n in notifs if not n.is_read),
    }


@app.post("/notifications")
def create_notification(body: NotificationCreateRequest, session: Session = Depends(get_session)):
    n = Notification(**body.model_dump())
    session.add(n)
    session.commit()
    session.refresh(n)
    return {"id": n.id, "title": n.title}


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, session: Session = Depends(get_session)):
    n = session.get(Notification, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    session.add(n)
    session.commit()
    return {"ok": True}


@app.put("/notifications/mark-all-read/{user_id}")
def mark_all_read(user_id: int, session: Session = Depends(get_session)):
    notifs = session.exec(
        select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
    ).all()
    for n in notifs:
        n.is_read = True
        session.add(n)
    session.commit()
    return {"ok": True, "marked": len(notifs)}


# ─────────────────────────────────────────────────────────────────────────────
# Milestones
# ─────────────────────────────────────────────────────────────────────────────
def _milestone_dict(m: Milestone) -> dict:
    return {
        "id": m.id,
        "title": m.title,
        "description": m.description,
        "project_id": m.project_id,
        "client_id": m.client_id,
        "due_date": m.due_date,
        "status": m.status,
        "order": m.order,
        "created_at": m.created_at.isoformat(),
    }


@app.get("/milestones")
def list_milestones(
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    q = select(Milestone).order_by(Milestone.order, Milestone.created_at)
    if client_id:
        q = q.where(Milestone.client_id == client_id)
    if project_id:
        q = q.where(Milestone.project_id == project_id)
    milestones = session.exec(q).all()
    return {"milestones": [_milestone_dict(m) for m in milestones]}


@app.post("/milestones")
def create_milestone(body: MilestoneCreateRequest, session: Session = Depends(get_session)):
    m = Milestone(**body.model_dump())
    session.add(m)
    session.commit()
    session.refresh(m)
    return {"milestone": _milestone_dict(m)}


@app.put("/milestones/{milestone_id}")
def update_milestone(
    milestone_id: int, body: MilestoneUpdateRequest, session: Session = Depends(get_session)
):
    m = session.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(m, field, val)
    session.add(m)
    session.commit()
    session.refresh(m)

    # Notify client when milestone is achieved
    if body.status == "Achieved" and m.client_id:
        cp = session.get(ClientProfile, m.client_id)
        if cp and cp.userId:
            notif = Notification(
                user_id=cp.userId,
                title="Milestone Achieved! 🎉",
                message=f"'{m.title}' has been marked as achieved.",
                type="success",
                link="/milestones",
            )
            session.add(notif)
            session.commit()
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"Milestone Achieved: {m.title} — DaPros",
                    f"<h2>🎉 Milestone Achieved!</h2><p>Hi {cp.companyName or 'there'},</p><p>Great news! The milestone <strong>{m.title}</strong> has been completed.</p><p>Log in to see your progress.</p><p>— Team DaPros</p>",
                )

    return {"milestone": _milestone_dict(m)}


@app.delete("/milestones/{milestone_id}")
def delete_milestone(milestone_id: int, session: Session = Depends(get_session)):
    m = session.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    session.delete(m)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# NPS Surveys
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/nps")
def list_nps_surveys(client_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(NPSSurvey).order_by(NPSSurvey.created_at.desc())
    if client_id:
        q = q.where(NPSSurvey.client_id == client_id)
    surveys = session.exec(q).all()
    return {
        "surveys": [
            {
                "id": s.id,
                "client_id": s.client_id,
                "score": s.score,
                "feedback": s.feedback,
                "triggered_by": s.triggered_by,
                "responded_at": s.responded_at.isoformat() if s.responded_at else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in surveys
        ]
    }


@app.post("/nps/trigger/{client_id}")
def trigger_nps(
    client_id: int,
    triggered_by: str = "manual",
    session: Session = Depends(get_session),
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    s = NPSSurvey(client_id=client_id, triggered_by=triggered_by)
    session.add(s)
    session.commit()
    session.refresh(s)
    # Notify client
    if cp.userId:
        notif = Notification(
            user_id=cp.userId,
            title="Share Your Feedback",
            message="We'd love to know how we're doing! Please rate your experience.",
            type="info",
            link=f"/survey/{s.id}",
        )
        session.add(notif)
        session.commit()
    return {"survey_id": s.id}


@app.post("/nps/{survey_id}/respond")
def respond_nps(survey_id: int, body: NPSRespondRequest, session: Session = Depends(get_session)):
    s = session.get(NPSSurvey, survey_id)
    if not s:
        raise HTTPException(status_code=404, detail="Survey not found")
    s.score = body.score
    s.feedback = body.feedback
    s.responded_at = datetime.utcnow()
    session.add(s)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Proposals & Contracts
# ─────────────────────────────────────────────────────────────────────────────
def _proposal_dict(p: Proposal, session: Session) -> dict:
    cp = session.get(ClientProfile, p.client_id) if p.client_id else None
    u = session.get(User, cp.userId) if cp and cp.userId else None
    creator = session.get(User, p.created_by) if p.created_by else None
    return {
        "id": p.id,
        "title": p.title,
        "client_id": p.client_id,
        "client_name": u.name if u else (cp.companyName if cp else None),
        "service_request_id": p.service_request_id,
        "content": p.content,
        "status": p.status,
        "valid_until": p.valid_until,
        "total_value": p.total_value,
        "signed_at": p.signed_at.isoformat() if p.signed_at else None,
        "created_by": p.created_by,
        "creator_name": creator.name if creator else None,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


@app.get("/proposals")
def list_proposals(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(Proposal).order_by(Proposal.created_at.desc())
    if client_id:
        q = q.where(Proposal.client_id == client_id)
    if status:
        q = q.where(Proposal.status == status)
    proposals = session.exec(q).all()
    return {"proposals": [_proposal_dict(p, session) for p in proposals]}


@app.post("/proposals")
def create_proposal(body: ProposalCreateRequest, session: Session = Depends(get_session)):
    p = Proposal(**body.model_dump())
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"proposal": _proposal_dict(p, session)}


@app.get("/proposals/{proposal_id}")
def get_proposal(proposal_id: int, session: Session = Depends(get_session)):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"proposal": _proposal_dict(p, session)}


@app.put("/proposals/{proposal_id}")
def update_proposal(
    proposal_id: int, body: ProposalUpdateRequest, session: Session = Depends(get_session)
):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    if body.status == "Accepted":
        p.signed_at = datetime.utcnow()
    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    # Notify client when proposal is sent
    if body.status == "Sent" and p.client_id:
        cp = session.get(ClientProfile, p.client_id)
        if cp and cp.userId:
            notif = Notification(
                user_id=cp.userId,
                title="New Proposal Ready",
                message=f"A proposal '{p.title}' has been sent for your review.",
                type="info",
                link=f"/proposals/{p.id}",
            )
            session.add(notif)
            session.commit()
            # Email notification
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"New Proposal: {p.title} — DaPros",
                    f"<h2>Proposal Ready for Review</h2><p>Hi {cp.companyName or 'there'},</p><p>A new proposal <strong>{p.title}</strong> has been sent for your review.</p><p>Please log in to your dashboard to accept or decline.</p><p>— Team DaPros</p>",
                )
    # Notify admins when client responds to a proposal
    if body.status in ("Accepted", "Rejected", "Demo Requested") and p.client_id:
        cp = session.get(ClientProfile, p.client_id)
        client_name = cp.companyName if cp else f"Client #{p.client_id}"
        status_label = body.status.lower()
        admins = session.exec(select(User).where(User.role == "Admin")).all()
        for admin in admins:
            notif = Notification(
                user_id=admin.id,
                title=f"Proposal {body.status}",
                message=f"{client_name} has {status_label} the proposal '{p.title}'.",
                type="success" if body.status == "Accepted" else ("warning" if body.status == "Demo Requested" else "info"),
                link="/proposals",
            )
            session.add(notif)
        session.commit()
    return {"proposal": _proposal_dict(p, session)}


@app.delete("/proposals/{proposal_id}")
def delete_proposal(proposal_id: int, session: Session = Depends(get_session)):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Client File Uploads
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/clients/{client_id}/files")
def list_client_files(client_id: int, session: Session = Depends(get_session)):
    files = session.exec(
        select(ClientFileUpload)
        .where(ClientFileUpload.client_id == client_id)
        .order_by(ClientFileUpload.created_at.desc())
    ).all()
    return {
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "file_url": f.file_url,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "description": f.description,
                "uploaded_by": f.uploaded_by,
                "created_at": f.created_at.isoformat(),
            }
            for f in files
        ]
    }


import uuid as _uuid

@app.post("/upload-file")
async def upload_file_to_server(
    file: UploadFile = File(...),
    client_id: int = Query(...),
    uploaded_by: Optional[int] = Query(None),
    description: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """Upload a real file from device, save to static/uploads/, create DB record."""
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    # Sanitize filename and make unique
    safe_name = re.sub(r'[^\w.\-]', '_', file.filename or "file")
    unique_name = f"{_uuid.uuid4().hex[:8]}_{safe_name}"
    upload_dir = os.path.join("static", "uploads")
    file_path = os.path.join(upload_dir, unique_name)

    contents = await file.read()
    with open(file_path, "wb") as fh:
        fh.write(contents)

    file_url = f"/static/uploads/{unique_name}"
    file_size = len(contents)

    record = ClientFileUpload(
        client_id=client_id,
        uploaded_by=uploaded_by,
        filename=file.filename or safe_name,
        file_url=file_url,
        file_size=file_size,
        mime_type=file.content_type,
        description=description,
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "filename": record.filename,
        "file_url": file_url,
        "file_size": file_size,
        "mime_type": record.mime_type,
        "created_at": record.created_at.isoformat(),
    }


@app.post("/clients/{client_id}/files")
def upload_client_file(
    client_id: int, body: FileUploadRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    f = ClientFileUpload(
        client_id=client_id,
        uploaded_by=body.uploaded_by,
        filename=body.filename,
        file_url=body.file_url,
        file_size=body.file_size,
        mime_type=body.mime_type,
        description=body.description,
    )
    session.add(f)
    session.commit()
    session.refresh(f)
    return {
        "id": f.id,
        "filename": f.filename,
        "file_url": f.file_url,
        "created_at": f.created_at.isoformat(),
    }


@app.delete("/files/{file_id}")
def delete_file(file_id: int, session: Session = Depends(get_session)):
    f = session.get(ClientFileUpload, file_id)
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    session.delete(f)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Keyword Rank Tracker
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/rankings")
def list_rankings(
    client_id: Optional[int] = None,
    keyword: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(KeywordRankEntry).order_by(KeywordRankEntry.recorded_at.desc())
    if client_id:
        q = q.where(KeywordRankEntry.client_id == client_id)
    if keyword:
        q = q.where(KeywordRankEntry.keyword.ilike(f"%{keyword}%"))
    entries = session.exec(q).all()
    return {
        "rankings": [
            {
                "id": e.id,
                "client_id": e.client_id,
                "keyword": e.keyword,
                "position": e.position,
                "url": e.url,
                "search_engine": e.search_engine,
                "notes": e.notes,
                "recorded_at": e.recorded_at.isoformat(),
                "recorded_by": e.recorded_by,
            }
            for e in entries
        ]
    }


@app.post("/rankings")
def add_ranking(body: KeywordRankRequest, session: Session = Depends(get_session)):
    e = KeywordRankEntry(**body.model_dump())
    session.add(e)
    session.commit()
    session.refresh(e)
    return {
        "id": e.id,
        "keyword": e.keyword,
        "position": e.position,
        "recorded_at": e.recorded_at.isoformat(),
    }


@app.get("/rankings/history/{client_id}/{keyword}")
def ranking_history(client_id: int, keyword: str, session: Session = Depends(get_session)):
    entries = session.exec(
        select(KeywordRankEntry)
        .where(
            KeywordRankEntry.client_id == client_id,
            KeywordRankEntry.keyword == keyword,
        )
        .order_by(KeywordRankEntry.recorded_at)
    ).all()
    return {
        "keyword": keyword,
        "history": [
            {"position": e.position, "recorded_at": e.recorded_at.isoformat()}
            for e in entries
        ],
    }


@app.delete("/rankings/{entry_id}")
def delete_ranking(entry_id: int, session: Session = Depends(get_session)):
    e = session.get(KeywordRankEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Ranking entry not found")
    session.delete(e)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# PDF Generation — Invoices & Proposals
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/invoices/{invoice_id}/pdf")
def invoice_pdf(invoice_id: int, session: Session = Depends(get_session)):
    """Generate a professional PDF for an invoice."""
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    client = session.get(ClientProfile, inv.client_id) if inv.client_id else None
    client_name = ""
    if client:
        user = session.get(User, client.userId) if client.userId else None
        client_name = client.companyName or (user.name if user else f"Client #{client.id}")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=50, bottomMargin=40)
    styles = getSampleStyleSheet()
    title_s = ParagraphStyle("ITitle", parent=styles["Title"], fontSize=24, textColor=colors.HexColor("#1e293b"))
    h2 = ParagraphStyle("IH2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#334155"), spaceBefore=18)
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=9, textColor=colors.grey)

    els = []
    els.append(Paragraph("INVOICE", title_s))
    els.append(Spacer(1, 6))
    els.append(Paragraph(f"<b>{inv.invoice_number}</b>", ParagraphStyle("Num", parent=normal, fontSize=14, textColor=colors.HexColor("#4f46e5"))))
    els.append(Spacer(1, 12))

    # Info table
    info = [
        ["Bill To:", client_name or "—"],
        ["Date:", inv.created_at.strftime("%B %d, %Y") if inv.created_at else "—"],
        ["Due Date:", inv.due_date or "—"],
        ["Status:", inv.status],
    ]
    it = Table(info, colWidths=[100, 350])
    it.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
    ]))
    els.append(it)
    els.append(Spacer(1, 18))

    # Line items
    els.append(Paragraph("Line Items", h2))
    items_data = [["#", "Description", "Amount"]]
    for idx, li in enumerate(inv.line_items or [], 1):
        items_data.append([str(idx), li.get("description", ""), f"${float(li.get('amount', 0)):.2f}"])
    items_data.append(["", "Subtotal", f"${inv.amount:.2f}"])
    items_data.append(["", "Tax", f"${inv.tax:.2f}"])
    items_data.append(["", "TOTAL", f"${inv.total:.2f}"])

    lt = Table(items_data, colWidths=[40, 310, 100])
    lt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
        ("LINEABOVE", (0, -3), (-1, -3), 1, colors.HexColor("#cbd5e1")),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, colors.HexColor("#1e293b")),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
    ]))
    els.append(lt)

    if inv.notes:
        els.append(Spacer(1, 14))
        els.append(Paragraph("Notes", h2))
        els.append(Paragraph(inv.notes, normal))

    els.append(Spacer(1, 30))
    els.append(Paragraph("— SERP Hawk | Team DaPros", small))

    doc.build(els)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{inv.invoice_number}.pdf"'
    })


@app.get("/proposals/{proposal_id}/pdf")
def proposal_pdf(proposal_id: int, session: Session = Depends(get_session)):
    """Generate a professional PDF for a proposal."""
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    prop = session.get(Proposal, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")
    client = session.get(ClientProfile, prop.client_id) if prop.client_id else None
    client_name = ""
    if client:
        user = session.get(User, client.userId) if client.userId else None
        client_name = client.companyName or (user.name if user else f"Client #{client.id}")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=50, bottomMargin=40)
    styles = getSampleStyleSheet()
    title_s = ParagraphStyle("PTitle", parent=styles["Title"], fontSize=22, textColor=colors.HexColor("#1e293b"))
    h2 = ParagraphStyle("PH2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#334155"), spaceBefore=18)
    normal = styles["Normal"]
    small = ParagraphStyle("PSmall", parent=normal, fontSize=9, textColor=colors.grey)

    els = []
    els.append(Paragraph("PROPOSAL", title_s))
    els.append(Spacer(1, 10))

    info = [
        ["Title:", prop.title],
        ["Client:", client_name or "—"],
        ["Status:", prop.status],
        ["Value:", f"${prop.total_value:,.2f}" if prop.total_value else "—"],
        ["Valid Until:", prop.valid_until or "—"],
        ["Created:", prop.created_at.strftime("%B %d, %Y") if prop.created_at else "—"],
    ]
    it = Table(info, colWidths=[100, 350])
    it.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
    ]))
    els.append(it)
    els.append(Spacer(1, 18))

    if prop.content:
        els.append(Paragraph("Proposal Details", h2))
        for para in prop.content.split("\\n"):
            if para.strip():
                els.append(Paragraph(para.strip(), normal))
                els.append(Spacer(1, 4))

    els.append(Spacer(1, 30))
    els.append(Paragraph("— SERP Hawk | Team DaPros", small))

    doc.build(els)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="proposal-{prop.id}.pdf"'
    })


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Real-Time Chat
# ─────────────────────────────────────────────────────────────────────────────
import json as _json

class ConnectionManager:
    """Keeps track of active WebSocket connections per thread."""
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}  # thread_id -> list of ws

    async def connect(self, thread_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(thread_id, []).append(ws)

    def disconnect(self, thread_id: int, ws: WebSocket):
        conns = self.active.get(thread_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, thread_id: int, data: dict, exclude: WebSocket | None = None):
        for ws in self.active.get(thread_id, []):
            if ws is not exclude:
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

ws_manager = ConnectionManager()

@app.websocket("/ws/chat/{thread_id}")
async def ws_chat(websocket: WebSocket, thread_id: int):
    await ws_manager.connect(thread_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = _json.loads(raw)
            action = data.get("action")

            if action == "message":
                # Save message to DB
                with Session(engine) as session:
                    msg = ChatMessage(
                        thread_id=thread_id,
                        sender_id=data["sender_id"],
                        content=data["content"],
                    )
                    session.add(msg)
                    session.commit()
                    session.refresh(msg)
                    sender = session.get(User, msg.sender_id)
                    payload = {
                        "type": "new_message",
                        "message": {
                            "id": msg.id,
                            "sender": (sender.name or sender.email) if sender else "Unknown",
                            "sender_id": msg.sender_id,
                            "content": msg.content,
                            "timestamp": msg.timestamp.isoformat(),
                            "is_read": False,
                        },
                    }
                await ws_manager.broadcast(thread_id, payload)

            elif action == "typing":
                await ws_manager.broadcast(
                    thread_id,
                    {"type": "typing", "user_id": data.get("user_id"), "user_name": data.get("user_name")},
                    exclude=websocket,
                )

            elif action == "stop_typing":
                await ws_manager.broadcast(
                    thread_id,
                    {"type": "stop_typing", "user_id": data.get("user_id")},
                    exclude=websocket,
                )

            elif action == "read_receipt":
                msg_ids = data.get("message_ids", [])
                if msg_ids:
                    with Session(engine) as session:
                        for mid in msg_ids:
                            m = session.get(ChatMessage, mid)
                            if m and not m.is_read and m.sender_id != data.get("user_id"):
                                m.is_read = True
                                m.read_at = datetime.utcnow()
                                session.add(m)
                        session.commit()
                    await ws_manager.broadcast(
                        thread_id,
                        {"type": "read_receipt", "message_ids": msg_ids, "read_by": data.get("user_id")},
                        exclude=websocket,
                    )

    except WebSocketDisconnect:
        ws_manager.disconnect(thread_id, websocket)
    except Exception:
        ws_manager.disconnect(thread_id, websocket)


# ─────────────────────────────────────────────────────────────────────────────
# Password Change
# ─────────────────────────────────────────────────────────────────────────────
class PasswordChangeRequest(BaseModel):
    user_id: int
    current_password: str
    new_password: str

@app.post("/change-password")
def change_password(body: PasswordChangeRequest, session: Session = Depends(get_session)):
    user = session.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not (_check_password(body.current_password, user.password) or body.current_password == user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user.password = _hash_password(body.new_password)
    user.updatedAt = datetime.utcnow()
    session.add(user)
    session.commit()
    return {"ok": True, "message": "Password updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Webhooks / Zapier Integration
# ─────────────────────────────────────────────────────────────────────────────
import secrets as _secrets

# In-memory webhook store (in production, use a DB table)
_webhooks: Dict[str, dict] = {}  # id -> {url, events, secret, created_at, name}

class WebhookRegisterRequest(BaseModel):
    url: str
    events: List[str]   # e.g. ["client.created", "invoice.paid", "message.sent"]
    name: Optional[str] = None

@app.post("/webhooks")
def register_webhook(body: WebhookRegisterRequest):
    valid_events = [
        "client.created", "client.updated", "client.deleted",
        "invoice.created", "invoice.paid", "invoice.overdue",
        "message.sent", "task.created", "task.completed",
        "proposal.sent", "proposal.accepted", "proposal.rejected",
        "service.requested", "service.quoted", "service.accepted",
    ]
    for ev in body.events:
        if ev not in valid_events:
            raise HTTPException(status_code=400, detail=f"Invalid event: {ev}. Valid events: {valid_events}")
    wh_id = _secrets.token_urlsafe(16)
    wh_secret = _secrets.token_urlsafe(32)
    _webhooks[wh_id] = {
        "id": wh_id,
        "url": str(body.url),
        "events": body.events,
        "secret": wh_secret,
        "name": body.name or "Unnamed Webhook",
        "created_at": datetime.utcnow().isoformat(),
    }
    return {"webhook_id": wh_id, "secret": wh_secret, "events": body.events}

@app.get("/webhooks")
def list_webhooks():
    return {"webhooks": [
        {k: v for k, v in wh.items() if k != "secret"}
        for wh in _webhooks.values()
    ]}

@app.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str):
    if webhook_id not in _webhooks:
        raise HTTPException(status_code=404, detail="Webhook not found")
    del _webhooks[webhook_id]
    return {"ok": True}

import httpx as _httpx
import hmac as _hmac
import hashlib as _hashlib_hmac

async def _fire_webhooks(event: str, payload: dict):
    """Fire all registered webhooks for an event. Non-blocking, best-effort."""
    body_str = _json.dumps(payload)
    for wh in _webhooks.values():
        if event in wh["events"]:
            sig = _hmac.new(wh["secret"].encode(), body_str.encode(), _hashlib_hmac.sha256).hexdigest()
            try:
                async with _httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        wh["url"],
                        content=body_str,
                        headers={
                            "Content-Type": "application/json",
                            "X-Webhook-Event": event,
                            "X-Webhook-Signature": f"sha256={sig}",
                        },
                    )
            except Exception as e:
                print(f"[Webhook fire failed] {event} -> {wh['url']}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Competitor Analysis (Real Data)
# ─────────────────────────────────────────────────────────────────────────────
class CompetitorAddRequest(BaseModel):
    client_id: int
    competitor_domain: str

@app.post("/competitors/analyze")
async def analyze_competitor(body: CompetitorAddRequest, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    client = session.get(ClientProfile, body.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get client keywords for gap analysis
    client_keywords = client.targetKeywords or []
    client_website = client.websiteUrl or ""

    # Scrape competitor site
    from modules.scraper import scrape_website
    competitor_content = await scrape_website(body.competitor_domain)
    if competitor_content.startswith("ERROR"):
        competitor_content = f"Could not scrape {body.competitor_domain}"

    # Scrape client site for comparison
    client_content = ""
    if client_website:
        client_content = await scrape_website(client_website)
        if client_content.startswith("ERROR"):
            client_content = ""

    # Use LLM to analyze competitor vs client
    from modules.llm_engine import get_openai_client
    prompt = f"""Analyze the competitive landscape between a client and their competitor.

CLIENT INFO:
- Website: {client_website}
- Target Keywords: {', '.join(client_keywords) if client_keywords else 'Not specified'}
- Site Content Summary: {client_content[:3000] if client_content else 'Not available'}

COMPETITOR INFO:
- Domain: {body.competitor_domain}
- Site Content Summary: {competitor_content[:3000]}

Return a JSON object with these exact keys:
{{
  "keyword_gap": {{
    "competitor_keywords": ["list of keywords competitor targets that client doesn't"],
    "shared_keywords": ["keywords both target"],
    "client_unique": ["keywords only client targets"],
    "opportunity_score": 1-100
  }},
  "content_analysis": {{
    "competitor_strengths": ["3-5 content strengths"],
    "competitor_weaknesses": ["2-3 content gaps"],
    "content_gap_opportunities": ["3-5 specific content ideas client should create"]
  }},
  "backlink_estimate": {{
    "competitor_authority": "Low/Medium/High",
    "estimated_referring_domains": "rough range like 50-200",
    "link_building_opportunities": ["3-5 ideas"]
  }},
  "overall_threat_level": "Low/Medium/High",
  "action_items": ["5 specific actionable recommendations"]
}}
Return ONLY valid JSON, no markdown."""

    try:
        oai = get_openai_client()
        resp = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        analysis_raw = resp.choices[0].message.content or ""
    except Exception as e:
        analysis_raw = "{}"

    # Parse LLM response
    try:
        import json as json_mod
        cleaned = analysis_raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        analysis = json_mod.loads(cleaned)
    except Exception:
        analysis = {
            "keyword_gap": {"competitor_keywords": [], "shared_keywords": [], "client_unique": client_keywords, "opportunity_score": 50},
            "content_analysis": {"competitor_strengths": ["Could not analyze"], "competitor_weaknesses": [], "content_gap_opportunities": []},
            "backlink_estimate": {"competitor_authority": "Unknown", "estimated_referring_domains": "Unknown", "link_building_opportunities": []},
            "overall_threat_level": "Unknown",
            "action_items": ["Manual analysis recommended"],
        }

    # Save to database
    existing = session.exec(
        select(CompetitorAnalysis)
        .where(CompetitorAnalysis.clientId == body.client_id)
        .where(CompetitorAnalysis.competitor_domain == body.competitor_domain)
    ).first()

    if existing:
        existing.keyword_gap_data = analysis.get("keyword_gap", {})
        existing.backlink_comparison = analysis.get("backlink_estimate", {})
        existing.content_benchmarks = analysis.get("content_analysis", {})
        existing.last_updated = datetime.utcnow()
        session.add(existing)
    else:
        ca = CompetitorAnalysis(
            clientId=body.client_id,
            competitor_domain=body.competitor_domain,
            keyword_gap_data=analysis.get("keyword_gap", {}),
            backlink_comparison=analysis.get("backlink_estimate", {}),
            content_benchmarks=analysis.get("content_analysis", {}),
        )
        session.add(ca)

    session.commit()

    return {
        "competitor_domain": body.competitor_domain,
        "analysis": analysis,
    }

@app.get("/competitors/{client_id}")
def get_competitors(client_id: int, session: Session = Depends(get_session)):
    analyses = session.exec(
        select(CompetitorAnalysis).where(CompetitorAnalysis.clientId == client_id)
    ).all()
    return {"competitors": [
        {
            "id": a.id,
            "competitor_domain": a.competitor_domain,
            "keyword_gap": a.keyword_gap_data or {},
            "backlink_comparison": a.backlink_comparison or {},
            "content_benchmarks": a.content_benchmarks or {},
            "overall_threat_level": (a.keyword_gap_data or {}).get("opportunity_score", "N/A"),
            "last_updated": a.last_updated.isoformat() if a.last_updated else None,
        }
        for a in analyses
    ]}

@app.delete("/competitors/{analysis_id}")
def delete_competitor(analysis_id: int, session: Session = Depends(get_session)):
    ca = session.get(CompetitorAnalysis, analysis_id)
    if not ca:
        raise HTTPException(status_code=404, detail="Analysis not found")
    session.delete(ca)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Client Portal Domain Configuration
# ─────────────────────────────────────────────────────────────────────────────
_portal_config: Dict[str, Any] = {
    "portal_subdomain": "portal",
    "portal_domain": "",
    "branding": {
        "company_name": "SERP Hawk",
        "logo_url": "",
        "primary_color": "#d97706",
        "accent_color": "#7c3aed",
        "favicon_url": "",
    },
    "features": {
        "show_pricing": True,
        "show_store": True,
        "show_rankings": True,
        "show_milestones": True,
        "show_proposals": True,
        "allow_file_upload": True,
    },
}

@app.get("/portal/config")
def get_portal_config():
    return _portal_config

@app.put("/portal/config")
def update_portal_config(body: Dict[str, Any]):
    for key, val in body.items():
        if key in _portal_config:
            if isinstance(_portal_config[key], dict) and isinstance(val, dict):
                _portal_config[key].update(val)
            else:
                _portal_config[key] = val
    return {"ok": True, "config": _portal_config}
