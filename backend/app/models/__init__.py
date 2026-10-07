"""Import all models here so Base.metadata.create_all() sees every table."""
from app.models.user import User
from app.models.business import Business, BusinessMember
from app.models.crm import Customer, Contact, Lead, Interaction
from app.models.tasks import Task, FollowUp
from app.models.finance import (
    Service,
    Quotation,
    QuotationItem,
    Invoice,
    InvoiceItem,
)
from app.models.documents import Document
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk
from app.models.business_rule import BusinessRule
from app.models.agent import AgentRun, AgentMessage, ToolExecution
from app.models.approval import Approval
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.models.workflow import Workflow, WorkflowStep, WorkflowRun

__all__ = [
    "User",
    "Business",
    "BusinessMember",
    "Customer",
    "Contact",
    "Lead",
    "Interaction",
    "Task",
    "FollowUp",
    "Service",
    "Quotation",
    "QuotationItem",
    "Invoice",
    "InvoiceItem",
    "Document",
    "KnowledgeDocument",
    "KnowledgeChunk",
    "BusinessRule",
    "AgentRun",
    "AgentMessage",
    "ToolExecution",
    "Approval",
    "Notification",
    "AuditLog",
    "Workflow",
    "WorkflowStep",
    "WorkflowRun",
]
