import pino from 'pino';

// Configure a basic structured logger
// During development, pino-pretty will format it nicely
// In production, it will output structured JSON for Datadog/CloudWatch
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
