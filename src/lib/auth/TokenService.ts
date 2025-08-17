// import * as jwt from "jsonwebtoken";
// import * as ms from "ms";
// import { PrismaClient, IdentityStatus } from "@prisma/client";

// export interface IKeys {
//     privateKey: string;
//     publicKey: string;
// }

// export interface TokenPayload {
//     id: number;
//     authAssetId: string;
//     roleIds: string[]; // 역할 ID 배열
//     roleNames: string[]; // 역할 이름 배열
//     iat?: number;
//     exp?: number;
// }

// export interface SessionData {
//     id: number;
//     email: string | null;
//     display_name: string;
//     authName: string;
//     authAssetId: string;
//     roleIds: string[]; // 역할 ID 배열
//     roleNames: string[]; // 역할 이름 배열
//     data?: any; // 프로필 데이터나 추가 사용자 정보를 위한 필드
//     profile?: {
//         avatar?: string;
//         phone?: string;
//         preferences?: any;
//     };
//     metadata?: {
//         last_login_at: Date;
//         login_count?: number;
//         created_at: Date;
//     };
// }

// export interface TokenOptions {
//     expiresIn?: ms.StringValue;
//     issuer?: string;
//     audience?: string;
// }

// export interface TokenVerificationOptions {
//     authAssetId?: string;
//     authAssetName?: string;
//     checkUserStatus?: boolean;
//     includeRoles?: boolean;
// }

// export class AuthError extends Error {
//     constructor(
//         message: string,
//         public code: string,
//         public statusCode: number = 400
//     ) {
//         super(message);
//         this.name = "AuthError";
//     }
// }

// export class TokenService {
//     private keys: IKeys;
//     private prisma: PrismaClient;

//     constructor(keys: IKeys) {
//         this.keys = keys;
//         this.prisma = new PrismaClient();
//     }

//     /**
//      * JWT 토큰을 생성합니다.
//      */
//     signToken(payload: Omit<TokenPayload, "iat" | "exp">, options?: TokenOptions): string {
//         const tokenOptions: jwt.SignOptions = {
//             algorithm: "RS256",
//             issuer: options?.issuer || "serverkit-auth",
//             audience: options?.audience || "serverkit-client"
//         };

//         if (options?.expiresIn) {
//             tokenOptions.expiresIn = options.expiresIn;
//         }

//         return jwt.sign(payload, this.keys.privateKey, tokenOptions);
//     }

//     /**
//      * JWT 토큰을 검증합니다 (기본적인 JWT 검증만).
//      */
//     private verifyJWT(token: string, options?: { issuer?: string; audience?: string }): TokenPayload {
//         try {
//             const verifyOptions: jwt.VerifyOptions = {
//                 algorithms: ["RS256"],
//                 issuer: options?.issuer || "serverkit-auth",
//                 audience: options?.audience || "serverkit-client"
//             };

//             const decoded = jwt.verify(token, this.keys.publicKey, verifyOptions) as TokenPayload;
//             return decoded;
//         } catch (error) {
//             if (error instanceof jwt.TokenExpiredError) {
//                 throw new AuthError("Token has expired", "TOKEN_EXPIRED", 401);
//             }
//             if (error instanceof jwt.JsonWebTokenError) {
//                 throw new AuthError("Invalid token", "INVALID_TOKEN", 401);
//             }
//             throw new AuthError("Token verification failed", "TOKEN_VERIFICATION_FAILED", 401);
//         }
//     }

//     /**
//      * 토큰을 완전히 검증합니다 (JWT + 사용자 상태 + 역할).
//      */
//     async verifyToken(token: string, options?: TokenVerificationOptions): Promise<SessionData> {
//         try {
//             // 1. JWT 기본 검증
//             const payload = this.verifyJWT(token);

//             // 2. Auth Asset 검증
//             if (options?.authAssetId && payload.authAssetId !== options.authAssetId) {
//                 throw new AuthError("Token does not belong to this auth asset", "TOKEN_WRONG_AUTH_ASSET", 401);
//             }

//             // 3. 사용자 상태 확인 (옵션)
//             if (options?.checkUserStatus !== false) {
//                 const user = await this.prisma.identity.findFirst({
//                     where: {
//                         id: payload.id,
//                         status: IdentityStatus.active
//                     },
//                     include: {
//                         identityRoles:
//                             options?.includeRoles !== false
//                                 ? {
//                                       include: {
//                                           role: true
//                                       },
//                                       where: {
//                                           role: {
//                                               authAssetId: payload.authAssetId
//                                           }
//                                       }
//                                   }
//                                 : false
//                     }
//                 });

//                 if (!user) {
//                     throw new AuthError("User not found or inactive", "USER_NOT_FOUND_OR_INACTIVE", 404);
//                 }

//                 // 토큰의 역할과 사용자의 현재 역할을 비교 (보안 검증)
//                 if (options?.includeRoles !== false) {
//                     const currentRoleNames = (user as any).identityRoles.map((ir: any) => ir.role.name);
//                     const hasValidRoles = payload.roleNames.every((tokenRole) => currentRoleNames.includes(tokenRole));

//                     if (!hasValidRoles) {
//                         throw new AuthError("Token roles are no longer valid", "INVALID_TOKEN_ROLES", 401);
//                     }
//                 }

//                 return {
//                     id: user.id,
//                     email: user.email || null,
//                     display_name: user.displayName || "",
//                     authName: options?.authAssetName || "",
//                     authAssetId: payload.authAssetId,
//                     roleIds: payload.roleIds, // 토큰의 role ID를 직접 사용
//                     roleNames: payload.roleNames, // 토큰의 role name을 직접 사용
//                     metadata: {
//                         last_login_at: (user.userMetadata as any)?.last_login_at || new Date(),
//                         created_at: user.createdAt
//                     }
//                 };
//             }

//             // 4. 단순 토큰 정보만 반환 (role ID를 그대로 반환)
//             return {
//                 id: payload.id,
//                 email: null,
//                 display_name: "",
//                 authName: options?.authAssetName || "",
//                 authAssetId: payload.authAssetId,
//                 roleIds: payload.roleIds,
//                 roleNames: payload.roleNames,
//                 metadata: {
//                     last_login_at: new Date(),
//                     created_at: new Date()
//                 }
//             };
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             throw new AuthError("Token verification failed", "TOKEN_VERIFICATION_FAILED", 401);
//         }
//     }

//     /**
//      * 리프레시 토큰으로 새 액세스 토큰과 리프레시 토큰을 생성합니다 (RTR 전략).
//      */
//     async refreshAccessToken(
//         refreshToken: string,
//         options?: {
//             authAssetId?: string;
//             accessTokenExpiresIn?: string;
//             refreshTokenExpiresIn?: string;
//         }
//     ): Promise<{
//         accessToken: string;
//         refreshToken: string;
//         tokenType: "Bearer";
//     }> {
//         try {
//             // 1. 리프레시 토큰 검증
//             const payload = this.verifyJWT(refreshToken);

//             // 2. Auth Asset 검증
//             if (options?.authAssetId && payload.authAssetId !== options.authAssetId) {
//                 throw new AuthError("Refresh token does not belong to this auth asset", "REFRESH_TOKEN_WRONG_AUTH_ASSET", 401);
//             }

//             // 3. 사용자 정보 및 최신 역할 조회
//             const user = await this.prisma.identity.findFirst({
//                 where: {
//                     id: payload.id,
//                     status: IdentityStatus.active
//                 },
//                 include: {
//                     identityRoles: {
//                         include: {
//                             role: true
//                         },
//                         where: {
//                             role: {
//                                 authAssetId: payload.authAssetId
//                             }
//                         }
//                     }
//                 }
//             });

//             if (!user) {
//                 throw new AuthError("User not found or inactive", "USER_NOT_FOUND_OR_INACTIVE", 404);
//             }

//             // 4. 새 액세스 토큰과 리프레시 토큰 생성 (RTR 전략)
//             const currentRoles = (user as any).identityRoles.map((ir: any) => ir.role.name);
//             const currentRoleIds = (user as any).identityRoles.map((ir: any) => ir.role.id);

//             const newAccessToken = this.signToken(
//                 {
//                     id: user.id,
//                     authAssetId: payload.authAssetId,
//                     roleIds: currentRoleIds,
//                     roleNames: currentRoles
//                 },
//                 {
//                     expiresIn: (options?.accessTokenExpiresIn || "1h") as ms.StringValue
//                 }
//             );

//             // RTR 전략: 새로운 리프레시 토큰도 생성
//             const newRefreshToken = this.signRefreshToken(
//                 {
//                     id: user.id,
//                     authAssetId: payload.authAssetId,
//                     roleIds: currentRoleIds,
//                     roleNames: currentRoles
//                 },
//                 {
//                     expiresIn: (options?.refreshTokenExpiresIn || "7d") as ms.StringValue
//                 }
//             );

//             return {
//                 accessToken: newAccessToken,
//                 refreshToken: newRefreshToken,
//                 tokenType: "Bearer"
//             };
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             throw new AuthError("Invalid refresh token", "INVALID_REFRESH_TOKEN", 401);
//         }
//     }

//     /**
//      * 토큰에서 페이로드를 디코딩합니다 (검증 없이).
//      */
//     decodeToken(token: string): TokenPayload | null {
//         try {
//             const decoded = jwt.decode(token) as TokenPayload;
//             return decoded;
//         } catch (error) {
//             return null;
//         }
//     }

//     /**
//      * 토큰의 역할 정보를 authAsset과 함께 명확하게 표시합니다.
//      * 디버깅이나 로그 출력에 유용합니다.
//      */
//     getTokenRoleInfo(token: string): {
//         authAssetId: string;
//         roleIds: string[];
//         roleNames: string[];
//         displayRoles: string[];
//     } | null {
//         const payload = this.decodeToken(token);
//         if (!payload) return null;

//         return {
//             authAssetId: payload.authAssetId,
//             roleIds: payload.roleIds,
//             roleNames: payload.roleNames,
//             displayRoles: payload.roleNames.map((role) => `${payload.authAssetId}:${role}`) // 표시용
//         };
//     }

//     /**
//      * 토큰이 특정 authAsset에 속하는지 확인합니다.
//      */
//     isTokenForAuthAsset(token: string, authAssetId: string): boolean {
//         const payload = this.decodeToken(token);
//         return payload?.authAssetId === authAssetId;
//     }

//     /**
//      * 토큰이 만료되었는지 확인합니다.
//      */
//     isTokenExpired(token: string): boolean {
//         const decoded = this.decodeToken(token);
//         if (!decoded || !decoded.exp) {
//             return true;
//         }

//         const currentTime = Math.floor(Date.now() / 1000);
//         return decoded.exp < currentTime;
//     }

//     /**
//      * 리프레시 토큰을 생성합니다.
//      */
//     signRefreshToken(payload: Pick<TokenPayload, "id" | "authAssetId" | "roleIds" | "roleNames">, options?: TokenOptions): string {
//         const tokenOptions: jwt.SignOptions = {
//             algorithm: "RS256",
//             issuer: options?.issuer || "serverkit-auth",
//             audience: options?.audience || "serverkit-client"
//         };

//         if (options?.expiresIn) {
//             tokenOptions.expiresIn = options.expiresIn;
//         } else {
//             tokenOptions.expiresIn = "7d"; // 리프레시 토큰은 기본값 유지
//         }

//         return jwt.sign(payload, this.keys.privateKey, tokenOptions);
//     }
// }
