# AI Study Hub Starter

Starter codebase for SWP391 AI Study Hub.

## Structure

```txt
ai-study-hub/
  backend/   Express MVC API
  frontend/  React + Vite app
  docs/      project documents
```

## First setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Then open:

```txt
http://localhost:5000/api/health
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Then open the Vite URL shown in terminal.

## Supabase

Use Supabase SQL Editor to run:

```txt
backend/db/migrations/001_initial_schema.sql
backend/db/migrations/002_enable_rls.sql
```

Admin seeding is separate. Generate a bcrypt hash first, then edit and run:

```txt
backend/db/migrations/003_seed_admin.sql
```

## Important security rule

Never commit `.env` files. Only commit `.env.example`.
