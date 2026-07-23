# TEAM CONTRIBUTION REPORT
## AI Study Hub — SWP391 Summer 2026
**Nhóm 5 • FPT University • Topic 10**  
Academic Year 2025–2026

---

## 1. Team Members

| Field | Details |
|---|---|
| Project Name | AI Study Hub — AI-Powered Academic Document Management System |
| Course | SWP391 — Software Development Project, Summer 2026 |
| Institution | FPT University, Ho Chi Minh City Campus |
| Group | Nhóm 5 — Topic 10 |
| Report Date | July 2026 |
| Repository | quocdat2601/AI-Study-Hub |


### Team Roles & Responsibilities

| # | Full Name | Student ID | Role | Primary Responsibility |
|---|---|---|---|---|
| 1 | Nguyễn Lê Quốc Đạt | SE183156 | Team Lead & AI Integration Lead | AI chatbot RAG pipeline, multi-document chat sessions, Express MVC architecture, Railway/Vercel deployment, initial DB migrations, document extraction pipeline, SRS v2 & slides co-author |
| 2 | Nguyễn Quang Duy Quang | SE183155 | Auth & Community Feature Lead | Community module & real-time feed, Workspace Studio features, Supabase auth/security, rich text editor & lightbox, SRS & System Design author, JSDoc codebase docs |
| 3 | Hoàng Nguyễn Thế Vinh | SE180198 | UI/UX Developer | Notebook PDF annotations system, document learning roadmap, landing page chatbot widget, user profile & storage settings |
| 4 | Đặng Trường Huy | SE180132 | Database & Storage Engineer | Trash management UI & auto-purges, hash-based document deduplication (SHA-256), storage refcount cleanup, onboarding flow |
| 5 | Vũ Đình Thắng | SE180277 | Frontend Developer | Admin page frontend CRUD implementation, Subject backend APIs, merge conflict resolution |


---

## 2. Contribution Summary

The following table summarises each member's contribution based on complete Git repository commit history (`git log`), feature engineering, codebase architecture, production deployment, and project documentation (including SRS v1 & v2 and System Design).

| Member | Substantive Commits | Share (%) | Main Areas |
|---|---|---|---|
| Nguyễn Lê Quốc Đạt | 54 *(71 total)* | 40% | **AI Chatbot RAG Pipeline & Multi-Document Sessions** (lead backend & AI engineer, +44.0k lines added), Express MVC architecture & initial DB migrations 001–004, document extraction pipeline, Vercel/Railway production deployment, chat snapshot sharing, SRS v2 & presentation slides co-author |
| Nguyễn Quang Duy Quang | 52 *(60 total)* | 40% | **Community Hub Module** (Supabase Realtime feed & SQL performance views), **Workspace Studio features** (Flashcards/Quiz/Mind Map), contenteditable editor & lightbox zoom, Supabase auth/security, SRS & System Design author, JSDoc codebase documentation |
| Hoàng Nguyễn Thế Vinh | 10 *(18 total)* | 10% | Notebook PDF annotations system (highlighting and anchoring), document learning roadmap feature, landing page embedded chatbot widget, profile settings & storage upgrades, i18n, dark mode implementation |
| Đặng Trường Huy | 15 *(28 total)* | 6% | Trash management UI & automated background purges, onboarding flow (interest selection & hybrid recommendations & AI auto-tagging), hash-based document deduplication (SHA-256) & storage reference-count logic |
| Vũ Đình Thắng | 7 *(10 total)* | 4% | Admin page frontend implementation (CRUD subjects, user list toggling, activity log pagination), admin backend API subject features, merge conflict resolution |
| Total | 138 *(187 total)* | 100% | Substantive feature commits across repository history (excluding pure merge commits) |


---

## 3. Individual Contribution Detail

### 3.1 Nguyễn Lê Quốc Đạt (SE183156) — 40%

#### Code & Core Feature Development
- **AI Chatbot Engine & RAG Pipeline**: Designed and built the core AI Chatbot pipeline (`rag.service.js`), incorporating RAG context ranking, chunking, in-memory `pdf-parse` extraction, and Gemini 1.5/2.5 Flash integration via `chat_session_documents`.
- **Multi-Document Chat Sessions**: Built multi-document chat session lifecycle supporting up to 5 document attachments simultaneously, document attachment/detachment logic, bulk file detachment, and unified workspace routing.
- **Backend Architecture & Database Foundation**: Established core Express MVC + Service Layer architecture, singleton service patterns, facade services for Supabase & Gemini, and authored initial database migrations 001–004 (initial schema, RLS security policies, admin seed, and multi-doc chat).
- **Document Extraction & Cleanup Pipeline**: Implemented document extraction pipeline (`extractAndStore()`, `extraction_status` state machine) and session expiry lifecycle (migration 022, session document auto-cleanup).
- **Production Deployment & Infrastructure**: Configured and maintained live production environments on Railway (backend API) and Vercel (frontend client), environment variables, secret management, CI/CD pipeline, and Vercel router rewrites.
- **Chat Sharing & Interactive UI**: Developed secure chat session sharing and snapshot generation, drag-and-drop file attachment in chat, skeleton UI loaders, and admin overview dashboard API integration.

#### Documentation & Collaboration
- **Co-authored SRS v2**: updated architecture references from Firebase/MySQL to Supabase/PostgreSQL, specified new functional requirements REQ-FUNC-025–029 and user stories US-16–US-21.
- **Co-authored System Design & Flow Documentation**: authored `CHATBOT_AI_ARCHITECTURE_AND_WORKFLOW.md`, `ASM2_SYSTEM_FLOW_AND_CODE_GUIDE.md` (`& _VI.md`), `SUPABASE_EGRESS_AUDIT.md`, and backend Docker deployment guides.
- Co-authored presentation slides and managed task coordination on Jira.

---

### 3.2 Nguyễn Quang Duy Quang (SE183155) — 40%

#### Code & Core Feature Development
- **Community Module Engineering**: Designed and implemented the complete Community Hub (discussion, question, document share, and AI study log post types, replies, upvoting, reporting, moderation).
- **Real-Time Feed & SQL Performance Optimization**: Built real-time feed updates using Supabase Realtime via `community_live_events`, and authored optimized SQL views (`community_posts_feed_view`, `community_user_stats`) to eliminate client-side pagination overhead.
- **Workspace Studio Features**: Built the interactive Workspace Studio panel with Flashcards (3D flip, self-assessment, shuffle, practice-unknown), MCQ Quiz (with answer review & letter mapping), and Mind Map (collapsible tree unwrapping).
- **Frontend Rich Media & Editor Enhancements**: Developed contenteditable rich-text editor, lightbox image zoom overlay, image download utilities, markdown rendering hooks, and public document stats pages.
- **Auth & Security Guardrails**: Integrated Supabase Auth, token middleware, role-based access control, and authored local JWT verification guard against token spam DoS.
- **Codebase Standardization**: Added comprehensive JSDoc documentation across all backend services, controllers, middleware, models, and frontend pages.

#### Documentation & Collaboration
- **Primary Author of SRS (v1 & v2)**: authored functional requirements (REQ-FUNC-001 through 029), non-functional requirements, user stories, and use cases.
- **System Design & Architecture**: authored System Design document, 12-table PostgreSQL schema, API contract specifications, and `docs/QuangD300504-features.md`.
- Authored team presentation script and maintained sprint tracking on Jira.

---

### 3.3 Hoàng Nguyễn Thế Vinh (SE180198) — 10%

#### Code & Core Feature Development
- **Notebook PDF Annotations System**: Implemented PDF annotation tools in `WorkspaceNotebook.jsx`, supporting color-coded text highlighting, note anchoring, persistent highlights, and DB persistence via `notebook.service.js`.
- **Document Learning Roadmap**: Built user-specific AI learning roadmap feature (lộ trình học) with step-by-step progress tracking.
- **Landing Page Chatbot Widget**: Developed floating mascot button, landing page chatbot widget, and streaming response UI.
- **Profile & UX Enhancements**: Implemented user profile settings, avatar upload, storage tier upgrades, dark mode toggle, and i18n support.

---

### 3.4 Đặng Trường Huy (SE180132) — 6%

#### Code & Core Feature Development
- **Trash Lifecycle & Auto-Purging**: Implemented document soft deletion, restore, bulk operations, owner-only deletion validation, admin audit logging, and automated background trash purging.
- **Hash-Based Document Deduplication**: Implemented SHA-256 duplicate file detection on upload to prevent redundant cloud storage writes.
- **Storage Cleanup & Onboarding**: Refactored storage reference-count cleanup on deletion, and built onboarding flow with interest selection, hybrid recommendations, and automated AI tagging.

---

### 3.5 Vũ Đình Thắng (SE180277) — 4%

#### Code & Core Feature Development
- **Admin Management Frontend**: Completed Admin dashboard Subjects CRUD (with delete guards), Users tab enable/disable toggle, and Activity Log tab with pagination.
- **Admin Backend APIs**: Developed Subject management API endpoints and resolved merge conflict markers in `AdminPage.jsx`.

---

## 4. Methodology & Notes

### 4.1 How Contribution Was Measured
The contribution split was derived from complete Git repository history (`git log`) and the following weighted sources:
1. **Feature Implementation Difficulty & Technical Complexity**: evaluation of technical depth and architectural complexity (e.g., multi-document RAG context chunking & PDF extraction pipeline, Supabase Realtime feed & SQL view performance tuning, Ollama LLM study material parsing, canvas PDF annotation anchoring, SHA-256 binary deduplication vs. standard CRUD components).
2. **Core Code Output**: production code added to the codebase (Quốc Đạt leading code volume with +44.0k lines, followed by Duy Quang with +28.4k lines).
3. **Substantive Git Commit History (`git log`)**: non-merge commit count per author across dev and feature branches (Quốc Đạt: 54 non-merge / 71 total, Duy Quang: 52 non-merge / 60 total).
4. **Production Infrastructure & Operations**: deployment configuration, secret management, CI/CD pipeline setup, and live server operations on Railway (backend API) and Vercel (frontend SPA).
5. **Feature Ownership & Lifecycle Execution**: end-to-end creation, maintenance, and bug fixing of functional modules.

### 4.2 What Was Excluded
- Pure merge commits (`git merge` and pull request merges)
- Formatting-only edits (whitespace, import sorting, ESLint auto-fixes)
