import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { demoAPI, DemoSettings, DemoStats, UploadedFile } from '../services/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: any;
}

interface DemoStore {
  // State
  conversationId: string | null;
  messages: Message[];
  files: UploadedFile[];
  settings: DemoSettings;
  stats: DemoStats | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  currentStreamingMessage: string;
  abortController: AbortController | null;

  // Actions
  setConversationId: (id: string | null) => void;
  loadConversation: (conversationId: string) => Promise<void>;
  createNewConversation: () => Promise<string>;
  sendMessage: (message: string) => Promise<void>;
  stopStreaming: () => void;
  setSettings: (settings: Partial<DemoSettings>) => void;
  loadStats: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  loadFiles: () => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: DemoSettings = {
  gptApiEndpoint: 'https://3c4942bd7d7b.ngrok-free.app/v1',
  embeddingApiEndpoint: 'https://9f2305423656.ngrok-free.app/v1',
  modelProvider: 'local',
  useRag: false,
};

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      // Initial state
      conversationId: null,
      messages: [],
      files: [],
      settings: DEFAULT_SETTINGS,
      stats: null,
      isLoading: false,
      isSending: false,
      error: null,
      currentStreamingMessage: '',
      abortController: null,

      // Set conversation ID
      setConversationId: (id) => {
        set({ conversationId: id, messages: [], files: [] });
      },

      // Load conversation
      loadConversation: async (conversationId: string) => {
        try {
          set({ isLoading: true, error: null });
          const conversation = await demoAPI.getConversation(conversationId);

          set({
            conversationId: conversation.id,
            messages: conversation.messages || [],
            isLoading: false,
          });

          // Also load files
          get().loadFiles();
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || error.message || 'Failed to load conversation',
            isLoading: false,
          });
        }
      },

      // Create new conversation
      createNewConversation: async () => {
        try {
          set({ isLoading: true, error: null });

          const newConversationId = await demoAPI.createConversation();

          set({
            conversationId: newConversationId,
            messages: [],
            files: [],
            isLoading: false,
          });

          // Refresh stats
          get().loadStats();

          return newConversationId;
        } catch (error: any) {
          const errorData = error.response?.data;
          let errorMessage = 'Failed to create conversation';

          if (errorData?.code === 'DEMO_LIMIT_REACHED') {
            errorMessage = errorData.detail || 'Demo limit reached. Maximum 10 conversations allowed.';
          } else {
            errorMessage = errorData?.detail || errorData?.message || error.message;
          }

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw new Error(errorMessage);
        }
      },

      // Send message with streaming
      sendMessage: async (message: string) => {
        const { conversationId, settings } = get();

        if (!conversationId) {
          set({ error: 'No conversation selected' });
          return;
        }

        // Create new AbortController for this request
        const abortController = new AbortController();

        // Create assistant message ID outside try-catch for access in error handling
        const assistantMessageId = `temp-assistant-${Date.now()}`;

        try {
          set({
            isSending: true,
            error: null,
            currentStreamingMessage: '',
            abortController,
          });

          // Add user message optimistically
          const userMessage: Message = {
            id: `temp-user-${Date.now()}`,
            role: 'user',
            content: message,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, userMessage],
          }));

          // Create placeholder for assistant message
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, assistantMessage],
          }));

          // Stream response
          let fullResponse = '';

          for await (const chunk of demoAPI.sendMessage(
            {
              conversationId,
              message,
              settings,
            },
            undefined,
            abortController.signal
          )) {
            if (chunk.type === 'content') {
              fullResponse += chunk.content;
              set((state) => ({
                currentStreamingMessage: fullResponse,
                messages: state.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: fullResponse }
                    : msg
                ),
              }));
            } else if (chunk.type === 'done') {
              // Replace temporary IDs with real ones if provided
              if (chunk.conversationId) {
                set({ conversationId: chunk.conversationId });
              }
            } else if (chunk.type === 'sources' && chunk.sources) {
              // Update assistant message with sources metadata
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, metadata: { sources: chunk.sources } }
                    : msg
                ),
              }));
            }
          }

          set({
            isSending: false,
            currentStreamingMessage: '',
            abortController: null,
          });
        } catch (error: any) {
          // Check if error is due to abort
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            console.log('Streaming stopped by user');

            // Keep the partial response that was already streamed
            set((state) => {
              const lastMessage = state.messages.find(
                (msg) => msg.id === assistantMessageId
              );

              if (lastMessage && lastMessage.content) {
                // If there's partial content, keep it and mark as interrupted
                const updatedMessages = state.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: msg.content + '\n\n_[Response interrupted by user]_',
                      }
                    : msg
                );

                return {
                  messages: updatedMessages,
                  isSending: false,
                  currentStreamingMessage: '',
                  abortController: null,
                };
              } else {
                // If no content was streamed yet, remove the empty assistant message
                // and add a system message
                const filteredMessages = state.messages.filter(
                  (msg) => msg.id !== assistantMessageId
                );

                const interruptMessage: Message = {
                  id: `system-interrupt-${Date.now()}`,
                  role: 'system',
                  content: '⚠️ Response generation was stopped before completion.',
                  createdAt: new Date().toISOString(),
                };

                return {
                  messages: [...filteredMessages, interruptMessage],
                  isSending: false,
                  currentStreamingMessage: '',
                  abortController: null,
                };
              }
            });
          } else {
            console.error('Failed to send message:', error);
            set({
              error: error.message || 'Failed to send message',
              isSending: false,
              currentStreamingMessage: '',
              abortController: null,
            });

            // Remove failed messages
            set((state) => ({
              messages: state.messages.filter(
                (msg) => !msg.id.startsWith('temp-')
              ),
            }));
          }
        }
      },

      // Stop streaming
      stopStreaming: () => {
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
          set({
            abortController: null,
            isSending: false,
          });
        }
      },

      // Update settings
      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // Load demo stats
      loadStats: async () => {
        try {
          const stats = await demoAPI.getStats();
          set({ stats });
        } catch (error: any) {
          console.error('Failed to load stats:', error);
        }
      },

      // Upload file
      uploadFile: async (file: File) => {
        const { conversationId } = get();

        if (!conversationId) {
          set({ error: 'No conversation selected' });
          return;
        }

        // Check file size (500KB limit)
        const MAX_FILE_SIZE = 500 * 1024;
        if (file.size > MAX_FILE_SIZE) {
          set({ error: 'File size exceeds 500KB limit' });
          throw new Error('File size exceeds 500KB limit');
        }

        try {
          set({ isLoading: true, error: null });

          await demoAPI.uploadFile(file, conversationId);

          // Add temporary system message for immediate feedback
          const tempMessageId = `system-upload-${Date.now()}`;
          const uploadMessage: Message = {
            id: tempMessageId,
            role: 'system',
            content: `✓ File uploaded: **${file.name}** (${Math.round(file.size / 1024)}KB)\n\nFile is being processed and will be available for RAG queries shortly.`,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, uploadMessage],
          }));

          // Reload files
          await get().loadFiles();

          set({ isLoading: false });

          // Fetch actual upload message and refresh files from server in background (silent, no loader)
          const fetchUpdates = async () => {
            try {
              const conversation = await demoAPI.getConversation(conversationId);

              // Find the most recent system message with file_upload metadata
              const serverMessages = conversation.messages || [];
              const fileUploadMessage = serverMessages
                .filter((msg: any) => msg.role === 'system' && msg.metadata?.type === 'file_upload')
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

              if (fileUploadMessage) {
                // Replace the temporary message with the actual server message
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === tempMessageId ? fileUploadMessage : msg
                  ),
                }));
              }

              // Refresh files to get updated chunk count and processing status
              await get().loadFiles();
            } catch (error) {
              console.error('Failed to fetch upload confirmation:', error);
              // Silently fail - user already sees the upload was successful
            }
          };

          // Initial fetch after 500ms
          setTimeout(fetchUpdates, 500);

          // Poll for file processing completion (check every 2 seconds for up to 10 seconds)
          let pollCount = 0;
          const maxPolls = 5;
          const pollInterval = setInterval(async () => {
            pollCount++;

            try {
              await get().loadFiles();

              // Check if all files are completed
              const currentFiles = get().files;
              const allCompleted = currentFiles.every(
                f => f.processingStatus === 'completed' || f.processingStatus === 'failed'
              );

              if (allCompleted || pollCount >= maxPolls) {
                clearInterval(pollInterval);
              }
            } catch (error) {
              console.error('Failed to poll file status:', error);
              if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
              }
            }
          }, 2000);

        } catch (error: any) {
          const errorData = error.response?.data;
          let errorMessage = 'Failed to upload file';

          if (errorData?.code === 'DEMO_FILE_TOO_LARGE') {
            errorMessage = 'File size exceeds 500KB limit';
          } else if (errorData?.code === 'DEMO_TOO_MANY_FILES') {
            errorMessage = 'Maximum 5 files per conversation';
          } else if (errorData?.code === 'DEMO_INVALID_FILE_TYPE') {
            errorMessage = 'Invalid file type. Allowed: PDF, DOCX, TXT, CSV, PNG, JPG';
          } else {
            errorMessage = errorData?.detail || errorData?.message || error.message;
          }

          set({
            error: errorMessage,
            isLoading: false,
          });

          throw new Error(errorMessage);
        }
      },

      // Load files
      loadFiles: async () => {
        const { conversationId } = get();

        if (!conversationId) {
          return;
        }

        try {
          const files = await demoAPI.getFiles(conversationId);
          set({ files });

          // Auto-enable RAG if files exist
          if (files.length > 0 && !get().settings.useRag) {
            set((state) => ({
              settings: { ...state.settings, useRag: true },
            }));
          }
        } catch (error: any) {
          console.error('Failed to load files:', error);
        }
      },

      // Delete file
      deleteFile: async (fileId: string) => {
        try {
          set({ isLoading: true, error: null });

          await demoAPI.deleteFile(fileId);

          // Remove from local state
          set((state) => ({
            files: state.files.filter((f) => f.id !== fileId),
            isLoading: false,
          }));

          // Disable RAG if no files left
          if (get().files.length === 0) {
            set((state) => ({
              settings: { ...state.settings, useRag: false },
            }));
          }
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || error.message || 'Failed to delete file',
            isLoading: false,
          });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset store
      reset: () => {
        // Abort any ongoing streaming
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
        }

        set({
          conversationId: null,
          messages: [],
          files: [],
          settings: DEFAULT_SETTINGS,
          stats: null,
          isLoading: false,
          isSending: false,
          error: null,
          currentStreamingMessage: '',
          abortController: null,
        });
      },
    }),
    {
      name: 'demo-storage',
      partialize: (state) => ({
        // Only persist settings
        settings: state.settings,
      }),
    }
  )
);
