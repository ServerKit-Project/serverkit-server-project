// import { Identity, PrismaClient, CredentialPlatform, CredentialProvider, IdentityStatus } from "@prisma/client";
// import validator from "validator";
// import { UAParser } from "ua-parser-js";
// import { IAuthFile, IAuthRole } from "../../../interface/clientAsset/auth";
// import { TokenService, SessionData, AuthError, TokenVerificationOptions } from "./TokenService";
// import { keyManager } from "./KeyManager";
// import * as runtime from "@prisma/client/runtime/library";
// import { PasswordHasher } from "./PasswordHasher";
// import { BcryptHasher } from "./BcryptHasher";

// export interface UserMetadataDefault {
//     last_login_at: Date;
// }

// export interface AuthSignUpOptions {
//     userMetadata?: Pick<Identity, "displayName">;
//     userAgent?: string;
//     additionalRoles?: string[]; // 기본 역할에 추가할 역할들 (기본 역할은 자동으로 포함됨)
//     profileTableName?: string; // 프로필 테이블 이름 (기본값: auth 이름)
// }

// export interface AuthSignUpResult {
//     user: SessionData;
//     tokens: {
//         accessToken: string;
//         refreshToken: string;
//         tokenType: "Bearer";
//     };
// }

// export interface AuthSignInOptions {
//     profileTableName?: string; // 프로필 테이블 이름 (지정하면 프로필 데이터 자동 포함)
// }

// export interface AuthSignInResult {
//     user: SessionData;
//     tokens: {
//         accessToken: string;
//         refreshToken: string;
//         tokenType: "Bearer";
//     };
// }

// export interface AuthRefreshResult {
//     accessToken: string;
//     refreshToken: string;
//     tokenType: "Bearer";
// }

// // Identity, Credential, Role, IdentityRole 테이블을 사용하여 인증 시스템을 구축합니다.
// export class Auth {
//     private prisma: PrismaClient;
//     readonly authAsset: IAuthFile;
//     private tokenService: TokenService;
//     private passwordHasher?: PasswordHasher;

//     constructor(authAsset: IAuthFile, prisma?: PrismaClient) {
//         this.authAsset = authAsset;
//         this.prisma = prisma || new PrismaClient();
//         this.tokenService = keyManager.getTokenService();
//     }

//     /**
//      * Get or create password hasher lazily
//      */
//     private getPasswordHasher(): PasswordHasher {
//         if (!this.passwordHasher) {
//             if (this.authAsset.data.customPasswordHasher) {
//                 // Create custom hasher from auth asset
//                 try {
//                     const { hash, verify } = this.authAsset.data.customPasswordHasher;

//                     // Create functions from function expression strings
//                     const hashFunc = new Function("return " + hash)();
//                     const verifyFunc = new Function("return " + verify)();

//                     this.passwordHasher = {
//                         hash: hashFunc,
//                         verify: verifyFunc
//                     };
//                 } catch (error) {
//                     console.error("Failed to create custom password hasher:", error);
//                     throw new AuthError("Invalid custom password hasher configuration", "INVALID_HASHER_CONFIG", 500);
//                 }
//             } else {
//                 // Default to bcrypt
//                 this.passwordHasher = new BcryptHasher();
//             }
//         }
//         return this.passwordHasher;
//     }

//     /**
//      * 특정 AuthProvider가 이 auth asset에서 허용되는지 검증합니다.
//      */
//     private validateAuthProvider(provider: string): void {
//         if (!this.authAsset.data.authProviders.includes(provider)) {
//             throw new AuthError(`${provider} authentication is not enabled for ${this.authAsset.name}`, "AUTH_PROVIDER_NOT_ENABLED", 400);
//         }
//     }

//     private validateId(id: string): void {
//         if (!id || id.trim() === "") {
//             throw new AuthError("ID is required", "ID_REQUIRED", 400);
//         }

//         // 명시적으로 email 타입일 때만 이메일 형식 검증
//         if (this.authAsset.data.idType === "email" || !this.authAsset.data.idType) {
//             const trimmedId = id.trim();
//             if (!validator.isEmail(trimmedId)) {
//                 throw new AuthError("Invalid email format", "INVALID_EMAIL_FORMAT", 400);
//             }
//         }
//     }

//     private validatePassword(password: string): void {
//         if (!password || password === "") {
//             throw new AuthError("Password is required", "PASSWORD_REQUIRED", 400);
//         }

//         if (!validator.isLength(password, { min: 8 })) {
//             throw new AuthError("Password must be at least 8 characters long", "PASSWORD_TOO_SHORT", 400);
//         }
//     }

//     private async hashPassword(password: string): Promise<string> {
//         return await this.getPasswordHasher().hash(password);
//     }

//     private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
//         return await this.getPasswordHasher().verify(password, hashedPassword);
//     }

//     private getPlatformFromUserAgent(userAgent?: string): CredentialPlatform {
//         if (!userAgent) {
//             return CredentialPlatform.WEB;
//         }

//         const parser = new UAParser(userAgent);
//         const result = parser.getResult();

//         // iOS 디바이스 감지
//         if (result.os.name === "iOS" || (result.device.type === "mobile" && result.os.name?.includes("iPhone"))) {
//             return CredentialPlatform.IOS;
//         }

//         // Android 디바이스 감지
//         if (result.os.name === "Android") {
//             return CredentialPlatform.ANDROID;
//         }

//         // 기본값: WEB
//         return CredentialPlatform.WEB;
//     }

//     /**
//      * 해당 auth asset의 기본 역할을 가져옵니다.
//      * auth asset의 이름과 동일한 역할을 기본 역할로 사용합니다.
//      */
//     private getDefaultRoles(): string[] {
//         const authAssetName = this.authAsset.name.split(".")[0];
//         const matchingRole = this.authAsset.data.roles.find((role: IAuthRole) => role.name === authAssetName);

//         if (matchingRole) {
//             return [matchingRole.name];
//         }

//         // auth asset 이름과 일치하는 역할이 없으면 빈 배열 반환
//         console.warn(`No role found matching auth asset name: ${authAssetName}`);
//         return [];
//     }

//     /**
//      * 사용 가능한 모든 역할을 반환합니다.
//      */
//     getAvailableRoles(): IAuthRole[] {
//         return this.authAsset.data.roles;
//     }

//     /**
//      * 역할 이름들을 Role ID들로 변환합니다.
//      */
//     private async getRoleIdsByNames(roleNames: string[]): Promise<string[]> {
//         const roles = await this.prisma.role.findMany({
//             where: {
//                 name: { in: roleNames },
//                 authAssetId: this.authAsset.id
//             },
//             select: { id: true }
//         });

//         return roles.map((role) => role.id);
//     }

//     async signUpWithIdPassword(
//         tx: Omit<PrismaClient, runtime.ITXClientDenyList>,
//         id: string,
//         password: string,
//         options?: AuthSignUpOptions
//     ): Promise<AuthSignUpResult> {
//         // ID_PASSWORD provider 검증
//         this.validateAuthProvider("ID_PASSWORD");

//         try {
//             // Validate id and password
//             this.validateId(id);
//             this.validatePassword(password);

//             // ID normalization based on idType
//             const normalizedId = this.authAsset.data.idType === "username" ? id.trim() : id.trim().toLowerCase();

//             // Hash the password before storing
//             const hashedPassword = await this.hashPassword(password);

//             // Get platform from user-agent
//             const platform = this.getPlatformFromUserAgent(options?.userAgent);

//             // 역할 결정: 기본 역할은 항상 포함하고, 추가 역할이 있으면 함께 사용
//             const defaultRoles = this.getDefaultRoles();
//             const userAdditionalRoles = options?.additionalRoles || [];

//             // 사용자가 실수로 기본 역할을 포함했을 경우 제거 (중복 방지)
//             const filteredAdditionalRoles = userAdditionalRoles.filter((role) => !defaultRoles.includes(role));
//             const rolesToAssign = [...defaultRoles, ...filteredAdditionalRoles];
//             const roleIds = await this.getRoleIdsByNames(rolesToAssign);

//             let createdUser: any = null;

//             // const result = await this.prisma.$transaction(async (tx) => {
//             const identity = await tx.identity.create({
//                 data: {
//                     email: this.authAsset.data.idType === "email" ? normalizedId : null,
//                     userMetadata: {
//                         last_login_at: new Date(),
//                         ...options?.userMetadata
//                     },
//                     status: IdentityStatus.active,
//                     createdAt: new Date(),
//                     updatedAt: new Date()
//                 }
//             });

//             await tx.credential.create({
//                 data: {
//                     platform: platform,
//                     provider: CredentialProvider.ID_PASSWORD,
//                     providerUserId: normalizedId,
//                     passwordHash: hashedPassword,
//                     identityId: identity.id,
//                     createdAt: new Date(),
//                     updatedAt: new Date()
//                 }
//             });

//             // 역할 연결
//             if (roleIds.length === 0) {
//                 throw new AuthError("No roles found", "NO_ROLES_FOUND", 400);
//             }

//             if (roleIds.length > 0) {
//                 await tx.identityRole.createMany({
//                     data: roleIds.map((roleId) => ({
//                         identityId: identity.id,
//                         roleId: roleId
//                     }))
//                 });
//             }

//             createdUser = identity;

//             const sessionData: SessionData = {
//                 id: createdUser.id,
//                 email: createdUser.email || null,
//                 display_name: createdUser.displayName || "",
//                 authName: this.authAsset.name,
//                 authAssetId: this.authAsset.id,
//                 roleIds: roleIds,
//                 roleNames: rolesToAssign,
//                 metadata: {
//                     last_login_at: new Date(),
//                     created_at: createdUser.createdAt
//                 }
//             };

//             // 토큰 생성
//             const accessToken = this.tokenService.signToken(
//                 {
//                     id: createdUser.id,
//                     authAssetId: this.authAsset.id,
//                     roleIds: roleIds,
//                     roleNames: rolesToAssign
//                 },
//                 {
//                     expiresIn: this.authAsset.data.accessTokenExpiresIn ? `${this.authAsset.data.accessTokenExpiresIn}s` : "1h"
//                 }
//             );

//             const refreshToken = this.tokenService.signRefreshToken(
//                 {
//                     id: createdUser.id,
//                     authAssetId: this.authAsset.id,
//                     roleIds: roleIds,
//                     roleNames: rolesToAssign
//                 },
//                 {
//                     expiresIn: this.authAsset.data.refreshTokenExpiresIn ? `${this.authAsset.data.refreshTokenExpiresIn}s` : "7d"
//                 }
//             );

//             return {
//                 user: sessionData,
//                 tokens: {
//                     accessToken,
//                     refreshToken,
//                     tokenType: "Bearer" as const
//                 }
//             };
//             // });
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             console.error(`Error creating user for auth asset ${this.authAsset.name} (${this.authAsset.id}):`, error);
//             throw new AuthError("Failed to create user", "SIGNUP_FAILED", 500);
//         }
//     }

//     async signInWithIdPassword(id: string, password: string): Promise<AuthSignInResult> {
//         // ID_PASSWORD provider 검증
//         this.validateAuthProvider("ID_PASSWORD");

//         try {
//             // Validate id
//             this.validateId(id);

//             // ID normalization based on idType
//             const normalizedId = this.authAsset.data.idType === "username" ? id.trim() : id.trim().toLowerCase();

//             // 사용자 credential 찾기
//             const credential = await this.prisma.credential.findFirst({
//                 where: {
//                     providerUserId: normalizedId,
//                     provider: CredentialProvider.ID_PASSWORD
//                 },
//                 include: {
//                     identity: {
//                         include: {
//                             identityRoles: {
//                                 include: {
//                                     role: true
//                                 }
//                             }
//                         }
//                     }
//                 }
//             });

//             if (!credential) {
//                 throw new AuthError("User not found", "USER_NOT_FOUND", 404);
//             }

//             // Identity가 null인 경우 처리
//             if (!credential.identity) {
//                 throw new AuthError("User identity not found", "USER_IDENTITY_NOT_FOUND", 404);
//             }

//             // 해당 auth asset의 역할을 가지고 있는지 확인
//             const hasAuthAssetRole = credential.identity.identityRoles.some((ir) => ir.role.authAssetId === this.authAsset.id);

//             if (!hasAuthAssetRole) {
//                 throw new AuthError(`User not found in ${this.authAsset.name} auth system`, "USER_NOT_FOUND_IN_AUTH_SYSTEM", 404);
//             }

//             if (!credential.passwordHash) {
//                 throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS", 401);
//             }

//             // Verify password
//             const isValidPassword = await this.verifyPassword(password, credential.passwordHash);

//             if (!isValidPassword) {
//                 throw new AuthError("Invalid password", "INVALID_PASSWORD", 401);
//             }

//             // Update last login
//             await this.prisma.identity.update({
//                 where: { id: credential.identity.id },
//                 data: {
//                     userMetadata: {
//                         ...((credential.identity.userMetadata as any) || {}),
//                         last_login_at: new Date()
//                     } as any
//                 }
//             });

//             // 해당 auth asset의 역할만 필터링
//             const authAssetRoles = credential.identity.identityRoles.filter((ir) => ir.role.authAssetId === this.authAsset.id).map((ir) => ir.role);
//             const roleNames = authAssetRoles.map((role) => role.name);
//             const roleIds = authAssetRoles.map((role) => role.id);

//             const sessionData: SessionData = {
//                 id: credential.identity.id,
//                 email: credential.identity.email || null,
//                 display_name: credential.identity.displayName || "",
//                 authName: this.authAsset.name,
//                 authAssetId: this.authAsset.id,
//                 roleIds: roleIds,
//                 roleNames: roleNames,
//                 metadata: {
//                     last_login_at: new Date(),
//                     created_at: credential.identity.createdAt
//                 }
//             };

//             // 토큰 생성
//             const accessToken = this.tokenService.signToken(
//                 {
//                     id: credential.identity.id,
//                     authAssetId: this.authAsset.id,
//                     roleIds: roleIds,
//                     roleNames: roleNames
//                 },
//                 {
//                     expiresIn: this.authAsset.data.accessTokenExpiresIn ? `${this.authAsset.data.accessTokenExpiresIn}s` : "1h"
//                 }
//             );

//             const refreshToken = this.tokenService.signRefreshToken(
//                 {
//                     id: credential.identity.id,
//                     authAssetId: this.authAsset.id,
//                     roleIds: roleIds,
//                     roleNames: roleNames
//                 },
//                 {
//                     expiresIn: this.authAsset.data.refreshTokenExpiresIn ? `${this.authAsset.data.refreshTokenExpiresIn}s` : "7d"
//                 }
//             );

//             return {
//                 user: sessionData,
//                 tokens: {
//                     accessToken,
//                     refreshToken,
//                     tokenType: "Bearer"
//                 }
//             };
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             console.error(`Error signing in for auth asset ${this.authAsset.name} (${this.authAsset.id}):`, error);
//             throw new AuthError("Failed to sign in", "SIGNIN_FAILED", 500);
//         }
//     }

//     /**
//      * 특정 사용자에게 역할을 추가합니다.
//      */
//     async assignRolesToUser(userId: number, roleNames: string[]): Promise<void> {
//         try {
//             // 사용자 존재 여부 확인
//             const user = await this.prisma.identity.findUnique({
//                 where: {
//                     id: userId
//                 }
//             });

//             if (!user) {
//                 throw new AuthError("User not found", "USER_NOT_FOUND", 404);
//             }

//             // 해당 auth asset에서 사용 가능한 역할인지 검증
//             const availableRoleNames = this.authAsset.data.roles.map((role: IAuthRole) => role.name);
//             const invalidRoles = roleNames.filter((roleName) => !availableRoleNames.includes(roleName));

//             if (invalidRoles.length > 0) {
//                 throw new AuthError(`Invalid roles for ${this.authAsset.name}: ${invalidRoles.join(", ")}`, "INVALID_ROLES", 400);
//             }

//             const roleIds = await this.getRoleIdsByNames(roleNames);

//             // 먼저 기존 역할 확인 (중복 방지)
//             const existingRoles = await this.prisma.identityRole.findMany({
//                 where: {
//                     identityId: userId,
//                     roleId: { in: roleIds }
//                 }
//             });

//             const existingRoleIds = existingRoles.map((er) => er.roleId);
//             const newRoleIds = roleIds.filter((id) => !existingRoleIds.includes(id));

//             if (newRoleIds.length > 0) {
//                 await this.prisma.identityRole.createMany({
//                     data: newRoleIds.map((roleId) => ({
//                         identityId: userId,
//                         roleId: roleId
//                     }))
//                 });
//             }
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             console.error(`Error assigning roles for auth asset ${this.authAsset.name}:`, error);
//             throw new AuthError("Failed to assign roles", "ASSIGN_ROLES_FAILED", 500);
//         }
//     }

//     /**
//      * 특정 사용자의 역할을 제거합니다.
//      */
//     async removeRolesFromUser(userId: number, roleNames: string[]): Promise<void> {
//         try {
//             // 사용자 존재 여부 확인
//             const user = await this.prisma.identity.findUnique({
//                 where: {
//                     id: userId
//                 }
//             });

//             if (!user) {
//                 throw new AuthError("User not found", "USER_NOT_FOUND", 404);
//             }

//             const roleIds = await this.getRoleIdsByNames(roleNames);

//             // hard delete
//             await this.prisma.identityRole.deleteMany({
//                 where: {
//                     identityId: userId,
//                     roleId: { in: roleIds }
//                 }
//             });
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             console.error(`Error removing roles for auth asset ${this.authAsset.name}:`, error);
//             throw new AuthError("Failed to remove roles", "REMOVE_ROLES_FAILED", 500);
//         }
//     }

//     /**
//      * 토큰을 검증하고 사용자 정보를 반환합니다.
//      * 이제 TokenService의 verifyToken을 사용합니다.
//      */
//     async verifyToken(token: string): Promise<SessionData> {
//         try {
//             return await this.tokenService.verifyToken(token, {
//                 authAssetId: this.authAsset.id,
//                 authAssetName: this.authAsset.name,
//                 checkUserStatus: true,
//                 includeRoles: true
//             });
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             console.error(`Error verifying token for auth asset ${this.authAsset.name}:`, error);
//             throw new AuthError("Invalid token", "INVALID_TOKEN", 401);
//         }
//     }

//     /**
//      * 리프레시 토큰으로 새 액세스 토큰과 리프레시 토큰을 생성합니다 (RTR 전략).
//      * 이제 TokenService의 refreshAccessToken을 사용합니다.
//      */
//     async refreshAccessToken(refreshToken: string): Promise<AuthRefreshResult> {
//         try {
//             return await this.tokenService.refreshAccessToken(refreshToken, {
//                 authAssetId: this.authAsset.id,
//                 accessTokenExpiresIn: this.authAsset.data.accessTokenExpiresIn ? `${this.authAsset.data.accessTokenExpiresIn}s` : "1h",
//                 refreshTokenExpiresIn: this.authAsset.data.refreshTokenExpiresIn ? `${this.authAsset.data.refreshTokenExpiresIn}s` : "7d"
//             });
//         } catch (error) {
//             if (error instanceof AuthError) {
//                 throw error;
//             }
//             console.error(`Error refreshing token for auth asset ${this.authAsset.name}:`, error);
//             throw new AuthError("Invalid refresh token", "INVALID_REFRESH_TOKEN", 401);
//         }
//     }

//     /**
//      * 토큰의 역할 정보를 명확하게 표시합니다.
//      * 디버깅이나 로그 출력에 유용합니다.
//      * @example
//      * // 결과: { authAssetId: "user-auth-id", roles: ["master"], displayRoles: ["user-auth-id:master"] }
//      */
//     getTokenRoleInfo(token: string): { authAssetId: string; roleIds: string[]; roleNames: string[]; displayRoles: string[] } | null {
//         return this.tokenService.getTokenRoleInfo(token);
//     }

//     /**
//      * 토큰이 현재 auth asset에 속하는지 확인합니다.
//      */
//     isTokenForThisAuthAsset(token: string): boolean {
//         return this.tokenService.isTokenForAuthAsset(token, this.authAsset.id);
//     }

//     /**
//      * 사용자와 관련된 모든 데이터를 완전히 삭제합니다 (하드 삭제).
//      * Identity 레코드를 삭제하면 onDelete: CASCADE 설정에 의해
//      * 관련된 Credential과 IdentityRole이 자동으로 삭제됩니다.
//      * 주의: 이 작업은 되돌릴 수 없습니다.
//      */
//     async deleteUser(userId: number): Promise<void> {
//         try {
//             // 사용자 존재 여부 확인
//             const user = await this.prisma.identity.findUnique({
//                 where: { id: userId }
//             });

//             if (!user) {
//                 throw new AuthError("User not found", "USER_NOT_FOUND", 404);
//             }

//             // Identity만 삭제하면 CASCADE에 의해 관련 데이터가 자동 삭제됨
//             await this.prisma.identity.delete({
//                 where: { id: userId }
//             });
//         } catch (error) {
//             if (error instanceof AuthError) throw error;
//             console.error(`Error permanently deleting user for auth asset ${this.authAsset.name}:`, error);
//             throw new AuthError("Failed to permanently delete user", "DELETE_USER_PERMANENTLY_FAILED", 500);
//         }
//     }
// }
