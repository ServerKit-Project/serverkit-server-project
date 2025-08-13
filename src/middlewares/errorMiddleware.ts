import { Request, Response, NextFunction } from 'express';
import { AuthError } from '@/interface';

export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new Error(`Not found Route(404): ${req.originalUrl}`) as any;
  error.status = 404;
  next(error);
}

export function errorMiddleware(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (err instanceof Error && 'code' in err && 'statusCode' in err) {
    const authError = err as AuthError;
    res.status(authError.statusCode).json({
      success: false,
      message: authError.message,
      code: authError.code,
    });
    return;
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
