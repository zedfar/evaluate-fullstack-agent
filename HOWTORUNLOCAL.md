# How to Run Locally - Complete Setup Guide

This guide will walk you through setting up and running the entire full-stack AI chat application on your local machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Install Dependencies](#install-dependencies)
4. [Setup Services](#setup-services)
5. [Configure Environment Variables](#configure-environment-variables)
6. [Initialize Database](#initialize-database)
7. [Run the Application](#run-the-application)
8. [Verify Installation](#verify-installation)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|-------------|
| **Node.js** | 20.19.5 | Frontend & Backend | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.10+ | AI Agent | [python.org](https://www.python.org/) |
| **PostgreSQL** | 14+ | Main Database | [postgresql.org](https://www.postgresql.org/) |
| **Redis** | 6+ | Caching & Rate Limiting | [redis.io](https://redis.io/) |
| **Qdrant** | Latest | Vector Database | [qdrant.tech](https://qdrant.tech/) |
| **Git** | Latest | Version Control | [git-scm.com](https://git-scm.com/) |

### Optional Software

| Software | Purpose | Installation |
|----------|---------|-------------|
| **Tesseract OCR** | Image text extraction | [github.com/tesseract-ocr](https://github.com/tesseract-ocr/tesseract) |
| **Docker** | Container services | [docker.com](https://www.docker.com/) |
| **Volta** | Node version manager | [volta.sh](https://volta.sh/) |

---

## System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 10 GB free space
- OS: Linux, macOS, or Windows 10/11

**Recommended:**
- CPU: 8 cores
- RAM: 16 GB
- Disk: 20 GB free space
- SSD storage for better performance

---

## Install Dependencies

### 1. Install Node.js (via Volta - Recommended)

```bash
# Install Volta
curl https://get.volta.sh | bash

# Install Node.js (version managed by project)
volta install node@20.19.5
volta install npm
```

**Or install Node.js directly:**
- Download from [nodejs.org](https://nodejs.org/)
- Install version 20.19.5 (LTS)

### 2. Install Python

```bash
# macOS (via Homebrew)
brew install python@3.11

# Ubuntu/Debian
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip

# Windows
# Download from python.org and install
```

Verify installation:
```bash
python3 --version  # Should be 3.10 or higher
node --version     # Should be v20.19.5
npm --version      # Should be 10.x
```

### 3. Install PostgreSQL

#### Option A: Local Installation

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
- Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
- Run installer and follow instructions
- Remember the password you set for the postgres user

#### Option B: Docker

```bash
docker run -d \
  --name postgres-agentic \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=agentic_db \
  -p 5432:5432 \
  postgres:14
```

### 4. Install Redis

#### Option A: Local Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Windows:**
- Download from [github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases)
- Or use WSL2 with Linux installation

#### Option B: Docker

```bash
docker run -d \
  --name redis-agentic \
  -p 6379:6379 \
  redis:latest
```

Verify Redis:
```bash
redis-cli ping
# Should return: PONG
```

### 5. Install Qdrant (Vector Database)

#### Option A: Docker (Recommended)

```bash
docker run -d \
  --name qdrant-agentic \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

#### Option B: Local Binary

```bash
# Download and extract
wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz

# Run
./qdrant
```

Verify Qdrant:
```bash
curl http://localhost:6333/collections
# Should return: {"result":{"collections":[]},"status":"ok","time":0.000}
```

### 6. Install Tesseract OCR (Optional)

Required for image text extraction in AI agent.

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install tesseract-ocr
```

**Windows:**
- Download from [github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
- Add to PATH

Verify:
```bash
tesseract --version
```

---

## Setup Services

### 1. Clone Repository

```bash
git clone <repository-url>
cd evaluate-fullstack-agent
```

### 2. Install Project Dependencies

#### Backend (NestJS)
```bash
cd backend
npm install
cd ..
```

#### Frontend (React)
```bash
cd frontend
npm install
cd ..
```

#### AI Agent (Python)
```bash
cd agent
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

---

## Configure Environment Variables

### 1. Agent (AI Engine)

```bash
cd agent
cp .env.example .env
```

Edit `agent/.env`:

```env
# Server
HOST=0.0.0.0
PORT=8000

# Model Provider ('local' or 'claude')
DEFAULT_MODEL_PROVIDER=local

# Local Model (if using local LLM)
LOCAL_MODEL_URL=http://localhost:8787/v1
LOCAL_MODEL_NAME=gpt-oss-20b
LOCAL_MODEL_API_KEY=

# Claude (if using Anthropic)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# OpenAI (optional fallback)
OPENAI_API_KEY=your_openai_api_key_here

# Embeddings
EMBEDDING_PROVIDER=local
EMBEDDING_BASE_URL=http://localhost:8142/v1
EMBEDDING_MODEL=bge-m3
EMBEDDING_DIMENSION=1024
EMBEDDING_API_KEY=

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1
REDIS_TTL=3600
ENABLE_CACHE=true

# RAG Settings
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K_RETRIEVAL=5
RAG_SCORE_THRESHOLD=0.7

# File Upload
MAX_FILE_SIZE=2097152
ALLOWED_FILE_TYPES=pdf,docx,doc,csv,txt,png,jpg,jpeg
UPLOAD_DIR=/tmp/uploads

# Logging
LOG_LEVEL=INFO
ENABLE_REQUEST_LOGGING=true
```

### 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=agentic_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=300

# Cache TTL (seconds)
CACHE_TTL_CONVERSATION=600
CACHE_TTL_CONVERSATION_LIST=300
CACHE_TTL_MESSAGES=600
CACHE_TTL_FILES=3600

# Rate Limiting
RATE_LIMIT_CHAT_MESSAGE=60
RATE_LIMIT_CHAT_MESSAGE_WINDOW=60
RATE_LIMIT_CHAT_CREATE=20
RATE_LIMIT_CHAT_CREATE_WINDOW=60
RATE_LIMIT_FILE_UPLOAD=10
RATE_LIMIT_FILE_UPLOAD_WINDOW=60
RATE_LIMIT_API_GENERAL=100
RATE_LIMIT_API_GENERAL_WINDOW=60

# Server
PORT=3000
NODE_ENV=development

# AI Engine
AI_ENGINE_URL=http://localhost:8000

# CORS
ALLOWED_ORIGINS=http://localhost:5178,http://localhost:3000

# Vercel Blob (optional - for file storage)
BLOB_READ_WRITE_TOKEN=

# Demo Mode (optional)
DEMO_USER_ID=
```

### 3. Frontend (React)

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000

# Server Port (production)
PORT=5178
```

---

## Initialize Database

### 1. Create PostgreSQL Database

```bash
# Using psql
psql -U postgres

# In psql prompt:
CREATE DATABASE agentic_db;
\q
```

**Or using createdb:**
```bash
createdb -U postgres agentic_db
```

### 2. Verify Database

```bash
psql -U postgres -d agentic_db -c "SELECT version();"
```

### 3. Database Schema

The NestJS backend will automatically create tables on first run (TypeORM synchronize is enabled in development mode).

**Important:** Tables will be auto-created when you start the backend for the first time.

---

## Run the Application

You'll need **three terminal windows/tabs** to run all services simultaneously.

### Terminal 1: AI Agent (Python FastAPI)

```bash
cd agent
source venv/bin/activate  # Windows: venv\Scripts\activate
python main.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**Access:**
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Terminal 2: Backend (NestJS)

```bash
cd backend
npm run start:dev
```

**Expected output:**
```
[Nest] 12345  - LOG [NestFactory] Starting Nest application...
[Nest] 12345  - LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - LOG [NestApplication] Nest application successfully started
[Nest] 12345  - LOG Application is running on: http://localhost:3000
```

**Access:**
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api
- Health: http://localhost:3000/health

### Terminal 3: Frontend (React)

```bash
cd frontend
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5178/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Access:**
- Frontend: http://localhost:5178

---

## Verify Installation

### 1. Check All Services

Run these commands in separate terminal windows:

```bash
# Check AI Agent
curl http://localhost:8000/health
# Expected: {"status":"healthy"}

# Check Backend
curl http://localhost:3000/health
# Expected: {"status":"healthy"}

# Check Frontend
curl http://localhost:5178
# Expected: HTML content

# Check PostgreSQL
psql -U postgres -d agentic_db -c "SELECT 1;"
# Expected: (1 row)

# Check Redis
redis-cli ping
# Expected: PONG

# Check Qdrant
curl http://localhost:6333/collections
# Expected: {"result":{"collections":[]},"status":"ok","time":0.000}
```

### 2. Test the Application

1. Open browser: http://localhost:5178
2. You should see the AI chat interface
3. Try sending a message
4. Try uploading a file (PDF, DOCX, etc.)
5. Check that responses stream in real-time

### 3. Check Logs

- **AI Agent**: Check terminal for request logs
- **Backend**: Check `backend/logs/application.log`
- **Frontend**: Check browser console (F12)

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:** `Address already in use` or `EADDRINUSE`

**Solution:**
```bash
# Find process using port
lsof -i :8000  # AI Agent
lsof -i :3000  # Backend
lsof -i :5178  # Frontend

# Kill process
kill -9 <PID>

# Or change port in .env files
```

#### 2. Database Connection Failed

**Error:** `ECONNREFUSED` or `Connection refused`

**Check:**
```bash
# Is PostgreSQL running?
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Start if not running
brew services start postgresql        # macOS
sudo systemctl start postgresql       # Linux

# Test connection
psql -U postgres -d agentic_db
```

**Common fixes:**
- Check DATABASE_HOST, DATABASE_PORT in backend/.env
- Verify password is correct
- Ensure database exists: `psql -U postgres -l`
- Check firewall settings

#### 3. Redis Connection Failed

**Error:** `ECONNREFUSED` on Redis port

**Check:**
```bash
# Is Redis running?
redis-cli ping

# Start if not running
brew services start redis             # macOS
sudo systemctl start redis            # Linux
docker start redis-agentic            # Docker
```

**Fixes:**
- Check REDIS_HOST, REDIS_PORT in .env files
- Verify Redis is accessible: `redis-cli -h localhost -p 6379 ping`
- If using password, check REDIS_PASSWORD

#### 4. Qdrant Connection Failed

**Error:** `Failed to connect to Qdrant`

**Check:**
```bash
# Is Qdrant running?
curl http://localhost:6333/collections

# If using Docker
docker ps | grep qdrant
docker start qdrant-agentic
```

**Fixes:**
- Check QDRANT_URL in agent/.env
- Ensure port 6333 is not blocked
- Restart Qdrant container/process

#### 5. AI Agent Import Errors

**Error:** `ModuleNotFoundError: No module named 'xxx'`

**Solution:**
```bash
cd agent
source venv/bin/activate
pip install -r requirements.txt --upgrade
```

#### 6. Backend Build Errors

**Error:** TypeScript compilation errors

**Solution:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 7. Frontend Build Errors

**Error:** `Module not found` or Vite errors

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json .vite
npm install
npm run dev
```

#### 8. File Upload Fails

**Possible causes:**
- File too large (default max: 2MB for agent)
- Invalid file type
- Vercel Blob token not configured (backend)
- Qdrant not running (agent can't store vectors)

**Fixes:**
- Check file size and type
- Verify Qdrant is running
- Check agent logs for embedding errors
- Verify BLOB_READ_WRITE_TOKEN if using Vercel Blob

#### 9. Streaming Responses Not Working

**Possible causes:**
- AI Engine not running
- Incorrect AI_ENGINE_URL in backend
- Network/CORS issues

**Fixes:**
```bash
# Check AI Engine is running
curl http://localhost:8000/health

# Check backend can reach AI Engine
cd backend
curl http://localhost:8000/api/v1/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Check CORS settings in both services
```

#### 10. Tesseract OCR Errors (Image Upload)

**Error:** `TesseractNotFoundError`

**Solution:**
```bash
# Install Tesseract
brew install tesseract           # macOS
sudo apt install tesseract-ocr   # Linux

# Verify
tesseract --version
```

### Performance Issues

#### Slow Responses

1. **Enable Redis caching** (should be enabled by default)
2. **Check cache hit rates:** http://localhost:8000/docs → check logs
3. **Reduce TOP_K_RETRIEVAL** in agent/.env (default: 5)
4. **Use local model** instead of API-based models for faster responses

#### High Memory Usage

1. **Reduce CHUNK_SIZE** in agent/.env (default: 1000)
2. **Limit concurrent requests** via rate limiting
3. **Monitor Redis memory:** `redis-cli info memory`
4. **Clear Redis cache if needed:** `redis-cli FLUSHDB`

### Getting Help

If you're still experiencing issues:

1. **Check logs:**
   - Agent: Terminal output
   - Backend: `backend/logs/application.log`
   - Frontend: Browser console

2. **Enable debug logging:**
   ```env
   # agent/.env
   LOG_LEVEL=DEBUG

   # backend/.env
   NODE_ENV=development
   ```

3. **Check service status:**
   ```bash
   # All services health check
   curl http://localhost:8000/health  # Agent
   curl http://localhost:3000/health  # Backend
   curl http://localhost:5178         # Frontend
   ```

4. **Review documentation:**
   - [Agent README](./agent/README.md)
   - [Backend README](./backend/README.md)
   - [Frontend README](./frontend/README.md)

---

## Next Steps

Once everything is running successfully:

1. **Explore the API:**
   - Backend: http://localhost:3000/api
   - AI Agent: http://localhost:8000/docs

2. **Test features:**
   - Create a conversation
   - Upload a document
   - Ask questions about the document
   - Try different AI models

3. **Development:**
   - Read component READMEs for detailed info
   - Check code structure
   - Review environment variables
   - Understand the architecture

4. **Production deployment:**
   - See [README.md](./README.md) for deployment options
   - Configure production environment variables
   - Setup cloud services (Neon, Redis Cloud, Qdrant Cloud)
   - Deploy to platforms like Railway, Vercel, AWS

---

## Quick Reference

### Service URLs

| Service | Development URL | Documentation |
|---------|----------------|---------------|
| Frontend | http://localhost:5178 | - |
| Backend API | http://localhost:3000 | http://localhost:3000/api |
| AI Agent | http://localhost:8000 | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 | - |
| Redis | localhost:6379 | - |
| Qdrant | localhost:6333 | http://localhost:6333/dashboard |

### Useful Commands

```bash
# Start all services (requires 3 terminals)
cd agent && source venv/bin/activate && python main.py
cd backend && npm run start:dev
cd frontend && npm run dev

# Check service health
curl http://localhost:8000/health  # Agent
curl http://localhost:3000/health  # Backend

# Database operations
psql -U postgres -d agentic_db                    # Connect to DB
psql -U postgres -d agentic_db -c "\dt"           # List tables
psql -U postgres -d agentic_db -c "SELECT * FROM chat_conversations LIMIT 5;"

# Redis operations
redis-cli                          # Connect to Redis
redis-cli KEYS "*"                 # List all keys
redis-cli FLUSHDB                  # Clear current DB
redis-cli INFO memory              # Memory usage

# Qdrant operations
curl http://localhost:6333/collections                    # List collections
curl http://localhost:6333/collections/{collection_name}  # Collection info

# Clean restart
# Stop all services (Ctrl+C in each terminal)
# Then restart in order: Agent → Backend → Frontend
```

---

**Happy coding!**
