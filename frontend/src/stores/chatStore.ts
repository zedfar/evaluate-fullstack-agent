import { create } from 'zustand';
import { chatAPI, UploadedFile } from '@/services/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: {
    type?: string;
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    chunkCount?: number;
    uploadedAt?: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  fileCount?: number; // Number of files attached to this conversation
  isPublic?: boolean; // Whether this conversation is publicly shared
}

type ModelProvider = 'local' | 'claude';

interface QueuedMessage {
  message: string;
  conversationId?: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean; // Keep for backward compatibility
  isLoadingConversations: boolean; // For sidebar chat history
  isLoadingMessages: boolean; // For main chat area messages
  isStreaming: boolean;
  streamingMessage: string;
  contextSources: string[];
  error: string | null;

  // Model & RAG settings
  modelProvider: ModelProvider;
  useRag: boolean;

  // File management
  conversationFiles: UploadedFile[];
  isUploadingFile: boolean;
  uploadProgress: number;

  // Message Queue
  messageQueue: QueuedMessage[];
  isProcessingQueue: boolean;

  // Conversation actions
  loadConversations: () => Promise<void>;
  loadConversationsSilent: () => Promise<void>; // Silent reload without loading skeleton
  loadConversation: (id: string, skipFileLoad?: boolean) => Promise<void>;
  loadConversationSilent: (id: string, skipFileLoad?: boolean) => Promise<void>; // Silent reload conversation
  sendMessage: (message: string, conversationId?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  resetStreamingMessage: () => void;
  clearError: () => void;

  // Model & RAG settings
  setModelProvider: (provider: ModelProvider) => void;
  setUseRag: (useRag: boolean) => void;

  // File actions
  uploadFile: (file: File, conversationId: string) => Promise<void>;
  loadConversationFiles: (conversationId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  resetContextSources: () => void;
  clearConversationFiles: () => void;

  // Queue management (internal)
  sendMessageInternal: (message: string, conversationId?: string) => Promise<void>;
  processMessageQueue: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  isLoading: false, // Keep for backward compatibility
  isLoadingConversations: false,
  isLoadingMessages: false,
  isStreaming: false,
  streamingMessage: '',
  contextSources: [],
  error: null,

  // Model & RAG settings
  modelProvider: 'local', // Default to local GPT-OSS
  useRag: false,

  // File management
  conversationFiles: [],
  isUploadingFile: false,
  uploadProgress: 0,

  // Message Queue
  messageQueue: [],
  isProcessingQueue: false,

  loadConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const response = await chatAPI.getConversations();
      set({ conversations: response.data });
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to load conversations';
      set({ error: errorMessage });
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  // Silent reload without showing loading skeleton
  loadConversationsSilent: async () => {
    try {
      const response = await chatAPI.getConversations();
      set({ conversations: response.data });
    } catch (error: any) {
      console.error('Failed to silently reload conversations:', error);
      // Don't show error toast for silent reload
    }
  },

  loadConversation: async (id: string, skipFileLoad: boolean = false) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const response = await chatAPI.getConversation(id);
      set({ currentConversation: response.data });

      // Load conversation files only if not skipped
      // Skip file loading when called after sending messages (files don't change)
      if (!skipFileLoad) {
        await get().loadConversationFiles(id);
      }
    } catch (error: any) {
      console.error('Failed to load conversation:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to load conversation';
      set({ error: errorMessage });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  // Silent reload conversation without showing loading skeleton
  loadConversationSilent: async (id: string, skipFileLoad: boolean = false) => {
    try {
      const response = await chatAPI.getConversation(id);
      set({ currentConversation: response.data });

      if (!skipFileLoad) {
        await get().loadConversationFiles(id);
      }
    } catch (error: any) {
      console.error('Failed to silently reload conversation:', error);
      // Silent fail - no error toast
    }
  },

  sendMessage: async (message: string, conversationId?: string) => {
    const { messageQueue, isStreaming, isProcessingQueue } = get();

    // Add to queue
    set({
      messageQueue: [...messageQueue, { message, conversationId }],
    });

    // Start processing if not already streaming or processing
    if (!isStreaming && !isProcessingQueue) {
      get().processMessageQueue();
    }
  },

  processMessageQueue: async () => {
    const { messageQueue } = get();

    // Already processing or no messages
    if (get().isProcessingQueue || messageQueue.length === 0) {
      return;
    }

    set({ isProcessingQueue: true });

    while (true) {
      const { messageQueue } = get();

      // No more messages
      if (messageQueue.length === 0) {
        set({ isProcessingQueue: false });
        break;
      }

      // Get next message
      const nextMessage = messageQueue[0];
      set({ messageQueue: messageQueue.slice(1) });

      // Process message
      try {
        await get().sendMessageInternal(
          nextMessage.message,
          nextMessage.conversationId
        );
      } catch (error) {
        console.error('Failed to process message from queue:', error);
        // Error already handled in sendMessageInternal
      }
    }
  },

  sendMessageInternal: async (message: string, conversationId?: string) => {
    set({ isStreaming: true, streamingMessage: '', contextSources: [], error: null });

    const { modelProvider, useRag, currentConversation } = get();

    // Optimistic update: Add user message immediately
    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date(),
    };

    const isNewConversation = !conversationId && !currentConversation;

    // If we have a current conversation, add the message optimistically
    if (currentConversation) {
      set({
        currentConversation: {
          ...currentConversation,
          messages: [...currentConversation.messages, tempUserMessage],
        },
      });
    } else if (isNewConversation) {
      // Create a temporary conversation for new chats with auto-generated title
      // Title will be generated from first message on backend
      const generatedTitle = message.length > 50
        ? message.substring(0, 47) + '...'
        : message;

      set({
        currentConversation: {
          id: `temp-conv-${Date.now()}`,
          title: generatedTitle,
          messages: [tempUserMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    try {
      let newConversationId = conversationId;
      let streamedContent = '';

      // Throttle streaming updates to improve performance
      let chunkBuffer = '';
      let throttleTimer: NodeJS.Timeout | null = null;
      const THROTTLE_MS = 16; // ~60fps for smoother typing effect

      const flushBuffer = () => {
        if (chunkBuffer) {
          const bufferedContent = chunkBuffer;
          streamedContent += bufferedContent;
          chunkBuffer = '';
          set((state) => ({
            streamingMessage: state.streamingMessage + bufferedContent,
          }));
        }
        throttleTimer = null;
      };

      for await (const chunk of chatAPI.sendMessage({
        message,
        conversationId,
        modelProvider,
        useRag,
      })) {
        if (chunk.type === 'content') {
          // Add chunk to buffer
          chunkBuffer += chunk.content;

          // Schedule throttled update if not already scheduled
          if (!throttleTimer) {
            throttleTimer = setTimeout(flushBuffer, THROTTLE_MS);
          }
        } else if (chunk.type === 'context') {
          // Context sources from RAG - extract just the file names
          const sourceNames = (chunk.sources || []).map((source: any) => source.name);
          set({ contextSources: sourceNames });
        } else if (chunk.type === 'done') {
          // Store the conversation ID for later reload
          if (chunk.conversationId) {
            newConversationId = chunk.conversationId;
          }
        }
      }

      // Flush any remaining buffered content
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
      flushBuffer();

      // Optimistic update: Convert streaming message to actual assistant message
      // This avoids the need to reload conversation
      const current = get().currentConversation;
      if (current && streamedContent) {
        const assistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          role: 'assistant',
          content: streamedContent,
          createdAt: new Date(),
        };

        // Update conversation with assistant message
        const updatedConversation = {
          ...current,
          id: newConversationId || current.id, // Use real ID if we got one
          messages: [...current.messages, assistantMessage],
          updatedAt: new Date(),
        };

        set({ currentConversation: updatedConversation });
      }

      // Only reload conversations list if this was a new conversation
      // This updates the sidebar with the real conversation ID and backend-generated title
      if (isNewConversation && newConversationId) {
        // Small delay to ensure backend cache is ready
        setTimeout(async () => {
          // Use silent reload to avoid showing loading skeleton in sidebar
          await get().loadConversationsSilent();
          // Also load the real conversation to get the proper title and IDs
          const realConversation = await chatAPI.getConversation(newConversationId);
          if (realConversation?.data) {
            set({ currentConversation: realConversation.data });
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);

      // Remove optimistic message on error
      const current = get().currentConversation;
      if (current) {
        // If it's a temp conversation (new chat), clear it completely on error
        if (current.id.startsWith('temp-conv-')) {
          set({ currentConversation: null });
        } else {
          // Otherwise just remove the temp message
          set({
            currentConversation: {
              ...current,
              messages: current.messages.filter(
                (m) => m.id !== tempUserMessage.id
              ),
            },
          });
        }
      }

      // Set error message with better formatting
      let errorMessage = 'Failed to send message. Please try again.';

      // Extract error from different sources
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        // Clean up error messages from AI providers
        const msg = error.message;

        // Handle ChatOpenAI validation errors
        if (msg.includes('validation error') || msg.includes('unexpected keyword argument')) {
          errorMessage = 'AI configuration error. Please check your model settings or try a different provider.';
        }
        // Handle other specific errors
        else if (msg.includes('timeout')) {
          errorMessage = 'Request timeout. The AI is taking too long to respond. Please try again.';
        } else if (msg.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = msg;
        }
      }

      set({ error: errorMessage });
    } finally {
      set({ isStreaming: false, streamingMessage: '', contextSources: [] });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await chatAPI.deleteConversation(id);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversation:
          state.currentConversation?.id === id ? null : state.currentConversation,
      }));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },

  updateConversationTitle: async (id: string, title: string) => {
    try {
      await chatAPI.updateConversation(id, { title });
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
        ),
        currentConversation:
          state.currentConversation?.id === id
            ? { ...state.currentConversation, title }
            : state.currentConversation,
      }));
    } catch (error) {
      console.error('Failed to update conversation title:', error);
    }
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation });
  },

  resetStreamingMessage: () => {
    set({ streamingMessage: '' });
  },

  clearError: () => {
    set({ error: null });
  },

  // Model & RAG settings
  setModelProvider: (provider) => {
    set({ modelProvider: provider });
    // Save to localStorage for persistence
    localStorage.setItem('modelProvider', provider);
  },

  setUseRag: (useRag) => {
    set({ useRag });
    // Save to localStorage for persistence
    localStorage.setItem('useRag', String(useRag));
  },

  // File management
  uploadFile: async (file: File, conversationId: string) => {
    set({ isUploadingFile: true, uploadProgress: 0 });

    try {
      const response = await chatAPI.uploadFile(file, conversationId);

      // Silent reload conversation to get the new file upload message
      // Use silent reload to avoid showing loading skeleton in messages area
      await get().loadConversationSilent(conversationId, false);

      // Silent reload conversations list to update file count badge in sidebar
      await get().loadConversationsSilent();

      // Show success notification (you can add a toast notification here)
      console.log('File uploaded successfully:', response.data);

      return response.data;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    } finally {
      set({ isUploadingFile: false, uploadProgress: 0 });
    }
  },

  loadConversationFiles: async (conversationId: string) => {
    try {
      const response = await chatAPI.getConversationFiles(conversationId);
      set({ conversationFiles: response.data });

      // Auto-enable RAG if there are files
      const hasFiles = response.data.length > 0;
      if (hasFiles && !get().useRag) {
        set({ useRag: true });
      }
    } catch (error) {
      console.error('Failed to load conversation files:', error);
      set({ conversationFiles: [] });
    }
  },

  deleteFile: async (fileId: string) => {
    try {
      await chatAPI.deleteFile(fileId);

      // Remove from state
      set((state) => ({
        conversationFiles: state.conversationFiles.filter((f) => f.id !== fileId),
      }));

      // Silent reload conversation to get the file deletion message
      // Use silent reload to avoid showing loading skeleton in messages area
      const conversationId = get().currentConversation?.id;
      if (conversationId) {
        await get().loadConversationSilent(conversationId, false);

        // Silent reload conversations list to update file count badge in sidebar
        await get().loadConversationsSilent();
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  },

  resetContextSources: () => {
    set({ contextSources: [] });
  },

  clearConversationFiles: () => {
    set({ conversationFiles: [] });
  },
}));
