import { pino } from 'pino';
import { env, isDev } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    remove: true,
  },
});

export type Logger = typeof logger;
