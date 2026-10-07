from pydantic import BaseModel


class BusinessUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    industry: str | None = None
    currency: str | None = None
    timezone: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    default_quotation_validity_days: int | None = None
    default_payment_terms: str | None = None
    invoice_numbering_prefix: str | None = None
    quotation_numbering_prefix: str | None = None
    tax_label: str | None = None
    tax_rate_percent: float | None = None
    tax_registered: bool | None = None
    communication_style: str | None = None
    autonomy_level: str | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    stale_lead_days_threshold: int | None = None
    onboarding_completed: bool | None = None


class BusinessOut(BaseModel):
    id: str
    name: str
    description: str
    industry: str
    currency: str
    timezone: str
    contact_email: str
    contact_phone: str
    address: str
    default_quotation_validity_days: int
    default_payment_terms: str
    invoice_numbering_prefix: str
    quotation_numbering_prefix: str
    tax_label: str
    tax_rate_percent: float
    tax_registered: bool
    communication_style: str
    autonomy_level: str
    ai_provider: str
    ai_model: str
    stale_lead_days_threshold: int
    onboarding_completed: bool

    class Config:
        from_attributes = True
