/**
 * Demo Module Constants
 * Configuration for demo mode functionality
 */

/**
 * Get demo user ID from environment variables
 * @throws Error if DEMO_USER_ID is not set
 */
export const getDemoUserId = (): string => {
  const demoUserId = process.env.DEMO_USER_ID;

  if (!demoUserId) {
    throw new Error(
      'DEMO_USER_ID must be set in environment variables. ' +
        'Please create a demo user manually and set DEMO_USER_ID in .env file.',
    );
  }

  return demoUserId;
};

/**
 * Demo limits and restrictions
 */
export const DEMO_LIMITS = {
  /** Maximum number of conversations allowed for demo user */
  MAX_CONVERSATIONS: 10,

  /** Maximum number of files per conversation */
  MAX_FILES_PER_CONV: 5,

  /** Maximum file size in bytes (500KB) */
  MAX_FILE_SIZE: 500 * 1024,

  /** Rate limit: messages per 10 minutes */
  MESSAGE_RATE: 20,

  /** Rate limit: file uploads per 10 minutes */
  UPLOAD_RATE: 5,

  /** Rate limit: conversation creation per hour */
  CREATE_CONVERSATION_RATE: 10,
} as const;

/**
 * Demo error codes
 */
export const DEMO_ERROR_CODES = {
  LIMIT_REACHED: 'DEMO_LIMIT_REACHED',
  USER_NOT_FOUND: 'DEMO_USER_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'DEMO_CONVERSATION_NOT_FOUND',
  FILE_TOO_LARGE: 'DEMO_FILE_TOO_LARGE',
  TOO_MANY_FILES: 'DEMO_TOO_MANY_FILES',
  INVALID_FILE_TYPE: 'DEMO_INVALID_FILE_TYPE',
} as const;
