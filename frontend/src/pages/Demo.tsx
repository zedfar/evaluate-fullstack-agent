import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send,
  Loader2,
  AlertCircle,
  X,
  Settings,
  Upload,
  FileText,
  ChevronRight,
  Plus,
  StopCircle,
  Eye,
} from 'lucide-react';
import { useDemoStore } from '../stores/demoStore';
import { FileUpload } from '../components/FileUpload';
import { FilePreview } from '../components/FilePreview';

export default function Demo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const conversationId = searchParams.get('conversationId');

  const {
    messages,
    files,
    settings,
    stats,
    isLoading,
    isSending,
    error,
    setConversationId,
    loadConversation,
    createNewConversation,
    sendMessage,
    stopStreaming,
    setSettings,
    loadStats,
    uploadFile,
    loadFiles,
    clearError,
  } = useDemoStore();

  const [inputMessage, setInputMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewFileType, setPreviewFileType] = useState<string>('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Handle conversation ID from URL
  useEffect(() => {
    if (conversationId) {
      setConversationId(conversationId);
      loadConversation(conversationId);
    } else {
      // Auto-create new conversation if none exists
      handleNewChat();
    }
  }, [conversationId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load files when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadFiles();
    }
  }, [conversationId, loadFiles]);

  const handleNewChat = async () => {
    if (stats?.isLimitReached) {
      return;
    }

    try {
      const newId = await createNewConversation();
      setSearchParams({ conversationId: newId });
    } catch (error) {
      // Error handled in store
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || isSending) {
      return;
    }

    const message = inputMessage;
    setInputMessage('');
    await sendMessage(message);
  };

  const handleFileUpload = async (file: File) => {
    try {
      await uploadFile(file);
      setShowFileUpload(false);
    } catch (error) {
      // Error handled in store
    }
  };

  const isLimitReached = stats?.isLimitReached || false;
  const remainingSlots = stats?.remainingSlots || 0;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
            Demo Mode 🎭
          </h1>
          {stats && (
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isLimitReached
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : remainingSlots <= 3
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                  : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
              }`}
            >
              {stats.currentConversations}/{stats.maxConversations} conversations
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            disabled={isLimitReached}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isLimitReached
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-600 to-purple-600 text-white hover:from-primary-700 hover:to-purple-700'
            }`}
            title={
              isLimitReached
                ? 'Demo limit reached (10/10 conversations)'
                : `Create new conversation (${remainingSlots} remaining)`
            }
          >
            <Plus className="w-5 h-5" />
            New Chat
            {!isLimitReached && remainingSlots <= 3 && (
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {remainingSlots}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </header>

      {/* Limit Reached Warning */}
      {isLimitReached && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                Demo Limit Reached
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                You have reached the maximum of 10 conversations. Please contact
                administrator to reset your demo account or register for a full account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
            >
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                <p className="text-lg font-medium mb-2">
                  Welcome to Demo Mode! 👋
                </p>
                <p className="text-sm">
                  Start chatting or upload a file to begin.
                </p>
                <p className="text-xs mt-4 text-gray-400">
                  Demo mode allows up to 10 conversations with custom API endpoints
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-3xl rounded-lg p-4 shadow-lg ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-primary-600 to-purple-600 text-white'
                      : message.role === 'system'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  }`}
                >
                  {/* Show typing indicator for empty assistant messages while sending */}
                  {message.role === 'assistant' && message.content === '' && isSending ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">AI is thinking...</span>
                    </div>
                  ) : message.metadata?.type === 'file_upload' ? (
                    /* Special rendering for file upload messages */
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            File Uploaded Successfully
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">{message.metadata.fileName}</span>
                          </p>
                        </div>
                        {message.metadata.fileId && (
                          <button
                            onClick={() => {
                              setPreviewFileId(message.metadata.fileId);
                              setPreviewFileName(message.metadata.fileName);
                              setPreviewFileType(message.metadata.fileType);
                              setPreviewBlobUrl(message.metadata.blobUrl || '');
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800 rounded-lg transition-colors"
                            title="View file content"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {/* File details */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-blue-100/50 dark:bg-blue-800/30 rounded-lg p-3">
                        <div>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Size:</span>
                          <span className="ml-2 text-blue-900 dark:text-blue-100">
                            {Math.round(message.metadata.fileSize / 1024)}KB
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Type:</span>
                          <span className="ml-2 text-blue-900 dark:text-blue-100">
                            {message.metadata.fileType}
                          </span>
                        </div>
                        {message.metadata.chunkCount && (
                          <div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Chunks:</span>
                            <span className="ml-2 text-blue-900 dark:text-blue-100">
                              {message.metadata.chunkCount}
                            </span>
                          </div>
                        )}
                        {message.metadata.uploadedAt && (
                          <div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Uploaded:</span>
                            <span className="ml-2 text-blue-900 dark:text-blue-100">
                              {new Date(message.metadata.uploadedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                        File is ready for RAG queries
                      </p>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Sources */}
                  {message.metadata?.sources && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold mb-2 opacity-70">
                        Sources:
                      </p>
                      <div className="space-y-1">
                        {message.metadata.sources.map((source: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-xs opacity-70 flex items-center gap-2"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{source.file_name || source.source}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowFileUpload(!showFileUpload)}
                className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Upload file (max 500KB)"
              >
                <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isSending || !conversationId}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              />

              {isSending ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
                  title="Stop generating response"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || !conversationId}
                  className="px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:from-primary-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send
                </button>
              )}
            </form>

            {/* File Upload Panel */}
            {showFileUpload && conversationId && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <FileUpload
                  onFileSelect={handleFileUpload}
                  maxSize={500 * 1024}
                  disabled={isLoading}
                />
                {files.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Uploaded Files ({files.length}/5):
                    </p>
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                        >
                          <FileText className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {file.originalName}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {Math.round(file.fileSize / 1024)}KB
                              </span>
                              {file.chunkCount && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  • {file.chunkCount} chunks
                                </span>
                              )}
                              {file.createdAt && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  • {new Date(file.createdAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                              {file.fileType}
                            </p>

                            {/* Processing status badge */}
                            {file.processingStatus && (
                              <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                                file.processingStatus === 'completed'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : file.processingStatus === 'processing'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : file.processingStatus === 'failed'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              }`}>
                                {file.processingStatus === 'completed' ? 'Ready' :
                                 file.processingStatus === 'processing' ? 'Processing' :
                                 file.processingStatus === 'failed' ? 'Failed' : 'Pending'}
                              </span>
                            )}
                          </div>

                          {file.processingStatus === 'completed' && (
                            <button
                              onClick={() => {
                                setPreviewFileId(file.id);
                                setPreviewFileName(file.originalName);
                                setPreviewFileType(file.fileType);
                                setPreviewBlobUrl(file.blobUrl || '');
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded flex-shrink-0"
                              title="View file content"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* GPT API Endpoint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GPT API Base URL
                </label>
                <input
                  type="text"
                  value={settings.gptApiEndpoint}
                  onChange={(e) =>
                    setSettings({ gptApiEndpoint: e.target.value })
                  }
                  placeholder="http://localhost:8000/v1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Custom endpoint for GPT model
                </p>
              </div>

              {/* Embedding API Endpoint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Embedding API Base URL
                </label>
                <input
                  type="text"
                  value={settings.embeddingApiEndpoint}
                  onChange={(e) =>
                    setSettings({ embeddingApiEndpoint: e.target.value })
                  }
                  placeholder="http://localhost:8001/v1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Custom endpoint for embedding model
                </p>
              </div>

              {/* Model Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model Provider
                </label>
                <select
                  value={settings.modelProvider}
                  onChange={(e) =>
                    setSettings({
                      modelProvider: e.target.value as 'local' | 'claude' | 'openai',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="local">Local GPT-OSS</option>
                </select>
              </div>

              {/* RAG Toggle */}
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable RAG
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.useRag}
                    onChange={(e) => setSettings({ useRag: e.target.checked })}
                    className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Use uploaded files as context ({files.length} file
                  {files.length !== 1 ? 's' : ''})
                </p>
              </div>

              {/* Stats */}
              {stats && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Demo Statistics
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Conversations:
                      </span>
                      <span className="font-medium">
                        {stats.currentConversations}/{stats.maxConversations}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Remaining:
                      </span>
                      <span
                        className={`font-medium ${
                          stats.remainingSlots === 0
                            ? 'text-red-600'
                            : stats.remainingSlots <= 3
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {stats.remainingSlots}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFileId && (
        <FilePreview
          fileId={previewFileId}
          fileName={previewFileName}
          fileType={previewFileType}
          isDemo={true}
          blobUrl={previewBlobUrl || undefined}
          onClose={() => {
            setPreviewFileId(null);
            setPreviewFileName('');
            setPreviewFileType('');
            setPreviewBlobUrl('');
          }}
        />
      )}
    </div>
  );
}
