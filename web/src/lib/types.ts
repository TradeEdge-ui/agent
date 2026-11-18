// Row shapes for the tables in supabase/migrations. bigint columns arrive from
// PostgREST as numbers (safe: amounts are far below 2^53 sen).

export type Role = "client" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  role: Role;
  stripe_customer_id: string | null;
  marketing_opt_in: boolean;
  created_at: string;
};

export type ServiceCategory = "website" | "ai" | "maintenance";

export type Service = {
  id: string;
  slug: string;
  category: ServiceCategory;
  name: string;
  tagline: string | null;
  description: string | null;
  price_min_cents: number | null;
  price_max_cents: number | null;
  price_notes: string | null;
  billing_type: "one_time" | "monthly";
  purchase_mode: "direct" | "quote";
  deposit_percent: number;
  deliverables: string[];
  exclusions: string[];
  revisions_included: number;
  timeline_text: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
};

export type BookingConfig = {
  enabled: boolean;
  slot_minutes: number;
  days: number[]; // 0 = Sunday ... 6 = Saturday
  start: string; // "HH:MM" Malaysia time
  end: string;
  min_notice_hours: number;
  max_days_ahead: number;
  blackout_dates: string[]; // YYYY-MM-DD
};

export type BusinessSettings = {
  id: number;
  business_name: string;
  legal_name: string | null;
  registration_no: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
  duitnow_id: string | null;
  sst_registered: boolean;
  sst_number: string | null;
  sst_rate: number;
  invoice_due_days: number;
  quote_validity_days: number;
  invoice_footer: string | null;
  booking_config: BookingConfig;
  auto_payment_reminders: boolean;
};

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal_sent" | "won" | "lost";

export type Lead = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: "quote_request" | "contact" | "booking" | "dashboard" | "manual";
  service_id: string | null;
  budget: string | null;
  timeline: string | null;
  website_url: string | null;
  message: string;
  details: Record<string, unknown>;
  status: LeadStatus;
  created_at: string;
};

export type LineItem = { description: string; quantity: number; unit_price_cents: number };
export type ScheduleItem = { label: string; percent: number };

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "cancelled";

export type Quote = {
  id: string;
  number: string;
  lead_id: string | null;
  client_id: string | null;
  client_email: string;
  client_name: string | null;
  service_id: string | null;
  title: string;
  summary: string | null;
  line_items: LineItem[];
  subtotal_cents: number;
  discount_cents: number;
  tax_rate: number;
  tax_cents: number;
  total_cents: number;
  payment_schedule: ScheduleItem[];
  deliverables: string[];
  exclusions: string[];
  revisions_included: number;
  timeline_text: string | null;
  recommended_service_id: string | null;
  valid_until: string | null;
  terms: string | null;
  status: QuoteStatus;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  project_id: string | null;
  created_at: string;
};

export type ProjectStatus =
  | "awaiting_payment" | "planning" | "in_progress" | "review" | "completed" | "on_hold" | "cancelled";

export type Project = {
  id: string;
  number: string;
  client_id: string;
  quote_id: string | null;
  service_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  revisions_included: number;
  live_url: string | null;
  staging_url: string | null;
  total_cents: number;
  created_at: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  status: "pending" | "in_progress" | "completed";
  due_date: string | null;
  completed_at: string | null;
};

export type ProjectUpdate = {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type RevisionRequest = {
  id: string;
  project_id: string;
  requested_by: string | null;
  title: string;
  details: string;
  status: "open" | "in_progress" | "done" | "rejected";
  counts_toward_limit: boolean;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type FileRecord = {
  id: string;
  owner_id: string;
  project_id: string | null;
  lead_id: string | null;
  bucket: string;
  path: string;
  filename: string;
  size_bytes: number;
  mime_type: string | null;
  kind: "asset" | "deliverable" | "other";
  uploaded_by: string | null;
  created_at: string;
};

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export type Invoice = {
  id: string;
  number: string;
  client_id: string;
  project_id: string | null;
  quote_id: string | null;
  subscription_id: string | null;
  kind: "deposit" | "milestone" | "final" | "full" | "subscription" | "manual";
  title: string;
  status: InvoiceStatus;
  currency: string;
  line_items: LineItem[];
  subtotal_cents: number;
  discount_cents: number;
  tax_rate: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_refunded_cents: number;
  sequence: number | null;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  notes: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  receipt_number: string;
  invoice_id: string | null;
  client_id: string | null;
  amount_cents: number;
  currency: string;
  method: string;
  provider: "stripe" | "manual";
  provider_payment_id: string | null;
  reference: string | null;
  status: "succeeded" | "partially_refunded" | "refunded";
  refunded_cents: number;
  receipt_url: string | null;
  paid_at: string;
};

export type SubscriptionStatus =
  | "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";

export type Subscription = {
  id: string;
  client_id: string;
  service_id: string | null;
  project_id: string | null;
  plan_name: string;
  status: SubscriptionStatus;
  price_cents: number;
  currency: string;
  interval: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  topic: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  meeting_url: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  incurred_on: string;
  category: string;
  description: string;
  vendor: string | null;
  amount_cents: number;
  project_id: string | null;
  created_at: string;
};

export type PortfolioItem = {
  id: string;
  slug: string;
  title: string;
  client_name: string | null;
  summary: string;
  description: string | null;
  image_url: string | null;
  live_url: string | null;
  tags: string[];
  is_published: boolean;
  sort_order: number;
};

export type Testimonial = {
  id: string;
  author_name: string;
  author_title: string | null;
  company: string | null;
  quote: string;
  rating: number | null;
  project_id: string | null;
  submitted_by: string | null;
  consent_to_publish: boolean;
  is_published: boolean;
  created_at: string;
};
