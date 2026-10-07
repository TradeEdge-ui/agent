# AI Operations Agent

A local-first AI "employee" for solo entrepreneurs and small businesses. It
is not a chatbot that only talks -- it keeps real CRM, task, quotation and
invoice records, reads documents you upload, remembers your business rules,
and uses a local LLM (via [Ollama](https://ollama.com)) to actually do
things: create records, draft quotations, schedule follow-ups, and surface
what needs your attention today. Anything risky (sending a message,
finalizing a financial document, deleting a record) always stops and asks
for your explicit approval first.

Everything runs on your own computer. No data leaves your machine, and no
paid API key is required.

---

## 1. What you're getting (and what you're not)

This is a working MVP, not a mockup:

- Real authentication, a real SQLite database, a real REST API.
- A real agent loop that calls validated tools, requests approval for
  high-impact actions, and logs everything it does.
- Does **not** send real emails/SMS yet (an outbound "message" is logged,
  not transmitted -- see `docs/ROADMAP.md`).
- Does **not** claim to be tax/legal compliant software -- it organizes
  drafts; consult a professional for compliance requirements in your
  jurisdiction.

## 2. Architecture at a glance

```
React + TypeScript (frontend)  -->  FastAPI (backend)  -->  SQLite
                                        |
                                        v
                              Agent Orchestrator --> Tool Registry
                                        |
                                        v
                                 Ollama (local LLM)
```

Full details: `docs/ARCHITECTURE.md`, `docs/AGENT.md`, `docs/TOOLS.md`,
`docs/SECURITY.md`, `docs/DATABASE.md`, `docs/ROADMAP.md`.

## 3. Prerequisites

Install these once:

1. **Python 3.11 or newer** -- https://www.python.org/downloads/ (on
   Windows, check "Add python.exe to PATH" during install).
2. **Node.js 20 or newer** -- https://nodejs.org (LTS version).
3. **Ollama** -- https://ollama.com/download (Windows/Mac/Linux installer).
4. **Git** (to clone the repo), if you don't already have it.

You do **not** need Docker, PostgreSQL, Redis, or any paid service for the
MVP. (`docker-compose.yml` is provided as an *optional* convenience if you
already use Docker -- see the comment at the top of that file.)

## 4. Installation

Open a terminal (PowerShell on Windows) in the project folder.

### 4.1 Backend

```powershell
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium   # one-time download for the browser automation tool
```

### 4.2 Environment variables

```powershell
# from the backend/ folder
copy .env.example .env      # Windows
cp .env.example .env         # macOS/Linux
```

Open `backend/.env` and adjust if needed -- the defaults work out of the box
for local use. At minimum, change `SECRET_KEY` to a random string before
using this for anything beyond local experimentation.

### 4.3 Frontend

```powershell
cd ../frontend
npm install
copy .env.example .env      # Windows
cp .env.example .env         # macOS/Linux
```

The default `VITE_API_BASE_URL=http://localhost:8000/api` matches the
backend's default port.

### 4.4 Database

Nothing to run manually -- the backend creates `backend/data/app.db`
(SQLite) automatically the first time it starts. See `docs/DATABASE.md` for
the schema.

## 5. Running the app

Open **two terminals**.

**Terminal 1 -- backend:**
```powershell
cd backend
.venv\Scripts\activate      # Windows; use "source .venv/bin/activate" on macOS/Linux
uvicorn app.main:app --reload --port 8000
```
Visit http://localhost:8000/api/health -- you should see `{"status":"ok"}`.
Interactive API docs: http://localhost:8000/docs

**Terminal 2 -- frontend:**
```powershell
cd frontend
npm run dev
```
Visit http://localhost:5173

## 6. Setting up Ollama (the local AI)

```powershell
# 1. Install Ollama from https://ollama.com/download, then:
ollama serve          # starts the local model server (often starts automatically)

# 2. In another terminal, pull a model (first time only -- a few GB download):
ollama pull llama3.1
```

The app's **Settings -> AI & Automation** tab (and the onboarding wizard's
"Check Ollama connection" step) will tell you clearly if Ollama isn't
reachable or the model isn't installed -- the app never pretends the AI
agent is working when it isn't.

To use a different model, change `OLLAMA_MODEL` in `backend/.env` (or the
"Model name" field in Settings) to whatever you `ollama pull`'d, e.g.
`mistral` or `qwen2.5`.

## 7. Creating your first account

1. With both servers running, open http://localhost:5173
2. Click **Create one** on the login screen.
3. Fill in your name, business name, email and password (min. 8 characters).
4. You'll land in a short onboarding wizard: business profile -> currency &
   rules -> AI provider -> Ollama check -> optional sample data -> done.
5. You're in the Command Center.

## 8. Loading demo data

Two ways:

- **During onboarding**, click "Load sample data" (step 5) -- populates
  *your* new business with fictional customers, leads, tasks, a quotation
  and an invoice draft.
- **As a separate demo account**, from the `backend/` folder (venv active):
  ```powershell
  python -m scripts.seed_demo_data
  ```
  This creates a standalone login: `demo@brightpathstudio.com` /
  `DemoPass123!`. Safe to re-run -- it skips seeding if that account already
  exists.

## 9. Running the tests

**Backend (pytest):**
```powershell
cd backend
.venv\Scripts\activate
pytest -q
```
Covers: auth, permissions/multi-tenant isolation, CRM, tasks/follow-ups,
quotation & invoice calculations + status transitions, document ingestion,
knowledge retrieval, approvals, audit logging, and the full agent
orchestration loop (tool execution, approval gating per autonomy level,
rejection flow, invalid-input recovery, max-iteration/duplicate-call loop
limits, malformed-JSON recovery, and prompt-injection handling) using a
scripted fake LLM provider so results don't depend on a specific model.

**Frontend (vitest):**
```powershell
cd frontend
npm test
```

## 10. Trying the demo workflows

With the demo account loaded, go to **AI Agent** and try (requires Ollama
running with a model installed):

- *"What should I focus on today?"*
- *"Which leads are going cold?"*
- *"Prepare a quotation for a basic website at $1,500, valid for 7 days"*

Or try the fully manual flows without AI at all: create a customer, add a
lead, move it through the pipeline, create a draft quotation, download its
PDF, and watch the Dashboard and Activity log update.

## 11. Browser automation, workflows, voice & notifications

Four capabilities beyond the original MVP cut, all real and working today:

- **Browser automation tool** -- the AI agent can open a real headless
  Chromium tab, navigate, read a page, click, and fill forms (e.g. *"open my
  browser and check example.com"*). Needs `playwright install chromium` (see
  step 4.1). Details, risk levels and the prompt-injection defense:
  `docs/TOOLS.md`.
- **Workflows** (new **Workflows** page) -- reusable routines ("start my
  work setup") you build from a sequence of LOW-risk actions and optional
  conditions, run on demand, by name from the AI Agent chat (*"run my
  morning routine"*), or on a cron schedule while the backend is running.
  Details: `docs/WORKFLOWS.md`.
- **Voice input/output** on the AI Agent page -- a microphone button
  transcribes your speech into the message box (Chrome/Edge today; the mic
  button is disabled with an explanation in browsers that don't support
  it), and an optional "Speak responses" toggle reads the agent's answers
  aloud. Built on standard browser APIs, no extra install. Details:
  `docs/VOICE.md`.
- **Desktop notifications** -- approvals needed, and tasks/workflows
  completing or failing, can pop a real OS-level browser notification (in
  addition to the existing in-app unread badge). The browser will ask for
  notification permission the first time there's something to show.

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` | Activate the virtualenv first (`.venv\Scripts\activate`). |
| Frontend shows network errors | Make sure the backend is running on port 8000, and `frontend/.env`'s `VITE_API_BASE_URL` matches. |
| "Could not connect to Ollama" | Run `ollama serve` in a terminal and leave it running; re-check in Settings. |
| "model is not installed" | Run `ollama pull <model-name>` matching `OLLAMA_MODEL` in `backend/.env`. |
| Port 8000 or 5173 already in use | Stop whatever else is using it, or pass a different port: `uvicorn app.main:app --port 8001` and update `VITE_API_BASE_URL` to match. |
| Need a clean slate | Stop the backend, delete `backend/data/app.db` (and optionally `backend/uploads/`), restart -- a fresh empty database is created automatically. |
| Backing up your data | `./scripts/backup_db.sh` (copies the SQLite file). Restore with `./scripts/restore_db.sh <backup-file>`. On Windows, run these via Git Bash or WSL, or just copy `backend/data/app.db` manually while the backend is stopped. |
| Browser tool says "Browser automation is unavailable" | Run `playwright install chromium` inside the activated backend virtualenv. |
| Mic button is greyed out | Your browser doesn't support the Web Speech API for voice input yet -- try Chrome or Edge, or just type. "Speak responses" (voice output) works in far more browsers. |
| No desktop notification popped up | Check your OS/browser notification permissions for the site; the in-app unread badge in the sidebar still works regardless. |

## 13. Future architecture

See `docs/ROADMAP.md` for what's intentionally deferred (real email/SMS
sending, vector-based knowledge search, OCR, hosted-LLM providers,
additional specialized agents built on the same Agent Core, etc.) and why.

## 14. Project structure

```
/backend          FastAPI app, SQLAlchemy models, agent core, tool registry, tests
/frontend         React + TypeScript + Vite + Tailwind
/docs             Architecture, agent, tools, security, database, roadmap docs
/scripts          Repo-level convenience scripts (seed, backup, restore)
.env.example       Root-level reference of all environment variables
docker-compose.yml Optional container setup
```
