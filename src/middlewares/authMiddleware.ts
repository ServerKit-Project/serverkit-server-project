import { Request, Response, NextFunction } from 'express';
import { TokenService } from '@/service';
import { UserPayload } from '@/interface';

export function createAuthMiddleware(tokenService: TokenService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return next();
      }

      const [scheme, token] = authHeader.split(' ');
      if (scheme !== 'Bearer' || !token) {
        res.status(401).json({ message: 'Invalid Authorization header' });
        return;
      }

      const decoded = tokenService.verifyToken(token);
      req.$user = {
        id: decoded.id,
        authAssetId: decoded.authAssetId,
        roleIds: decoded.roleIds,
        roleNames: decoded.roleNames,
      };

      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}
