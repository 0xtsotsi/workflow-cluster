/**
 * Node.js-specific logger implementation
 * This file should ONLY be imported in Node.js runtime, not Edge Runtime
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const enableFileLogs = process.env.ENABLE_FILE_LOGS !== 'false'; // Default: enabled

// Lazy load Node.js modules only when needed
let logsDir: string | null = null;
let logFilePath: string | null = null;
let errorLogFilePath: string | null = null;

// Create logs directory if it doesn't exist
if (enableFileLogs && typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');

    logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    logFilePath = path.join(logsDir, 'app.log');
    errorLogFilePath = path.join(logsDir, 'error.log');
  } catch {
    // Ignore errors during build
  }
}

// Create custom formatter for development logs
const devFormatter = (obj: Record<string, unknown>) => {
  const { level, msg, ...rest } = obj;
  const cleanRest = { ...rest };
  delete cleanRest.time;
  delete cleanRest.pid;
  delete cleanRest.hostname;

  const hasMetadata = Object.keys(cleanRest).length > 0;
  return hasMetadata ? `${msg}` : msg as string;
};

// Create logger with multiple streams
export const createNodeLogger = () => {
  if (isDevelopment) {
    // Development: Simple console output, JSON logs to files
    // Use pino's browser mode for clean console output (no worker threads)
    return pino({
      level: process.env.LOG_LEVEL || 'info',
      browser: {
        asObject: false,
        write: (obj: object) => {
          // Custom console output - just the message
          console.log(devFormatter(obj as Record<string, unknown>));
        },
      },
    });
  } else {
    // Production: JSON logs for structured logging
    const streams: pino.StreamEntry[] = [];

    // Add file streams if enabled
    if (enableFileLogs && typeof window === 'undefined' && logFilePath && errorLogFilePath) {
      const createFileStream = (filePath: string) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const fs = require('fs');
          return fs.createWriteStream(filePath, { flags: 'a' });
        } catch {
          return null;
        }
      };

      const appStream = createFileStream(logFilePath);
      const errorStream = createFileStream(errorLogFilePath);

      if (appStream) {
        streams.push({
          level: 'info',
          stream: appStream,
        });
      }

      if (errorStream) {
        streams.push({
          level: 'error',
          stream: errorStream,
        });
      }
    }

    // Fallback to stdout if no streams configured
    if (streams.length === 0) {
      streams.push({
        level: 'info',
        stream: process.stdout,
      });
    }

    return pino(
      {
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.multistream(streams)
    );
  }
};
