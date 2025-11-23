# Agentic AI Demo - Full Stack Application

A complete full-stack AI chat application with RAG (Retrieval-Augmented Generation) capabilities, featuring a React frontend, NestJS backend, and FastAPI AI engine powered by LangGraph.

## Architecture Overview

This project consists of three main components:

```
┌─────────────────┐
│   Frontend      │  React + TypeScript + Vite
│   Port: 5178    │  UI for AI chat interface
└────────┬────────┘
         │ HTTP/REST
         ↓
┌─────────────────┐
│    Backend      │  NestJS + TypeORM + PostgreSQL
│   Port: 3000    │  API Gateway, Auth, File Management
└────────┬────────┘
         │ HTTP/REST
         ↓
┌─────────────────┐
│   AI Agent      │  FastAPI + LangGraph + RAG
│   Port: 8000    │  AI Engine, Vector Search, Document Processing
└─────────────────┘

Supporting Services:
- PostgreSQL: Main database
- Redis: Caching & rate limiting
- Qdrant: Vector database for RAG
```

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router DOM
- **HTTP Client**: Axios

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis
- **File Storage**: Vercel Blob Storage
- **API Docs**: Swagger/OpenAPI

### AI Agent
- **Framework**: FastAPI (Python)
- **AI Framework**: LangGraph + LangChain
- **Vector DB**: Qdrant
- **Models**: Claude 3.5 Sonnet, GPT-4, Local Models
- **RAG**: Document processing with embeddings
- **Cache**: Redis

## Prerequisites

- **Node.js**: 20.19.5 (managed via Volta)
- **Python**: 3.11+
- **PostgreSQL**: 14+
- **Redis**: 6+
- **Qdrant**: Latest (for vector search)
- **npm** or **yarn**
- **pip** for Python packages

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd evaluate-fullstack-agent
```

### 2. Setup Environment Variables

Copy the example environment files and configure them:

```bash
# Agent (AI Engine)
cp agent/.env.example agent/.env
# Edit agent/.env with your API keys and configuration

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with database and Redis credentials

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with backend URL
```

### 3. Setup PostgreSQL Database

```bash
# Create database
createdb agentic_db

# Or using psql
psql -U postgres
CREATE DATABASE agentic_db;
```

### 4. Setup Redis

```bash
# Install and start Redis
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

### 5. Setup Qdrant (Vector Database)

```bash
# Using Docker (recommended)
docker run -p 6333:6333 qdrant/qdrant

# Or download and run locally
# See https://qdrant.tech/documentation/quick-start/
```

### 6. Install Dependencies

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# Agent
cd agent
pip install -r requirements.txt
cd ..
```

### 7. Run the Application

Open three terminal windows/tabs:

**Terminal 1 - AI Agent:**
```bash
cd agent
python main.py
# Runs on http://localhost:8000
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run start:dev
# Runs on http://localhost:3000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5178
```

### 8. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5178
- **Backend API**: http://localhost:3000
- **Backend Swagger Docs**: http://localhost:3000/api
- **AI Agent**: http://localhost:8000
- **AI Agent Docs**: http://localhost:8000/docs

## Development

### Backend Development

```bash
cd backend
npm run start:dev    # Start with hot reload
npm run build        # Build for production
npm run lint         # Lint code
```

### Frontend Development

```bash
cd frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint code
```

### Agent Development

```bash
cd agent
python main.py       # Start server
# The server will auto-reload on file changes in development
```

## Production Build

### Backend

```bash
cd backend
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm run build
npm start  # Runs production Express server
```

### Agent

```bash
cd agent
# Set production environment variables
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Deployment

Each component can be deployed independently:

### Recommended Platforms

- **Frontend**: Vercel, Netlify, Railway
- **Backend**: Railway, Heroku, AWS ECS, DigitalOcean
- **Agent**: Railway, Heroku, AWS ECS, Google Cloud Run
- **PostgreSQL**: Neon, Supabase, Railway, AWS RDS
- **Redis**: Upstash, Redis Cloud, Railway
- **Qdrant**: Qdrant Cloud, Self-hosted

### Docker Deployment

Dockerfiles are provided for each component:

```bash
# Build images
docker build -t ai-agent ./agent
docker build -t backend ./backend
docker build -t frontend ./frontend

# Run with docker-compose (if configured)
docker-compose up
```

## Project Structure

```
evaluate-fullstack-agent/
├── agent/              # AI Engine (Python/FastAPI)
│   ├── app/
│   │   ├── api/       # API routes
│   │   ├── services/  # Business logic
│   │   ├── models/    # Data models
│   │   └── config.py  # Configuration
│   ├── main.py
│   ├── requirements.txt
│   └── README.md
├── backend/           # API Backend (NestJS)
│   ├── src/
│   │   ├── modules/   # Feature modules
│   │   ├── entities/  # TypeORM entities
│   │   └── common/    # Shared utilities
│   ├── package.json
│   └── README.md
├── frontend/          # Web UI (React)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── stores/
│   ├── package.json
│   └── README.md
└── README.md          # This file
```

## Features

- AI-powered chat with streaming responses
- File upload and processing (PDF, DOCX, images, etc.)
- RAG (Retrieval-Augmented Generation) for document-based Q&A
- Multiple AI model support (Claude, GPT-4, local models)
- Vector search with Qdrant
- Redis caching for performance
- Rate limiting and security
- Real-time chat interface
- Markdown rendering with syntax highlighting
- User authentication (if configured)
- Conversation history
- File preview and management

## Configuration

### Agent Configuration

Key configuration in `agent/.env`:
- AI model selection (Claude/GPT/Local)
- Qdrant vector database
- Redis caching
- RAG parameters
- File upload limits

### Backend Configuration

Key configuration in `backend/.env`:
- PostgreSQL database
- Redis cache and rate limiting
- CORS origins
- File storage (Vercel Blob)
- AI Engine URL

### Frontend Configuration

Key configuration in `frontend/.env`:
- Backend API URL
- Server port

## Environment Variables

See `.env.example` files in each directory for detailed configuration options:
- [agent/.env.example](agent/.env.example)
- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

## API Documentation

- **Backend API**: Available at `/api` (Swagger UI)
- **AI Agent API**: Available at `/docs` (FastAPI auto-docs)

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check database credentials in `backend/.env`
- Verify database exists: `psql -l`

### Redis Connection Issues
- Ensure Redis is running: `redis-cli ping`
- Check Redis credentials in `.env` files

### Qdrant Connection Issues
- Ensure Qdrant is running on port 6333
- Check Qdrant URL in `agent/.env`

### Port Already in Use
```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9  # Backend
lsof -ti:5178 | xargs kill -9  # Frontend
lsof -ti:8000 | xargs kill -9  # Agent
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For issues and questions:
- Check individual component READMEs
- Review API documentation
- Check logs in each service

## Acknowledgments

- Built with LangGraph and LangChain
- Powered by Claude 3.5 Sonnet (Anthropic)
- Vector search by Qdrant
- Database by PostgreSQL
- Caching by Redis
