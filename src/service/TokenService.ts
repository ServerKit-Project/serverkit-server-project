import jwt from 'jsonwebtoken';
import { TokenPayload, TokenOptions, AuthError } from '@/interface';

export class TokenService {
  private privateKey: string;
  private publicKey: string;

  constructor(privateKey: string, publicKey: string) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  generateToken(payload: TokenPayload, options?: TokenOptions): string {
    const defaultOptions = {
      algorithm: 'RS256' as const,
      expiresIn: '1h',
      issuer: 'serverkit-server',
      audience: 'serverkit-client',
    };

    const finalOptions = { ...defaultOptions, ...options };

    return jwt.sign(payload, this.privateKey, finalOptions);
  }

  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'serverkit-server',
        audience: 'serverkit-client',
      });

      if (typeof decoded === 'string') {
        throw new Error('Invalid token format');
      }

      return decoded as TokenPayload;
    } catch (error) {
      const authError = new Error('Invalid or expired token') as AuthError;
      authError.code = 'INVALID_TOKEN';
      authError.statusCode = 401;
      throw authError;
    }
  }

  generateAccessToken(payload: TokenPayload, expiresIn = '1h'): string {
    return this.generateToken(payload, { expiresIn });
  }

  generateRefreshToken(payload: TokenPayload, expiresIn = '7d'): string {
    return this.generateToken(payload, { expiresIn });
  }

  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return token;
  }
}
