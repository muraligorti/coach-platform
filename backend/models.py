from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    COACH = "coach"
    CLIENT = "client"
    ADMIN = "platform_admin"
    ORG_OWNER = "org_owner"

class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"

# Auth models
class UserRegister(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: str
    phone_country_code: str = "+91"
    role: UserRole = UserRole.CLIENT
    password: Optional[str] = None

class OTPRequest(BaseModel):
    phone: str
    phone_country_code: str = "+91"
    purpose: str = "login"

class OTPVerify(BaseModel):
    phone: str
    phone_country_code: str = "+91"
    otp_code: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# Client models
class ClientCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

# Session models
class SessionCreate(BaseModel):
    client_id: str
    template_id: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int = 60
    location: Optional[str] = None
    notes: Optional[str] = None

class SessionUpdate(BaseModel):
    status: Optional[SessionStatus] = None
    notes: Optional[str] = None

class SessionGradeCreate(BaseModel):
    session_id: str
    client_id: str
    grade_value: str
    numeric_score: float
    comments: Optional[str] = None

# Progress models
class ProgressEntryCreate(BaseModel):
    client_id: str
    session_id: Optional[str] = None
    entry_type: str
    notes: Optional[str] = None

# Payment models
class PaymentPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    amount: float
    currency: str = "INR"
    billing_cycle: str = "monthly"
    session_count: Optional[int] = None

class PaymentLinkCreate(BaseModel):
    client_id: str
    plan_id: str
    amount: float

# Workout/Template models
class WorkoutTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    session_type: Optional[str] = None
    duration_minutes: int = 60
    structure: Optional[dict] = None

class AssignWorkout(BaseModel):
    client_id: str
    template_id: str
    scheduled_dates: List[str]
