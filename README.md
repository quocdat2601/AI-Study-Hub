# AI Study Hub

AI Study Hub is a comprehensive, intelligent learning platform designed to elevate the studying experience. By leveraging advanced Retrieval-Augmented Generation (RAG) and modern web technologies, the platform allows users to manage, read, and interact with their educational materials through an AI-powered conversational interface.

## Key Features

- **Intelligent Document Workspace:** A highly responsive, split-view workspace allowing users to read documents (PDF, DOCX, TXT) side-by-side with an AI assistant or extracted text views.
- **RAG-Powered AI Chatbot:** Talk directly to your documents. The system chunks, embeds (using pgvector), and retrieves document context to provide highly accurate, contextual answers using Gemini and Ollama models.
- **Community & Collaboration:** Share documents, notes, and study materials with the community. Discover resources uploaded by other users.
- **Course & Subject Management:** Organized content structures allowing users to browse and manage materials categorized by subjects and courses.
- **Role-Based Access Control:** Secure authentication with distinct roles (Admin, User) for robust platform moderation and access management.
- **Cloud Storage Integration:** Seamlessly handles document uploads and serving via Supabase Storage.

## Tech Stack

### Frontend
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **State Management & Routing:** React Context, React Router
- **PDF/Doc Viewers:** Custom integrated iframes and canvas-based viewers

### Backend
- **Framework:** Node.js with Express.js (MVC Architecture)
- **Database:** Supabase (PostgreSQL)
- **Vector Search:** `pgvector` for semantic document retrieval
- **AI Integration:** Google Gemini API & Ollama for local LLM inference

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- A [Supabase](https://supabase.com/) account and project
- Google Gemini API Key

## Getting Started

### 1. Backend Setup

Navigate to the backend directory, configure your environment variables, and start the server:

```bash
cd backend
cp .env.example .env
# Edit the .env file with your Supabase credentials and Gemini API Key
npm install
npm run dev
```

The API will be available at `http://localhost:5000/api/health`.

### 2. Frontend Setup

Navigate to the frontend directory, configure the environment, and start the development server:

```bash
cd frontend
cp .env.example .env
# Edit the .env file with your Backend API URL
npm install
npm run dev
```

Open the Vite local URL shown in your terminal to view the application.

## Database Migrations

The database schema and RLS policies are managed via Supabase SQL Editor. Execute the migrations in the following order:

1. `backend/db/migrations/001_initial_schema.sql`
2. `backend/db/migrations/002_enable_rls.sql`

To seed the initial Admin account, first generate a bcrypt hash for the password, update the script, and then run:

3. `backend/db/migrations/003_seed_admin.sql`

## Security Notes

- **Environment Variables:** Never commit `.env` files to version control. Always use `.env.example` to document required variables.
- **Row Level Security (RLS):** Ensure RLS policies in Supabase remain enabled to protect user data.
