# QuangD300504 – Feature Architecture Docs

> Front-to-back flow for all 5 feature areas.  
> Stack: React (Vite) → Express.js → Supabase (Postgres + Auth)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Community Hub](#2-community-hub)
3. [Studio / Workspace](#3-studio--workspace)
4. [Moderation (Admin)](#4-moderation-admin)
5. [Public Docs Space](#5-public-docs-space)

---

## 1. Authentication

### Overview
Auth is fully delegated to **Supabase Auth**. The backend never stores passwords — it only syncs the Supabase identity into its own `users` table.

### Frontend Entry Points
| Route | File |
|---|---|
| `/login` | `LoginPage.jsx` |
| `/forgot-password` | `ForgotPasswordPage.jsx` |
| `/reset-password` | `ResetPasswordPage.jsx` |

### Flow: Login / Register

```
LoginPage.jsx
  └─ useAuth() from AuthContext.jsx
       ├─ login()  → authApi.loginWithPassword()  → supabase.auth.signInWithPassword()
       ├─ register() → authApi.registerWithPassword() → supabase.auth.signUp()
       └─ loginWithGoogle() → authApi.loginWithGoogle() → supabase.auth.signInWithOAuth()

After Supabase returns a session (access_token):
  AuthContext.loadCurrentUser(access_token)
    └─ GET /api/auth/me  [Bearer token]
         └─ middleware/auth.js (verifyToken)
              ├─ 1. Locally decode JWT → check exp (fast DoS guard)
              ├─ 2. supabase.auth.getUser(token)  (remote verify)
              └─ 3. authService.syncUserProfile(supabaseUser)
                    └─ userModel.findById() → create if first login → return publicUser
         └─ auth.controller.getMe()
              └─ Promise.all([accountService.getAccount(), preferenceService.getStatus()])
              └─ returns merged user object → stored in AuthContext.user
```

### Flow: Password Recovery

```
ForgotPasswordPage → AuthContext.requestPasswordReset(email)
  └─ authApi.requestPasswordResetEmail(email, redirectTo='/reset-password')
       └─ supabase.auth.resetPasswordForEmail()   [sends email]

User clicks link → /reset-password
  ResetPasswordPage → AuthContext.updatePassword(newPassword)
    └─ authApi.updateUserPassword()
         └─ supabase.auth.updateUser({ password })
```

### Flow: Session Hydration (on every page load)

```
AuthContext useEffect (mount)
  └─ authApi.getAuthSession() → supabase.auth.getSession()
       if session → loadCurrentUser(access_token) → GET /api/auth/me
  └─ onAuthStateChange listener (permanent)
       PASSWORD_RECOVERY → markRecoveryMode() (localStorage flag)
       SIGNED_OUT        → clear user state
       TOKEN_REFRESHED   → skip reload if user already in memory
```

### Auth Middleware (backend)

```javascript
// middleware/auth.js
1. Extract Bearer token from Authorization header
2. decodeJwtPayload(token)  → local base64 decode, check exp
   → reject immediately if expired (no Supabase round-trip)
3. supabase.auth.getUser(token)  → cryptographic verify
4. authService.syncUserProfile(supabaseUser)
   → upsert user into local DB, enforce role normalization
   → throw 403 if status === 'disabled'
5. req.user = publicUser   → available to all downstream controllers
```

### Role System

| Role | Access |
|---|---|
| `user` (also `student`) | Standard authenticated routes |
| `admin` | `/api/admin/*` + all user routes |

- `requireRole('user', 'admin')` guards community, workspace, etc.
- `requireRole('admin')` exclusively guards `/api/admin/*`
- `student` is an alias of `user` (normalized in `requireRole.js`)

### Key Files
| Layer | File |
|---|---|
| Frontend context | `frontend/src/contexts/AuthContext.jsx` |
| Frontend API calls | `frontend/src/services/authApi.js` |
| Login page | `frontend/src/pages/LoginPage.jsx` |
| Backend middleware | `backend/src/middleware/auth.js` |
| Backend route | `backend/src/routes/auth.routes.js` |
| Backend controller | `backend/src/controllers/auth.controller.js` |
| Sync service | `backend/src/services/auth.service.js` |
| User model | `backend/src/models/user.model.js` |

---

## 2. Community Hub

### Overview
A forum-style Q&A and discussion board. Posts support multiple subjects, rich text, image attachments, and document/chat sharing. Replies are threaded. Votes are toggleable. Reports feed into the Admin moderation queue.

### Frontend Pages
| Route | Page |
|---|---|
| `/community` | `CommunityPage.jsx` – feed, filters, sidebar |
| `/community/subjects/:code` | `CommunityPage.jsx` – filtered by subject |
| `/community/new` | `CommunityCreatePostPage.jsx` (auth required) |
| `/community/posts/:id` | `CommunityPostDetailPage.jsx` |
| `/community/users/:userId` | `CommunityUserProfilePage.jsx` |

### Flow: Viewing the Feed (public)

```
CommunityPage.jsx
  └─ GET /api/public/community/feed
       ?tab=hot|new|top  &postType=question|discussion  &subject=CODE  &page=1
       └─ public.routes.js → communityController.getFeed()
            └─ communityService.listPublicFeed({ tab, postType, subjectCode, page })
                 └─ CommunityModel  (Supabase queries)
                      ├─ community_posts (+ joined subjects, users, documents, chat_sessions)
                      ├─ community_replies (reply counts per post)
                      ├─ community_votes  (vote aggregation per post)
                      └─ community_post_subjects (multi-subject mapping)
                 returns paginated feed with viewer context (hasVoted, isOwner)
```

> No auth required for feed browsing and post reading.

### Flow: Creating a Post (auth required)

```
CommunityCreatePostPage.jsx  (protected route)
  └─ POST /api/community/posts
       └─ verifyToken → requireRole('user','admin')
       └─ communityController.createPost()
            └─ communityService.createPost({
                 userId, postType, title, body,
                 subjectIds[],      // multi-subject
                 documentId,        // optional: attach a doc
                 chatSessionId      // optional: attach a chat
               })
                 ├─ CommunityModel.createPost()          → insert community_posts
                 └─ CommunityModel.replacePostSubjects() → insert community_post_subjects
```

### Flow: Thread / Replies

```
CommunityPostDetailPage.jsx
  └─ GET /api/public/community/posts/:id
       └─ communityService.getPublicPostById(id, viewerContext)
            ├─ CommunityModel.findPostById()
            ├─ CommunityModel.listRepliesByPostId()
            ├─ CommunityModel.trackPostView(postId, viewerKey)  → RPC (30-min dedup)
            └─ returns full thread with nested reply tree + vote state

  POST /api/community/posts/:id/replies   [auth]
    └─ communityService.addReply({ postId, userId, body, parentReplyId })
         └─ CommunityModel.createReply()
  
  PATCH  /api/community/replies/:id                      [auth, owner only]
  DELETE /api/community/replies/:id                      [auth, owner only]
  POST   /api/community/posts/:id/accept/:replyId        [auth, post owner only]
```

### Flow: Voting (toggle)

```
POST /api/community/posts/:id/vote   [auth]
  └─ communityService.togglePostVote({ postId, userId })
       ├─ CommunityModel.findPostVote()
       ├─ if exists → CommunityModel.deleteVote()  (un-vote)
       └─ if not    → CommunityModel.createVote()  (vote)

POST /api/community/replies/:id/vote  [auth]  (same pattern)
```

### Flow: Reporting

```
CommunityPostDetailPage.jsx → report button
  └─ POST /api/community/posts/:id/report  [auth]
       └─ communityService.reportPost({ postId, replyId?, userId, reason })
            ├─ CommunityModel.findOpenPostReport()  → dedup: one open report per user+post
            └─ CommunityModel.createReport()  → insert community_reports (status: 'open')
                 → report appears in Admin moderation queue
```

### DB Tables Used
| Table | Purpose |
|---|---|
| `community_posts` | Posts with status, type, body, view_count |
| `community_replies` | Threaded replies (parent_reply_id) |
| `community_votes` | Toggle up-votes for posts and replies |
| `community_reports` | User reports, resolved by admin |
| `community_post_subjects` | M:N posts ↔ subjects mapping |

### Key Files
| Layer | File |
|---|---|
| Public routes | `backend/src/routes/public.routes.js` |
| Auth routes | `backend/src/routes/community.routes.js` |
| Controller | `backend/src/controllers/community.controller.js` |
| Service | `backend/src/services/community.service.js` |
| Model | `backend/src/models/community.model.js` |
| Feed page | `frontend/src/pages/CommunityPage.jsx` |
| Create post | `frontend/src/pages/CommunityCreatePostPage.jsx` |
| Thread detail | `frontend/src/pages/CommunityPostDetailPage.jsx` |
| User profile | `frontend/src/pages/CommunityUserProfilePage.jsx` |

---

## 3. Studio / Workspace

### Overview
An AI-powered document study environment. A user opens a document, reads it, chats with an AI, and uses the **Studio** tab to generate study materials (flashcards, quizzes, mindmaps) via Gemini or Ollama.

### Frontend Entry Points
| Route | Page |
|---|---|
| `/workspace` | `WorkspacePage.jsx` – document list panel |
| `/workspace/documents/:documentId` | `WorkspacePage.jsx` – opens specific doc |

### Flow: Bootstrap (loading workspace data)

```
WorkspacePage.jsx mounts
  └─ GET /api/workspace/bootstrap?search=&subjectId=
       [verifyToken, requireRole('user','admin')]
       └─ workspaceController.getBootstrap()
            └─ workspaceService.getBootstrap({ userId, search, subjectId })
                 ├─ documentModel.listByUser()    → user's documents
                 ├─ chatModel.listByUser()         → user's chat sessions
                 └─ bookmarkModel.listByUser()     → user's bookmarks
```

### Flow: Opening a Document

```
User clicks document in sidebar
  └─ GET /api/workspace/documents/:id
       └─ workspaceService.getDocumentContext({ userId, docId })
            └─ documentModel.findAccessibleById() → ownership check

  GET /api/workspace/documents/:id/preview-data
       └─ workspaceService.getDocumentPdf()
            └─ download from Supabase Storage → return as base64 JSON
```

### Flow: AI Chat

```
User types in chat panel
  └─ POST /api/ai/chat/sessions/:sessionId/ask         (full response)
  └─ POST /api/ai/chat/sessions/:sessionId/ask/stream  (SSE streaming)
       [verifyToken]
       └─ aiController.askSession / askSessionStream()
            └─ chat.service + rag.service
                 ├─ fetch session + attached documents
                 ├─ run RAG (chunk retrieval + re-ranking)
                 └─ call Gemini or Ollama with context window
```

### Flow: Studio – Generating Study Materials

```
User opens "Studio" tab → selects type + model

  └─ POST /api/ai/materials/generate
       { docId, materialType: 'flashcard'|'quiz'|'mindmap', model }
       [verifyToken]
       └─ aiController.generateMaterial()
            └─ study-material.service.js
                 ├─ fetch document extracted text / chunks
                 ├─ build prompt per type:
                 │    flashcard → direct question front / answer back (≤30 words)
                 │    quiz      → 4 options, correct letter, custom explanation
                 │    mindmap   → nested tree structure
                 ├─ ai-provider.service.js routes to:
                 │    → gemini.service.js  (Google Generative AI)
                 │    → ollama.service.js  (local Ollama HTTP)
                 ├─ robust JSON extraction (regex fallback)
                 ├─ dedup flashcards via Jaccard similarity
                 └─ persist to study_materials table
                      → return material to frontend

  GET    /api/ai/materials?docId=X   → list previously generated
  DELETE /api/ai/materials/:id       → delete a material
```

### Flow: Notes

```
WorkspacePage → Notes panel
  GET    /api/workspace/documents/:id/notes
  POST   /api/workspace/documents/:id/notes
  PATCH  /api/workspace/documents/:id/notes/:noteId
  DELETE /api/workspace/documents/:id/notes/:noteId
         [verifyToken, requireRole('user','admin')]
         └─ workspaceController → workspaceService → Supabase
```

### Key Files
| Layer | File |
|---|---|
| Workspace UI | `frontend/src/pages/WorkspacePage.jsx` |
| Workspace context | `frontend/src/contexts/WorkspaceContext.jsx` |
| Workspace routes | `backend/src/routes/workspace.routes.js` |
| AI routes | `backend/src/routes/ai.routes.js` |
| Workspace controller | `backend/src/controllers/workspace.controller.js` |
| AI controller | `backend/src/controllers/ai.controller.js` |
| Workspace service | `backend/src/services/workspace.service.js` |
| Study material svc | `backend/src/services/study-material.service.js` |
| AI provider router | `backend/src/services/ai-provider.service.js` |
| Gemini service | `backend/src/services/gemini.service.js` |
| Ollama service | `backend/src/services/ollama.service.js` |

---

## 4. Moderation (Admin)

### Overview
Admins access `/admin` — a single-page dashboard. Covers: community report queue, post/reply takedowns, user management, subject CRUD, document overview.

### Frontend Entry Point
| Route | Guard | Page |
|---|---|---|
| `/admin` | `AdminRoute` (role=admin only) | `AdminPage.jsx` |

### Auth Guard Stack

```
App.jsx → <AdminRoute>
  └─ checks useAuth().user.role === 'admin'
       if not admin → redirect to /dashboard
  └─ AdminPage.jsx  (~90 KB, tab-driven SPA)
```

### Flow: Community Report Queue

```
AdminPage → "Moderation" tab
  └─ GET /api/admin/community/reports?status=open&limit=50
       [verifyToken, requireRole('admin')]
       └─ adminController.getCommunityReports()
            └─ adminService.listCommunityReports()
                 └─ CommunityModel.listReports()
                      joined: post, reply, reporter user, resolver user

Admin reviews → takes action:

  PATCH /api/admin/community/posts/:id   { status: 'removed'|'active' }
    └─ adminService.moderateCommunityPost({ postId, adminUserId, status })
         ├─ CommunityModel.updatePost(postId, { status })
         └─ CommunityModel.resolveOpenReportsForPost()  → auto-close reports

  PATCH /api/admin/community/replies/:id { status: 'removed'|'active' }
    └─ similar for replies

  PATCH /api/admin/community/reports/:id { status: 'resolved'|'dismissed' }
    └─ adminService.resolveCommunityReport()
         └─ CommunityModel.updateReport()
```

### Flow: User Management

```
AdminPage → "Users" tab
  GET /api/admin/users
    └─ adminService.listUsers() → all users + profile + storage stats

  PATCH /api/admin/users/:id
    { status: 'active'|'disabled' }  OR  { storage_limit_bytes: N }
    └─ adminService.updateUser({ targetUserId, updates, currentUserId })
         ├─ guard: cannot disable yourself
         └─ userModel.update()
```

### Flow: Subject Management

```
AdminPage → "Subjects" tab
  GET    /api/admin/subjects           → list + doc counts
  POST   /api/admin/subjects           → create { name, code, description }
  PATCH  /api/admin/subjects/:id       → update
  DELETE /api/admin/subjects/:id       → delete (blocked if docs assigned)
```

### Flow: Overview Dashboard

```
GET /api/admin/overview
  └─ adminService.getOverview()
       → aggregate: user count, doc count, community posts, open reports
       → time-series data for charts
```

### Key Files
| Layer | File |
|---|---|
| Frontend page | `frontend/src/pages/AdminPage.jsx` |
| Route guard | `frontend/src/components/AdminRoute.jsx` |
| Backend routes | `backend/src/routes/admin.routes.js` |
| Controller | `backend/src/controllers/admin.controller.js` |
| Admin service | `backend/src/services/admin.service.js` |
| Community model | `backend/src/models/community.model.js` |

---

## 5. Public Docs Space

### Overview
A catalog of documents where `is_public = true`. No auth needed to browse. Auth required only to post a comment/rating.

### Frontend Entry Points
| Route | Auth | Page |
|---|---|---|
| `/public-documents` | ProtectedRoute | `PublicDocumentsCatalogPage.jsx` |
| `/public-documents/:id` | ProtectedRoute | `PublicDocumentDetailPage.jsx` |

> Backend API itself has no token requirement. ProtectedRoute is frontend-only UX choice.

### Flow: Browsing the Catalog

```
PublicDocumentsCatalogPage.jsx
  └─ GET /api/public/documents
       ?search=&subjectId=&sortBy=views|recent|rating&page=1&limit=12
       └─ public.routes.js  (no auth middleware)
       └─ publicController.searchPublicDocuments()
            └─ publicService.searchPublicDocuments()
                 └─ documentModel:
                      .eq('is_public', true)
                      .ilike('title', '%search%')
                      .order(sortBy)
                      .range(offset, offset+limit)
                 returns paginated docs: thumbnail, subject, view_count, avg_rating

  GET /api/public/documents/trending
       └─ publicService.getTrendingDocuments(limit)
            → top docs by view_count
```

### Flow: Document Detail Page

```
PublicDocumentDetailPage.jsx
  └─ GET /api/public/documents/:id
       └─ publicService.getPublicDocumentById(id)
            └─ documentModel.findAccessibleById(id, userId=null)
                 → checks is_public = true (no user needed)
                 → increments view_count
            returns doc metadata + AI overview + stats

  GET /api/public/documents/:id/signed-url
       └─ publicService.getPublicDocumentSignedUrl(id)
            └─ supabase.storage.createSignedUrl() → time-limited URL

  GET /api/public/documents/:id/comments
       └─ publicService.listDocumentComments(id)
            → comments sorted by created_at

  POST /api/public/documents/:id/comments   [verifyToken required]
       { content, rating: 1-5 }
       └─ publicService.createDocumentComment({ docId, userId, content, rating })
            → insert into document_comments
```

### Access Control Detail

```javascript
// document.model.js → findAccessibleById(id, userId)
if (doc.user_id === userId)  → owner, always OK
if (doc.is_public === true)  → public, accessible even with userId=null
else                          → throw 403
```

### Key Files
| Layer | File |
|---|---|
| Catalog page | `frontend/src/pages/PublicDocumentsCatalogPage.jsx` |
| Detail page | `frontend/src/pages/PublicDocumentDetailPage.jsx` |
| Backend routes | `backend/src/routes/public.routes.js` |
| Controller | `backend/src/controllers/public.controller.js` |
| Service | `backend/src/services/public.service.js` |
| Document model | `backend/src/models/document.model.js` |

---

## Global Architecture Snapshot

```
Browser (React / Vite)
  │
  ├─ AuthContext      → Supabase session + /api/auth/me sync
  ├─ PreferencesContext
  ├─ ToastContext
  └─ UploadDocContext
       │  HTTP (axios) + Bearer token
       ▼
Express.js  (backend/src/app.js)
  │
  ├─ /api/public/*     → No auth  (community feed, public docs, trending)
  ├─ /api/auth/*       → verifyToken
  ├─ /api/community/*  → verifyToken + requireRole('user','admin')
  ├─ /api/ai/*         → verifyToken
  ├─ /api/workspace/*  → verifyToken + requireRole('user','admin')
  └─ /api/admin/*      → verifyToken + requireRole('admin')
       │
       ├─ middleware/auth.js      → local JWT exp check → Supabase verify → syncUserProfile
       └─ middleware/requireRole  → role gate
            │
            ▼
       Controllers → Services → Models → Supabase Postgres
                                       → Supabase Storage
                                       → Gemini API
                                       → Ollama (local)
```

---

*Last updated: 2026-06-29 | Author: QuangD300504*
