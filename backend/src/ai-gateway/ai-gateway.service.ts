import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import axios, { AxiosResponse } from 'axios';
import { ChatService } from '../chat/chat.service';
import { MessageRole } from '../chat/entities/chat-message.entity';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private aiEngineUrl: string;
  private readonly AI_ENGINE_TIMEOUT = 120000; // 2 minutes
  private readonly MAX_RETRIES = 3;

  constructor(
    private configService: ConfigService,
    private chatService: ChatService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.aiEngineUrl = this.configService.get('AI_ENGINE_URL');
  }

  /**
   * Call AI Engine with retry logic and timeout protection.
   *
   * @param payload Request payload
   * @param attempt Current retry attempt (1-indexed)
   * @param externalSignal Optional abort signal from client disconnect
   * @returns Axios response with streaming data
   */
  private async callAIEngineWithRetry(
    payload: any,
    attempt: number = 1,
    externalSignal?: AbortSignal,
  ): Promise<AxiosResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.AI_ENGINE_TIMEOUT,
      );

      // Listen to external abort signal (from client disconnect)
      if (externalSignal) {
        externalSignal.addEventListener('abort', () => {
          this.logger.log('Aborting AI engine request due to client disconnect');
          controller.abort();
        });
      }

      const response = await axios.post(
        `${this.aiEngineUrl}/api/v1/chat`,
        payload,
        {
          responseType: 'stream',
          headers: { Accept: 'text/event-stream' },
          timeout: this.AI_ENGINE_TIMEOUT,
          signal: controller.signal as any,
        },
      );

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      // Don't retry if client disconnected (abort signal triggered)
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        this.logger.log('Request cancelled due to client disconnect');
        throw error;
      }

      // Don't retry on 4xx errors (client errors)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }

      // Retry on 5xx errors or network issues
      if (attempt < this.MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.logger.warn(
          `AI Engine call failed (attempt ${attempt}/${this.MAX_RETRIES}). ` +
            `Retrying in ${delay}ms... Error: ${error.message}`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.callAIEngineWithRetry(payload, attempt + 1);
      }

      // All retries exhausted
      throw error;
    }
  }

  /**
   * Generate a conversation title from the first message
   * Takes the first 50 characters or until the first sentence ending punctuation
   */
  private generateTitleFromMessage(message: string): string {
    // Remove extra whitespace
    const cleanMessage = message.trim().replace(/\s+/g, ' ');

    // Find the first sentence ending (period, question mark, or exclamation)
    const sentenceEndMatch = cleanMessage.match(/^[^.!?]+[.!?]/);
    if (sentenceEndMatch) {
      const sentence = sentenceEndMatch[0].trim();
      // If sentence is reasonable length, use it
      if (sentence.length <= 60) {
        return sentence;
      }
    }

    // Otherwise, take first 50 characters and add ellipsis if needed
    if (cleanMessage.length <= 50) {
      return cleanMessage;
    }

    // Find last word boundary within 50 chars
    const truncated = cleanMessage.substring(0, 50);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > 30) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }

    return truncated + '...';
  }

  async streamChat(
    userId: string,
    message: string,
    conversationId?: string,
    modelProvider?: string,
    useRag?: boolean,
    customGptEndpoint?: string,
    customEmbeddingEndpoint?: string,
  ): Promise<Observable<MessageEvent>> {
    return new Observable((observer) => {
      let responseStream: any = null;
      let isStreamActive = true;
      const abortController = new AbortController();

      (async () => {
        const streamId = `${userId}-${Date.now()}`;
        try {
          // Track active stream
          await this.cacheManager.set(
            `stream:${streamId}`,
            { userId, conversationId, startTime: new Date() },
            300, // 5 minutes TTL
          );

          // Create or get conversation
          let conversation;
          if (conversationId) {
            conversation = await this.chatService.findConversationById(
              conversationId,
              userId,
            );
          } else {
            // Generate title from first message
            const title = this.generateTitleFromMessage(message);
            conversation = await this.chatService.createConversation(userId, title);
          }

          // Save user message
          await this.chatService.saveMessage(
            conversation.id,
            MessageRole.USER,
            message,
          );

          // Get conversation history
          const messages = await this.chatService.getConversationMessages(
            conversation.id,
          );

          // Format messages for AI engine
          const formattedMessages = messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

          // Build request payload
          const requestPayload = {
            messages: formattedMessages,
            conversation_id: conversation.id,
            model_provider: modelProvider || 'local',
            use_rag: useRag || false,
            // Custom endpoints for demo mode
            ...(customGptEndpoint && { custom_gpt_endpoint: customGptEndpoint }),
            ...(customEmbeddingEndpoint && { custom_embedding_endpoint: customEmbeddingEndpoint }),
          };

          // Stream from Python AI engine with retry and timeout
          const response = await this.callAIEngineWithRetry(
            requestPayload,
            1,
            abortController.signal,
          );
          responseStream = response.data; // Store stream for cleanup

          let fullResponse = '';

          response.data.on('data', (chunk: Buffer) => {
            // Skip if stream was cancelled
            if (!isStreamActive) {
              return;
            }
            const text = chunk.toString();
            const lines = text.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  fullResponse += parsed.content || '';
                  observer.next({
                    data: JSON.stringify(parsed),
                  } as MessageEvent);
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          });

          response.data.on('end', async () => {
            // Save AI response
            await this.chatService.saveMessage(
              conversation.id,
              MessageRole.ASSISTANT,
              fullResponse,
            );

            // Explicitly invalidate all related caches
            await this.cacheManager.del(`conversation:${conversation.id}`);
            await this.cacheManager.del(`messages:${conversation.id}`);
            await this.cacheManager.del(`conversations:${userId}`);

            // Remove stream tracking
            await this.cacheManager.del(`stream:${streamId}`);

            // Send done event with cache invalidation signal
            observer.next({
              data: JSON.stringify({
                type: 'done',
                conversationId: conversation.id,
                cacheInvalidated: true,
                timestamp: Date.now(),
              }),
            } as MessageEvent);
            observer.complete();
          });

          response.data.on('error', async (error) => {
            // Remove stream tracking
            await this.cacheManager.del(`stream:${streamId}`);

            // Send error as SSE event
            observer.next({
              data: JSON.stringify({
                type: 'error',
                error: error.message || 'Stream error occurred',
              }),
            } as MessageEvent);
            observer.error(error);
          });
        } catch (error) {
          // Remove stream tracking
          await this.cacheManager.del(`stream:${streamId}`);

          // If client disconnected, don't send error - just cleanup and exit silently
          if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
            this.logger.log(`Stream cancelled for user ${userId} - client disconnected`);
            observer.complete();
            return;
          }

          // Handle specific error types
          let errorMessage = 'Unknown error occurred';

          if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
            errorMessage = 'Request timeout. The AI is taking too long to respond. Please try again.';
          } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'AI service is temporarily unavailable. Please try again in a moment.';
          } else if (error.response?.status === 429) {
            errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          this.logger.error(`Stream error for user ${userId}: ${errorMessage}`);

          // Send error as SSE event before completing
          observer.next({
            data: JSON.stringify({
              type: 'error',
              error: errorMessage,
            }),
          } as MessageEvent);
          observer.error(error);
        }
      })();

      // Teardown: Called when client disconnects or unsubscribes
      return () => {
        this.logger.log(`Client disconnected. Cleaning up stream for user ${userId}`);
        isStreamActive = false;

        // Abort the AI engine request
        try {
          abortController.abort();
          this.logger.log('AI engine request aborted');
        } catch (error) {
          this.logger.warn(`Failed to abort request: ${error.message}`);
        }

        // Destroy the response stream from AI engine
        if (responseStream) {
          try {
            responseStream.destroy();
            this.logger.log('Response stream destroyed successfully');
          } catch (error) {
            this.logger.warn(`Failed to destroy stream: ${error.message}`);
          }
        }

        // Note: Cache cleanup will happen naturally via TTL (5 minutes)
        // or when stream completes normally
      };
    });
  }
}
