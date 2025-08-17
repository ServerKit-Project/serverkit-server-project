// import { PrismaClient } from "@prisma/client";
// import { Auth, AuthSignUpOptions, AuthSignUpResult, AuthSignInOptions, AuthSignInResult, AuthRefreshResult } from "./Auth";
// import { IAuthFile } from "../../../interface/clientAsset/auth";
// import * as runtime from "@prisma/client/runtime/library";

// // AuthNamespace 타입 정의
// export interface AuthNamespace {
//     signUpWithIdPassword: (id: string, password: string, profileData?: any, options?: AuthSignUpOptions) => Promise<AuthSignUpResult>;
//     signInWithIdPassword: (id: string, password: string, options?: AuthSignInOptions) => Promise<AuthSignInResult>;
//     verifyToken: (token: string) => Promise<any>;
//     refreshToken: (refreshToken: string) => Promise<AuthRefreshResult>;
//     deleteUser: (userId: number) => Promise<void>;
//     assignRoles: (userId: number, roleNames: string[]) => Promise<void>;
//     removeRoles: (userId: number, roleNames: string[]) => Promise<void>;
//     getProfile: (userId: number, profileTableName?: string) => Promise<any>;
//     getInstance: () => Auth;
// }

// export class AuthService {
//     private static authNamespaces: Map<string, AuthNamespace> = new Map();
//     private static prisma: PrismaClient;
//     private static initialized: boolean = false;

//     /**
//      * AuthService를 초기화합니다. 앱 시작 시 한 번만 호출해야 합니다.
//      * @param authConfig Auth 설정 객체
//      * @param prisma PrismaClient 인스턴스 (의존성 주입)
//      */
//     static initialize(authConfig: Record<string, IAuthFile>, prisma: PrismaClient) {
//         if (this.initialized) {
//             console.warn("AuthService is already initialized");
//             return;
//         }
//         this.prisma = prisma;

//         // auth 인스턴스 생성 및 namespace 생성
//         for (const [name, authAsset] of Object.entries(authConfig)) {
//             const auth = new Auth(authAsset, this.prisma);
//             this.authNamespaces.set(name, this.createAuthNamespaceProxy(name, auth));
//         }

//         this.initialized = true;
//     }

//     /**
//      * 네임스페이스 프록시 객체를 생성하는 private 헬퍼 메서드.
//      */
//     private static createAuthNamespaceProxy(authName: string, auth: Auth): AuthNamespace {
//         return {
//             // ID/Password 인증
//             signUpWithIdPassword: (id: string, password: string, profileData?: any, options?: AuthSignUpOptions): Promise<AuthSignUpResult> => {
//                 return this.prisma.$transaction(async (tx) => {
//                     const result = await auth.signUpWithIdPassword(tx, id, password, options);

//                     // Convention over Configuration: profileTableName이 지정되면 사용, 아니면 authName 사용
//                     const profileTableName = options?.profileTableName || authName;

//                     // 프로필 데이터가 제공되면 자동으로 프로필 생성
//                     if (profileData && (tx as any)[profileTableName]) {
//                         try {
//                             const createdProfile = await (tx as any)[profileTableName].create({
//                                 data: {
//                                     ...profileData,
//                                     identityId: result.user.id
//                                 }
//                             });

//                             // 생성된 프로필 데이터를 SessionData.data에 추가
//                             if (createdProfile) {
//                                 const { identityId, id, ...cleanProfileData } = createdProfile;
//                                 result.user.data = cleanProfileData;
//                             }
//                         } catch (error) {
//                             // 에러를 그대로 전달
//                             throw error;
//                         }
//                     }

//                     return result;
//                 });
//             },
//             signInWithIdPassword: async (id: string, password: string, options?: AuthSignInOptions): Promise<AuthSignInResult> => {
//                 const result = await auth.signInWithIdPassword(id, password);

//                 // Convention over Configuration: profileTableName이 지정되면 사용, 아니면 authName 사용
//                 const profileTableName = options?.profileTableName || authName;

//                 // 프로필 데이터 조회 시도
//                 if ((this.prisma as any)[profileTableName]) {
//                     try {
//                         const profileData = await (this.prisma as any)[profileTableName].findUnique({
//                             where: { identityId: result.user.id }
//                         });

//                         if (profileData) {
//                             // profileData에서 identityId 제거하고 data 필드에 추가
//                             const { identityId, id, ...cleanProfileData } = profileData;
//                             result.user.data = cleanProfileData;
//                         }
//                     } catch (error) {
//                         // 프로필 조회 실패 시 무시 (로그인은 성공으로 처리)
//                         console.debug(`Failed to fetch profile data for ${profileTableName}:`, error);
//                     }
//                 }

//                 return result;
//             },

//             // 향후 추가될 인증 방식을 위한 플레이스홀더
//             // signUpWithGoogle: () => { ... }
//             // signInWithGoogle: () => { ... }
//             // signUpWithPhone: () => { ... }
//             verifyToken: async (token: string) => {
//                 // 토큰 검증만 수행 (프로필 데이터 조회하지 않음)
//                 return auth.verifyToken(token);
//             },
//             refreshToken: (refreshToken: string): Promise<AuthRefreshResult> => auth.refreshAccessToken(refreshToken),
//             deleteUser: (userId: number) => auth.deleteUser(userId),
//             assignRoles: (userId: number, roleNames: string[]) => auth.assignRolesToUser(userId, roleNames),
//             removeRoles: (userId: number, roleNames: string[]) => auth.removeRolesFromUser(userId, roleNames),
//             getProfile: async (userId: number, profileTableName?: string) => {
//                 // 프로필 테이블 이름 결정: 매개변수 > convention (authName)
//                 const tableName = profileTableName || authName;

//                 if ((this.prisma as any)[tableName]) {
//                     try {
//                         return await (this.prisma as any)[tableName].findUnique({
//                             where: { identityId: userId }
//                         });
//                     } catch (error) {
//                         console.debug(`Failed to fetch profile from ${tableName}:`, error);
//                         return null;
//                     }
//                 }
//                 return null;
//             },
//             getInstance: () => auth
//         };
//     }

//     /**
//      * Auth namespace를 가져옵니다.
//      */
//     static getAuth(name: string): AuthNamespace {
//         const namespace = this.authNamespaces.get(name);
//         if (!namespace) {
//             throw new Error(`Auth "${name}" not found. Available: ${Array.from(this.authNamespaces.keys()).join(", ")}`);
//         }
//         return namespace;
//     }

//     /**
//      * 사용 가능한 auth 이름 목록을 반환합니다.
//      */
//     static getAvailableAuths(): string[] {
//         return Array.from(this.authNamespaces.keys());
//     }

//     /**
//      * 공유 PrismaClient 인스턴스 반환
//      */
//     static getPrisma(): PrismaClient {
//         if (!this.prisma) throw new Error("AuthService is not initialized");
//         return this.prisma;
//     }
// }
