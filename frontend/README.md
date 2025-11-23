# Frontend (React + TypeScript)

Modern React frontend for the AI chat application with real-time streaming, file upload, and markdown rendering.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Routing**: React Router DOM
- **Markdown Rendering**: React Markdown with syntax highlighting
- **UI Icons**: Lucide React

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── FileUpload.tsx
│   │   ├── FileList.tsx
│   │   ├── FilePreview.tsx
│   │   └── ModelSelector.tsx
│   ├── pages/          # Page components
│   │   ├── Demo.tsx
│   │   └── Preview.tsx
│   ├── services/       # API services
│   │   └── api.ts
│   ├── stores/         # Zustand state stores
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   └── demoStore.ts
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── server.mjs          # Production Express server with proxy
├── vite.config.ts      # Vite configuration
└── package.json
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env if needed (default: http://localhost:3000)

# 3. Start development server
npm run dev
# Runs on http://localhost:5178
```

## Prerequisites

- **Node.js**: 20.19.5 (managed via Volta)
- **npm**: 10.x or yarn
- **Backend**: NestJS backend running on port 3000

## Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:3001  # Backend API URL
PORT=5178                            # Frontend server port (production)
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Development server starts on `http://localhost:5178` with:
- Hot Module Replacement (HMR)
- API proxy: `/api/*` → `http://localhost:3001`
- Fast refresh for React components

## Building for Production

Build the optimized production bundle:

```bash
npm run build
```

This creates a `dist/` directory with optimized assets including:
- Code splitting for React and vendor libraries
- Minified JS and CSS
- Optimized asset loading

## Production Server

Run the production server:

```bash
npm start
```

This starts an Express server that:
- Serves the built static files from `dist/`
- Proxies `/api/*` requests to the backend
- Provides SPA fallback routing
- Runs on port 5178 (or PORT environment variable)

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm start` | Start production Express server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Lint TypeScript/TSX files with ESLint |

## Features

- AI chat interface with markdown rendering
- File upload and preview functionality
- Model selection
- Syntax highlighting for code blocks
- Responsive design with Tailwind CSS
- Client-side routing with React Router
- State persistence with Zustand

## Configuration

### Vite

The Vite configuration includes:
- Path alias: `@/` → `src/`
- Manual code splitting for optimized loading
- Development proxy for API calls

### Tailwind CSS

Tailwind is configured with custom theme settings in `tailwind.config.js`.

### TypeScript

TypeScript configuration is in `tsconfig.json` with strict mode enabled.

## Deployment

The production server (`server.mjs`) is designed to work with platforms like:
- Railway
- Heroku
- Vercel
- AWS
- Any Node.js hosting platform

Make sure to:
1. Build the project: `npm run build`
2. Set environment variables (VITE_API_URL, PORT)
3. Start the server: `npm start`

## Development Tips

- Use the `@/` path alias to import from `src/`: `import { api } from '@/services/api'`
- Components automatically refresh on save during development
- Check the browser console for development errors and warnings
- Use React DevTools for debugging component state

## License

MIT
