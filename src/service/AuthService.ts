import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '@/repository';
import { TokenService } from './TokenService';
import { UserPayload, SessionData, AuthError, CredentialPlatform, CredentialProvider, IdentityStatus } from '@/interface';

export class AuthService {
  private userRepository: UserRepository;
  private tokenService: TokenService;

  constructor(prisma: PrismaClient, tokenService: TokenService) {
    this.userRepository = new UserRepository(prisma);
    this.tokenService = tokenService;
  }

  async register(data: {
    email: string;
    password: string;
    displayName?: string;
    platform: CredentialPlatform;
    authAssetId: string;
  }): Promise<SessionData> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      const error = new Error('User already exists') as AuthError;
      error.code = 'USER_EXISTS';
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const createUserData: {
      email: string;
      status: IdentityStatus;
      userMetadata: any;
      displayName?: string;
    } = {
      email: data.email,
      status: IdentityStatus.active,
      userMetadata: {}
    };
    
    if (data.displayName) {
      createUserData.displayName = data.displayName;
    }
    
    const user = await this.userRepository.create(createUserData);

    await this.userRepository.createCredential({
      identityId: user.id,
      platform: data.platform,
      provider: CredentialProvider.ID_PASSWORD,
      providerUserId: data.email,
      passwordHash: hashedPassword
    });

    const userPayload: UserPayload = {
      id: user.id,
      authAssetId: data.authAssetId,
      roleIds: [],
      roleNames: []
    };

    const accessToken = this.tokenService.generateAccessToken(userPayload);
    const refreshToken = this.tokenService.generateRefreshToken(userPayload);

    return {
      accessToken,
      refreshToken,
      user: userPayload
    };
  }

  async login(data: {
    email: string;
    password: string;
    platform: CredentialPlatform;
    authAssetId: string;
  }): Promise<SessionData> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      const error = new Error('Invalid credentials') as AuthError;
      error.code = 'INVALID_CREDENTIALS';
      error.statusCode = 401;
      throw error;
    }

    if (user.status !== IdentityStatus.active) {
      const error = new Error('Account is inactive') as AuthError;
      error.code = 'ACCOUNT_INACTIVE';
      error.statusCode = 403;
      throw error;
    }

    const credential = user.credentials.find(
      (c: any) => c.provider === CredentialProvider.ID_PASSWORD && c.platform === data.platform
    );

    if (!credential || !credential.passwordHash) {
      const error = new Error('Invalid credentials') as AuthError;
      error.code = 'INVALID_CREDENTIALS';
      error.statusCode = 401;
      throw error;
    }

    const isValidPassword = await bcrypt.compare(data.password, credential.passwordHash);
    if (!isValidPassword) {
      const error = new Error('Invalid credentials') as AuthError;
      error.code = 'INVALID_CREDENTIALS';
      error.statusCode = 401;
      throw error;
    }

    const roleIds = user.identityRoles.map((ir: any) => ir.roleId);
    const roleNames = user.identityRoles.map((ir: any) => ir.role.name);

    const userPayload: UserPayload = {
      id: user.id,
      authAssetId: data.authAssetId,
      roleIds,
      roleNames
    };

    const accessToken = this.tokenService.generateAccessToken(userPayload);
    const refreshToken = this.tokenService.generateRefreshToken(userPayload);

    return {
      accessToken,
      refreshToken,
      user: userPayload
    };
  }

  async refreshToken(refreshToken: string): Promise<SessionData> {
    try {
      const payload = this.tokenService.verifyToken(refreshToken);
      
      const user = await this.userRepository.findById(payload.id);
      if (!user || user.status !== IdentityStatus.active) {
        const error = new Error('User not found or inactive') as AuthError;
        error.code = 'USER_NOT_FOUND';
        error.statusCode = 404;
        throw error;
      }

      const roleIds = user.identityRoles.map((ir: any) => ir.roleId);
      const roleNames = user.identityRoles.map((ir: any) => ir.role.name);

      const userPayload: UserPayload = {
        id: user.id,
        authAssetId: payload.authAssetId,
        roleIds,
        roleNames
      };

      const newAccessToken = this.tokenService.generateAccessToken(userPayload);
      const newRefreshToken = this.tokenService.generateRefreshToken(userPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: userPayload
      };
    } catch (error) {
      const authError = new Error('Invalid refresh token') as AuthError;
      authError.code = 'INVALID_REFRESH_TOKEN';
      authError.statusCode = 401;
      throw authError;
    }
  }

  async validateToken(token: string): Promise<UserPayload> {
    return this.tokenService.verifyToken(token);
  }

  async getUserById(id: number): Promise<UserPayload | null> {
    const user = await this.userRepository.findById(id);
    if (!user || user.status !== IdentityStatus.active) {
      return null;
    }

    const roleIds = user.identityRoles.map((ir: any) => ir.roleId);
    const roleNames = user.identityRoles.map((ir: any) => ir.role.name);

    return {
      id: user.id,
      authAssetId: user.identityRoles[0]?.role.authAssetId || '',
      roleIds,
      roleNames
    };
  }
}