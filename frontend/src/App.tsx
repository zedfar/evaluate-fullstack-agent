import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Preview from './pages/Preview';
import Demo from './pages/Demo';

/**
 * Sample Mode App
 * Simplified version for public demo - no authentication
 *
 * Routes:
 * - /demo - Free demo chat with custom API endpoints
 * - /preview - Public conversation preview (read-only)
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirects to demo */}
        <Route path="/" element={<Navigate to="/demo" replace />} />

        {/* Demo mode - free chat without login */}
        <Route path="/demo" element={<Demo />} />

        {/* Preview mode - view shared conversations */}
        <Route path="/preview" element={<Preview />} />

        {/* Catch all - redirect to demo */}
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
