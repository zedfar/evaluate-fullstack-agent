import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileText, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '@/services/api';

interface FilePreviewProps {
  fileId: string;
  fileName: string;
  fileType: string;
  onClose: () => void;
  isDemo?: boolean;
  blobUrl?: string; // Direct blob URL for public access
}

export const FilePreview = ({ fileId, fileName, fileType, onClose, isDemo = false, blobUrl }: FilePreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [zoom, setZoom] = useState(100);
  const blobUrlRef = useRef<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Use blobUrl if provided (public access), otherwise use API endpoint
  const fetchUrl = blobUrl || (isDemo
    ? `${import.meta.env.VITE_API_URL || '/api'}/demo/files/${fileId}/download`
    : `${import.meta.env.VITE_API_URL || '/api'}/chat/files/${fileId}/download`);

  // Helper functions for file type detection
  const isTextFile = (mimeType: string) => {
    return mimeType.includes('text') ||
           mimeType.includes('csv') ||
           mimeType.includes('markdown');
  };

  const isPDFFile = (mimeType: string) => {
    return mimeType.includes('pdf');
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.includes('image');
  };

  // Load file content function
  const loadFileContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = {};

      // Only add auth token if not using public blobUrl and not in demo mode
      if (!blobUrl && !isDemo) {
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(fetchUrl, { headers });

      if (!response.ok) {
        throw new Error('Failed to load file');
      }

      // For text files, read as text
      if (isTextFile(fileType)) {
        const text = await response.text();
        setContent(text);
      }
      // For PDF and images, create blob URL
      else if (isPDFFile(fileType) || isImageFile(fileType)) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url; // Save to ref for cleanup
        setPreviewUrl(url);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [fileId, fileType, fetchUrl, isDemo, blobUrl]);

  // Cleanup function separated from useEffect
  useEffect(() => {
    return () => {
      // Cleanup blob URL on unmount
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Load file content only once when fileId changes
  useEffect(() => {
    loadFileContent();
  }, [loadFileContent]);

  // Handle ESC key and click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && e.target === modalRef.current) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const headers: HeadersInit = {};

      // Only add auth token if not using public blobUrl and not in demo mode
      if (!blobUrl && !isDemo) {
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(fetchUrl, { headers });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download file: ' + err.message);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary-200 dark:border-primary-900 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin mx-auto mb-4"></div>
              <FileText className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400" size={24} />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Loading file...</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">{fileName}</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center max-w-md">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle size={40} className="text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load file</h3>
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={loadFileContent}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Text file preview with line numbers
    if (isTextFile(fileType)) {
      const lines = content.split('\n');
      return (
        <div className="h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {lines.length} lines • {content.length} characters
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(60, zoom - 10))}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex text-sm font-mono" style={{ fontSize: `${zoom}%` }}>
              {/* Line numbers */}
              <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 select-none border-r border-gray-200 dark:border-gray-700 sticky left-0">
                {lines.map((_, i) => (
                  <div key={i} className="px-4 py-0.5 text-right">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Content */}
              <pre className="flex-1 p-4 whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100 overflow-x-auto">
                {content}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    // PDF preview
    if (isPDFFile(fileType)) {
      return (
        <div className="h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              PDF Document
            </span>
          </div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <iframe
              src={`${previewUrl}#view=FitH`}
              className="w-full h-full border-0"
              title={fileName}
            />
          </div>
        </div>
      );
    }

    // Image preview with zoom
    if (isImageFile(fileType)) {
      return (
        <div className="h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Image Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(400, zoom + 25))}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-700 p-4">
            <img
              src={previewUrl}
              alt={fileName}
              className="object-contain transition-transform"
              style={{ maxWidth: `${zoom}%`, maxHeight: `${zoom}%` }}
            />
          </div>
        </div>
      );
    }

    // Unsupported file type
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center max-w-md">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <FileText size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Preview not available</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This file type cannot be previewed in the browser
          </p>
          <button
            onClick={handleDownload}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center gap-2 shadow-md hover:shadow-lg font-medium"
          >
            <Download size={18} />
            Download File
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md">
              <FileText size={22} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {fileName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {fileType.split('/')[1]?.toUpperCase() || 'FILE'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
            <button
              onClick={handleDownload}
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 text-gray-700 dark:text-gray-300 hover:scale-105 active:scale-95"
              title="Download file (Ctrl+S)"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:scale-105 active:scale-95"
              title="Close (ESC)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 bg-white dark:bg-gray-800">
          {renderContent()}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono">ESC</kbd> to close • Click outside to dismiss
          </p>
        </div>
      </div>
    </div>
  );
};
