import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { UserPayload } from '@/interface';

interface Context {
  user?: UserPayload;
  requestId?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<Context>();

export function createContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context: Context = {
      user: req.$user,
      requestId: req.headers['x-request-id'] as string || generateRequestId()
    };

    asyncLocalStorage.run(context, () => {
      next();
    });
  };
}

export function getCurrentUser(): UserPayload | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.user;
}

export function getCurrentRequestId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.requestId;
}

function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}