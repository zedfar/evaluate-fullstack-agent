# Agentic AI Demo Backend

> Simple demo backend for AI chat application - Public sample mode (No authentication)

Backend NestJS untuk aplikasi AI chat dengan mode demo publik. Backend ini dirancang untuk demonstrasi dan tidak memerlukan sistem autentikasi pengguna.

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

## Prerequisites

- **Node.js**: 20.19.5 (managed by Volta)
- **npm**: 10.x
- **PostgreSQL**: 14+ (Neon serverless database)
- **Redis**: 6+ (Redis Cloud)
- **AI Engine**: Python backend for AI processing

## Installation

```bash
# Install dependencies
npm install

# Build the application
npm run build
```

## Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Database (PostgreSQL - Neon)
DATABASE_HOST=your-neon-host.aws.neon.tech
DATABASE_PORT=5432
DATABASE_USER=neondb_owner
DATABASE_PASSWORD=your-database-password
DATABASE_NAME=agentic_db

# Redis Cache
REDIS_HOST=your-redis-host.cloud.redislabs.com
REDIS_PORT=13113
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
REDIS_TTL=300

# Cache TTL Configuration (in seconds)
CACHE_TTL_CONVERSATION=600             # 10 minutes
CACHE_TTL_CONVERSATION_LIST=300        # 5 minutes
CACHE_TTL_MESSAGES=600                 # 10 minutes
CACHE_TTL_FILES=3600                   # 1 hour

# Rate Limiting
RATE_LIMIT_WINDOW=60                   # Default window in seconds
RATE_LIMIT_CHAT_MESSAGE=60             # Messages per window
RATE_LIMIT_CHAT_MESSAGE_WINDOW=60      # 1 minute
RATE_LIMIT_CHAT_CREATE=20              # Conversation creates
RATE_LIMIT_CHAT_CREATE_WINDOW=60       # 1 minute
RATE_LIMIT_FILE_UPLOAD=10              # File uploads
RATE_LIMIT_FILE_UPLOAD_WINDOW=60       # 1 minute
RATE_LIMIT_API_GENERAL=100             # General API calls
RATE_LIMIT_API_GENERAL_WINDOW=60       # 1 minute
RATE_LIMIT_UNAUTH=50                   # Unauthenticated calls
RATE_LIMIT_UNAUTH_WINDOW=60            # 1 minute

# Stream Configuration
STREAM_TIMEOUT=300                     # 5 minutes

# Server
PORT=3001
NODE_ENV=development

# AI Engine (Python Backend)
AI_ENGINE_URL=http://localhost:8000

# CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5177,http://localhost:3000

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_YOUR_TOKEN_HERE

# Demo User (create this user first in database)
DEMO_USER_ID=uuid-of-demo-user
```

## Running the Application

### Development Mode

```bash
# Start with hot-reload
npm run start:dev
```

The server will start on `http://localhost:3001`

### Production Mode

```bash
# Build first
npm run build

# Start production server
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
