import axios from 'axios';

const API_URL =
  import.meta.env.DEV
    ? "http://localhost:5178/api"   // when dev vite proxy
    : "/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: (sessionId?: string) =>
    api.post('/auth/logout', sessionId ? { sessionId } : {}),
  logoutAll: () => api.post('/auth/logout-all'),
  getSessions: () => api.get('/auth/sessions'),
  getProfile: () => api.get('/user/me'),
};

// Types
export interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  chunkCount?: number;
  createdAt: string;
  errorMessage?: string;
  blobUrl?: string; // Public blob storage URL
}

export interface SendMessageOptions {
  message: string;
  conversationId?: string;
  modelProvider?: 'local' | 'claude';
  useRag?: boolean;
}

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chat API
export const chatAPI = {
  getConversations: () => api.get('/chat'),
  getConversation: (id: string) => api.get(`/chat/${id}`),
  updateConversation: (id: string, data: { title: string }) =>
    api.patch(`/chat/${id}`, data),
  deleteConversation: (id: string) => api.delete(`/chat/${id}`),

  // File upload APIs
  uploadFile: async (file: File, conversationId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);

    return api.post('/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getConversationFiles: (conversationId: string) =>
    api.get<UploadedFile[]>(`/chat/${conversationId}/files`),

  deleteFile: (fileId: string) => api.delete(`/chat/files/${fileId}`),

  // Share conversation
  toggleShareConversation: (conversationId: string, isPublic: boolean) =>
    api.patch(`/chat/${conversationId}/share`, { isPublic }),

  sendMessage: async function* (
    options: SendMessageOptions,
    retryOptions: RetryOptions = defaultRetryOptions
  ): AsyncGenerator<any, void, unknown> {
    const { maxRetries, retryDelay, backoffMultiplier } = {
      ...defaultRetryOptions,
      ...retryOptions,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: options.message,
            conversationId: options.conversationId,
            modelProvider: options.modelProvider || 'local',
            useRag: options.useRag || false,
          }),
        });

        if (!response.ok) {
          // Check if error is retryable
          if (response.status >= 500 || response.status === 429) {
            // Server error or rate limit - retry
            const errorText = await response.text();
            throw new Error(
              `HTTP ${response.status}: ${response.statusText} - ${errorText}`
            );
          } else {
            // Client error - don't retry (401, 403, 400, etc.)
            const errorText = await response.text();
            throw new Error(
              `Failed to send message: ${response.statusText} - ${errorText}`
            );
          }
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        // Streaming logic
        let hasReceivedData = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          hasReceivedData = true;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return; // Success!
              }
              try {
                const parsed = JSON.parse(data);
                // Check if this is an error chunk
                if (parsed.type === 'error') {
                  throw new Error(parsed.error || 'Stream error occurred');
                }
                yield parsed;
              } catch (e) {
                // If it's an Error object we threw, rethrow it
                if (
                  e instanceof Error &&
                  e.message !== 'Unexpected end of JSON input'
                ) {
                  throw e;
                }
                // Otherwise skip invalid JSON
              }
            }
          }
        }

        // If we got here, streaming completed successfully
        return;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const shouldRetry =
          attempt < maxRetries! &&
          !errorMessage.includes('401') && // Auth error
          !errorMessage.includes('403') && // Forbidden
          !errorMessage.includes('400'); // Bad request

        if (!shouldRetry) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = retryDelay! * Math.pow(backoffMultiplier!, attempt);
        console.warn(
          `Message streaming failed (attempt ${attempt + 1}/${maxRetries}). ` +
          `Retrying in ${delay}ms...`,
          errorMessage
        );

        await sleep(delay);
      }
    }

    // All retries exhausted
    throw (
      lastError || new Error('Failed to send message after multiple retries')
    );
  },
};

// Preview API (public, no auth required)
export const previewAPI = {
  getPublicConversation: async (conversationId: string) => {
    // Use axios directly without auth interceptor
    const response = await axios.get(
      `${API_URL}/preview/${conversationId}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response;
  },
};

// Demo API (public, no auth required)
export interface DemoSettings {
  gptApiEndpoint?: string;
  embeddingApiEndpoint?: string;
  modelProvider?: 'local' | 'claude' | 'openai';
  useRag?: boolean;
}

export interface DemoStats {
  currentConversations: number;
  maxConversations: number;
  remainingSlots: number;
  isLimitReached: boolean;
}

export interface DemoSendMessageOptions {
  conversationId: string;
  message: string;
  settings?: DemoSettings;
}

export const demoAPI = {
  // Get demo statistics
  getStats: async (): Promise<DemoStats> => {
    const response = await axios.get<DemoStats>(`${API_URL}/demo/stats`);
    return response.data;
  },

  // Create new demo conversation
  createConversation: async (): Promise<string> => {
    const response = await axios.post<{ conversationId: string }>(
      `${API_URL}/demo/conversations`
    );
    return response.data.conversationId;
  },

  // Get demo conversation
  getConversation: async (conversationId: string) => {
    const response = await axios.get(`${API_URL}/demo/${conversationId}`);
    return response.data;
  },

  // Upload file to demo conversation
  uploadFile: async (file: File, conversationId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);

    const response = await axios.post(`${API_URL}/demo/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get files for demo conversation
  getFiles: async (conversationId: string): Promise<UploadedFile[]> => {
    const response = await axios.get<UploadedFile[]>(
      `${API_URL}/demo/${conversationId}/files`
    );
    return response.data;
  },

  // Delete file from demo conversation
  deleteFile: async (fileId: string) => {
    const response = await axios.delete(`${API_URL}/demo/files/${fileId}`);
    return response.data;
  },

  // Send message with streaming (similar to chatAPI.sendMessage)
  sendMessage: async function* (
    options: DemoSendMessageOptions,
    retryOptions: RetryOptions = defaultRetryOptions,
    signal?: AbortSignal
  ): AsyncGenerator<any, void, unknown> {
    const { maxRetries, retryDelay, backoffMultiplier } = {
      ...defaultRetryOptions,
      ...retryOptions,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        const response = await fetch(`${API_URL}/demo/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: options.conversationId,
            message: options.message,
            settings: options.settings,
          }),
          signal, // Add abort signal
        });

        if (!response.ok) {
          // Check if error is retryable
          if (response.status >= 500 || response.status === 429) {
            const errorText = await response.text();
            throw new Error(
              `HTTP ${response.status}: ${response.statusText} - ${errorText}`
            );
          } else {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { message: errorText };
            }
            throw new Error(
              errorData.detail || errorData.message || `HTTP ${response.status}`
            );
          }
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'error') {
                  throw new Error(parsed.error || 'Stream error occurred');
                }
                yield parsed;
              } catch (e) {
                if (
                  e instanceof Error &&
                  e.message !== 'Unexpected end of JSON input'
                ) {
                  throw e;
                }
              }
            }
          }
        }

        return;
      } catch (error) {
        lastError = error as Error;

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const shouldRetry =
          attempt < maxRetries! &&
          !errorMessage.includes('DEMO_LIMIT_REACHED');

        if (!shouldRetry) {
          throw lastError;
        }

        const delay = retryDelay! * Math.pow(backoffMultiplier!, attempt);
        console.warn(
          `Demo message failed (attempt ${attempt + 1}/${maxRetries}). ` +
          `Retrying in ${delay}ms...`,
          errorMessage
        );

        await sleep(delay);
      }
    }

    throw (
      lastError || new Error('Failed to send message after multiple retries')
    );
  },
};
