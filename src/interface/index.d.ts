import { Request } from 'express';
import {
  Role,
  Identity,
  Credential,
  IdentityRole,
  FileInfo,
  CredentialPlatform,
  CredentialProvider,
  IdentityStatus,
} from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      $user?: UserPayload;
    }
  }
}

export interface UserPayload {
  id: number;
  authAssetId: string;
  roleIds: string[];
  roleNames: string[];
}

export interface AuthSettings {
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface TokenOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
}

export interface TokenPayload {
  id: number;
  authAssetId: string;
  roleIds: string[];
  roleNames: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AuthError extends Error {
  code: string;
  statusCode: number;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  user: UserPayload;
}

export interface RoleTreeNode {
  path: string;
  method?: string;
  roles?: Array<{
    authId: string;
    roleId: string;
  }>;
  children?: RoleTreeNode[];
}

export interface AuthRole {
  authId: string;
  roleIds: string[];
}

export interface RoleCheckResult {
  authRoles: AuthRole[];
}

export interface ApiSpec {
  version: string;
  endpoints: Array<{
    path: string;
    method: string;
    description: string;
  }>;
}

export interface OAuthTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export {
  Role,
  Identity,
  Credential,
  IdentityRole,
  FileInfo,
  CredentialPlatform,
  CredentialProvider,
  IdentityStatus,
};
