import { useCallback, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

interface FileUploadProps {
  conversationId?: string;
  onUploadComplete?: () => void;
  onFileSelect?: (file: File) => Promise<void>;
  maxSize?: number;
  disabled?: boolean;
}

export const FileUpload = ({
  conversationId,
  onUploadComplete,
  onFileSelect,
  maxSize = 2 * 1024 * 1024, // 2MB default
  disabled = false,
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const chatStore = useChatStore();

  // Use demo mode if onFileSelect is provided, otherwise use chat store
  const isDemoMode = !!onFileSelect;
  const uploadFile = isDemoMode ? null : chatStore.uploadFile;
  const isUploadingFile = isDemoMode ? isUploading : chatStore.isUploadingFile;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await handleFiles(files);
      }
    },
    [conversationId]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        await handleFiles(files);
      }
      // Reset input
      e.target.value = '';
    },
    [conversationId]
  );

  const handleFiles = async (files: File[]) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv',
      'text/plain',
    ];

    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        alert(
          `File type not allowed: ${file.name}. Allowed types: PDF, DOCX, CSV, TXT`
        );
        continue;
      }

      // Validate file size
      const maxSizeLabel = maxSize >= 1024 * 1024
        ? `${Math.round(maxSize / 1024 / 1024)}MB`
        : `${Math.round(maxSize / 1024)}KB`;

      if (file.size > maxSize) {
        alert(`File too large: ${file.name}. Max size: ${maxSizeLabel}`);
        continue;
      }

      try {
        if (isDemoMode) {
          // Demo mode: use onFileSelect callback
          setIsUploading(true);
          await onFileSelect!(file);
          setIsUploading(false);
        } else {
          // Chat mode: use chat store
          await uploadFile!(file, conversationId!);
          onUploadComplete?.();
        }
      } catch (error) {
        console.error('Upload failed:', error);
        if (isDemoMode) {
          setIsUploading(false);
        }
        // Don't show alert here, let the parent handle error display
      }
    }
  };

  return (
    <div className="relative">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${isUploadingFile || disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        {isUploadingFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Uploading and processing...
            </p>
          </div>
        ) : (
          <>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileSelect}
                  multiple
                  accept=".pdf,.docx,.doc,.csv,.txt"
                />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                or drag and drop
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              PDF, DOCX, CSV, TXT up to{' '}
              {maxSize >= 1024 * 1024
                ? `${Math.round(maxSize / 1024 / 1024)}MB`
                : `${Math.round(maxSize / 1024)}KB`}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
