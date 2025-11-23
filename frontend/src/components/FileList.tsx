import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { UploadedFile } from '@/services/api';
import { FilePreview } from './FilePreview';

export const FileList = () => {
  const { conversationFiles } = useChatStore();
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('csv')) return '📊';
    if (fileType.includes('image')) return '🖼️';
    return '📎';
  };

  const getStatusBadge = (status: UploadedFile['processingStatus']) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', text: 'Pending' },
      processing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', text: 'Processing' },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', text: 'Ready' },
      failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', text: 'Failed' },
    };

    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (conversationFiles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
        No files uploaded yet
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
          Uploaded Files ({conversationFiles.length})
        </div>

        {conversationFiles.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        >
          <div className="text-xl flex-shrink-0">
            {getFileIcon(file.fileType)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {file.originalName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(file.fileSize)}
              {file.chunkCount && ` • ${file.chunkCount} chunks`}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {getStatusBadge(file.processingStatus)}
            {file.processingStatus === 'completed' && (
              <button
                onClick={() => setPreviewFile(file)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="View file"
              >
                <Eye size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          fileId={previewFile.id}
          fileName={previewFile.originalName}
          fileType={previewFile.fileType}
          blobUrl={previewFile.blobUrl}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
};
