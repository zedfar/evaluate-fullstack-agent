# Backend (NestJS API)

NestJS backend for AI chat application with demo mode, file management, conversation handling, and AI streaming integration.

## Features

- **Demo Mode** - Chat publik tanpa login menggunakan demo user
- **AI Chat Streaming** - Real-time streaming chat dengan AI Engine
- **File Upload & RAG** - Upload dokumen untuk context-aware AI responses
- **Conversation Management** - Create, read, update, delete conversations
- **Public Preview** - Share conversations via public links
- **Rate Limiting** - Protection dari spam dan abuse
- **Redis Caching** - Fast response dengan intelligent caching
- **Health Monitoring** - System health checks dan cache statistics
- **Swagger API Docs** - Interactive API documentation

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (Neon)
- **Cache**: Redis
- **File Storage**: Vercel Blob Storage
- **Logger**: Pino (rotating file logs)
- **Validation**: class-validator & class-transformer
- **API Docs**: Swagger/OpenAPI

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your database and service credentials

# 3. Start development server
npm run start:dev
# Runs on http://localhost:3000
# API docs: http://localhost:3000/api
```

## Prerequisites

- **Node.js**: 20.19.5 (via Volta)
- **npm**: 10.x
- **PostgreSQL**: 14+ (local or Neon)
- **Redis**: 6+ (local or Redis Cloud)
- **AI Engine**: FastAPI agent running on port 8000
- **Vercel Blob**: For file storage (or alternative)

## Environment Configuration

Create `.env` file (see `.env.example` for all options):

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

# Server
PORT=3001
NODE_ENV=development

# AI Engine
AI_ENGINE_URL=http://localhost:8000

# CORS
ALLOWED_ORIGINS=http://localhost:5178

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_token_here

# Demo Mode (optional)
DEMO_USER_ID=
```

## Installation

```bash
npm install
```

## Running the Application

### Development

```bash
npm run start:dev
```

Server starts on `http://localhost:3000`
- API Documentation: `http://localhost:3000/api`
- Hot reload enabled
- TypeORM auto-sync (development only)

### Production

```bash
# Build
npm run build

# Start
npm run start:prod
```

## API Documentation

Once the server is running, access the interactive API documentation at:

```
http://localhost:3001/api
```

Swagger UI provides:
- Complete API endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Example requests

## Project Structure

```
backend/
├── src/
│   ├── ai-gateway/         # AI Engine integration & streaming
│   ├── cache/              # Cache management & monitoring
│   ├── chat/               # Chat service (conversations, messages)
│   ├── common/             # Shared utilities, filters, guards
│   ├── demo/               # Demo mode endpoints
│   ├── health/             # Health check endpoints
│   ├── preview/            # Public conversation preview
│   ├── rate-limit/         # Rate limiting service
│   ├── storage/            # Blob storage service
│   ├── stream/             # Stream lifecycle management
│   ├── app.module.ts       # Root module
│   └── main.ts             # Application entry point
├── logs/                   # Application logs (auto-created)
├── dist/                   # Compiled output
├── .env                    # Environment variables (not in git)
└── package.json
```

## Key Modules

### Demo Module (`/demo/*`)
- Public endpoints for demo chat
- No authentication required
- Rate-limited for protection
- Limited to 10 conversations per demo user

### AI Gateway Module
- Streams AI responses from Python backend
- Handles connection timeouts & retries
- Auto-generates conversation titles
- Cache invalidation after responses

### Cache Module (`/api/cache/*`)
- Redis cache statistics
- Health monitoring
- Pattern-based cache invalidation
- Cache reset (admin use)

### Preview Module (`/preview/:id`)
- Public conversation sharing
- Cached for performance
- Read-only access

## Database Schema

Key entities:
- `chat_conversations` - User conversations
- `chat_messages` - Messages in conversations
- `uploaded_files` - File metadata & Blob URLs

TypeORM will auto-sync schema in development mode.

## Logging

Logs are written to:
- `logs/application.log` - All logs (rotated daily, kept 7 days)
- `logs/error.log` - Error logs only (rotated daily, kept 30 days)
- Console (development only, pretty-printed)

## Rate Limiting

All endpoints are rate-limited to prevent abuse:
- Chat messages: 60 per minute
- File uploads: 10 per minute
- Conversation creation: 20 per minute
- General API: 100 per minute

Limits are tracked per IP address in Redis.

## Caching Strategy

Redis is used for:
- Conversation lists (5 minutes TTL)
- Conversation details (10 minutes TTL)
- Message history (10 minutes TTL)
- File metadata (1 hour TTL)
- Rate limit counters
- Stream tracking

Cache automatically falls back to in-memory if Redis is unavailable.

## File Upload

Supported file types:
- PDF (`.pdf`)
- Word Documents (`.doc`, `.docx`)
- Text (`.txt`, `.md`, `.csv`)
- Images (`.png`, `.jpg`)

Files are:
1. Validated for type and size
2. Uploaded to Vercel Blob Storage
3. Processed by AI Engine for RAG
4. Stored in PostgreSQL with metadata

Max file size: 2MB (demo mode: 500KB)

## Health Endpoints

### GET `/health`
Basic health check

### GET `/api/cache/health`
Redis cache health status

### GET `/api/cache/stats`
Detailed cache and system statistics

## Error Handling

- All errors are logged via Pino
- User-friendly error messages
- HTTP status codes follow REST conventions
- Validation errors include field details

## Security Features

- **CORS**: Whitelist-based origins
- **Rate Limiting**: Redis-backed rate limits
- **Input Validation**: All DTOs validated
- **File Upload**: Type and size restrictions
- **SQL Injection**: Protected by TypeORM parameterized queries
- **XSS**: Output sanitization via NestJS

## Deployment

### Environment Setup

1. Provision PostgreSQL database (Neon recommended)
2. Provision Redis instance (Redis Cloud recommended)
3. Setup Vercel Blob Storage
4. Deploy AI Engine backend
5. Set all environment variables

### Build & Deploy

```bash
# Install production dependencies
npm ci --production

# Build application
npm run build

# Start production server
npm run start:prod
```

### Recommended Platforms

- **Vercel**: Serverless deployment
- **Railway**: Container deployment
- **Heroku**: Platform as a Service
- **AWS**: ECS/EC2

### Health Checks

Configure platform health check to:
```
GET /health
Expected: 200 OK
```

## Monitoring

Monitor these metrics:
- Response times
- Cache hit rates (via `/api/cache/stats`)
- Error rates in logs
- Rate limit violations
- Database connection pool
- Redis connection status

## Troubleshooting

### Redis Connection Issues
Backend falls back to in-memory cache. Check:
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Redis server is running and accessible
- Firewall rules allow connection

### Database Connection Issues
Check:
- Database credentials in `.env`
- SSL settings (`ssl: { rejectUnauthorized: false }`)
- Database is running and accessible

### File Upload Failures
Check:
- `BLOB_READ_WRITE_TOKEN` is set and valid
- File size within limits
- AI Engine is running and accessible

### AI Streaming Issues
Check:
- `AI_ENGINE_URL` is correct and accessible
- AI Engine is running
- Network timeout settings

## Development

### Code Style

```bash
# Lint and auto-fix
npm run lint
```

### Database Sync

TypeORM auto-syncs in development:
```typescript
synchronize: config.get('NODE_ENV') === 'development'
```

**⚠️ Never use `synchronize: true` in production!**

## License

MIT

## Support

For issues and questions:
- Check logs in `logs/` directory
- Review API docs at `/api`
- Check environment variables
- Verify external services (DB, Redis, AI Engine) are accessible
