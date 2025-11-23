# Frontend - Agentic AI Demo

A modern React + TypeScript frontend for the AI chat demo application with file upload and preview capabilities.

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

## Prerequisites

- Node.js 20.19.5 (managed via Volta)
- npm or yarn

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:3000
```

For production, set this to your backend API URL.

## Installation

```bash
npm install
```

## Development

Start the development server with hot module replacement:

```bash
npm run dev
```

This will start Vite dev server on `http://localhost:5178` with:
- Hot module replacement (HMR)
- API proxy to backend at `/api` → `http://localhost:3000`

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
