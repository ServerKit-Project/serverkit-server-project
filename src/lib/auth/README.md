# Auth 시스템 사용 가이드

## 개요

개선된 Auth 시스템은 네임스페이스 기반의 직관적인 API를 제공하며, 의존성 주입을 통한 PrismaClient 관리와 트랜잭션 자동 처리를 통해 개발자 경험을 향상시킵니다.

## 초기 설정

### 1. AuthService 초기화

앱 시작 시 한 번만 실행합니다:

```typescript
import { PrismaClient } from "@prisma/client";
import { AuthService } from "@/lib/auth";
import { AuthConfig } from "@/config";

// PrismaClient 인스턴스 생성
const prisma = new PrismaClient();

// AuthService 초기화 (의존성 주입)
AuthService.initialize(AuthConfig, prisma);
```

### 2. Convention 기반 프로필 자동 생성

Auth 이름과 동일한 Prisma 모델이 있으면 프로필이 자동으로 생성됩니다:

```typescript
// 'user' auth → 'user' Prisma 모델에 자동으로 프로필 생성
// 'admin' auth → 'admin' Prisma 모델에 자동으로 프로필 생성

// 별도의 프로필 생성자 등록이 필요하지 않습니다!
```

## 기본 사용법

### 회원가입

```typescript
// Auth namespace 가져오기
const userAuth = AuthService.getAuth("user");

// Email/Password로 프로필 데이터와 함께 회원가입
// Convention: 'user' auth는 'user' Prisma 모델에 자동으로 프로필 생성
const result = await userAuth.signUpWithEmailPassword("user@example.com", "password123", {
    name: "John Doe",
    phone: "010-1234-5678"
});

// Email/Password로 프로필 없이 회원가입 (인증 정보만)
const result = await userAuth.signUpWithEmailPassword(
    "user@example.com",
    "password123"
    // profileData를 생략하면 프로필 생성을 건너뜁니다
);

// 향후 다른 인증 방식 추가 예정
// await userAuth.signUpWithGoogle(googleToken);
// await userAuth.signUpWithPhone(phoneNumber, verificationCode);
```

### 로그인

```typescript
// Auth namespace 가져오기
const userAuth = AuthService.getAuth("user");

// Email/Password로 로그인
const { user, tokens } = await userAuth.signInWithEmailPassword(email, password);

// 향후 다른 인증 방식 추가 예정
// await userAuth.signInWithGoogle(googleToken);
// await userAuth.signInWithPhone(phoneNumber, verificationCode);
```

### 토큰 관리

```typescript
const userAuth = AuthService.getAuth("user");

// 토큰 검증
const sessionData = await userAuth.verifyToken(accessToken);

// 토큰 갱신
const newTokens = await userAuth.refreshToken(refreshToken);
```

### 역할 관리

```typescript
const userAuth = AuthService.getAuth("user");

// 역할 할당
await userAuth.assignRoles(userId, ["premium", "beta-tester"]);

// 역할 제거
await userAuth.removeRoles(userId, ["beta-tester"]);
```

### 사용자 삭제

```typescript
const userAuth = AuthService.getAuth("user");
await userAuth.deleteUser(userId);
```

## 고급 사용법

### 동적 Auth 선택

런타임에 auth type을 결정해야 하는 경우:

```typescript
// 동적으로 auth type 선택
const authType = req.headers["x-auth-type"] || "user"; // 'user', 'admin', 'customer' 등
const auth = AuthService.getAuth(authType);

// 선택된 auth 사용
const result = await auth.signInWithEmailPassword(email, password);
```

### 사용 가능한 Auth 목록 확인

```typescript
// 모든 auth type 조회
const authNames = AuthService.getAvailableAuths();
console.log(authNames); // ['user', 'admin', 'customer', 'vendor']
```

### 복잡한 트랜잭션 처리

```typescript
const userAuth = AuthService.getAuth("user").getInstance();
const prisma = AuthService.getPrisma();

const result = await prisma.$transaction(async (tx) => {
    // 1. 인증 정보 생성
    const authResult = await userAuth.signUpWithEmailPassword(tx, email, password);

    // 2. 사용자 프로필 생성
    const user = await tx.user.create({
        data: {
            name: userData.name,
            identityId: authResult.user.id
        }
    });

    // 3. 추가 연관 데이터 생성
    await tx.userSettings.create({
        data: {
            userId: user.id,
            theme: "light",
            notifications: true
        }
    });

    return { authResult, user };
});
```

## 마이그레이션 가이드

### 기존 코드 (Auth 클래스 직접 사용)

```typescript
import { Auth } from "@/lib/auth";
import { AuthConfig } from "@/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const userAuth = new Auth(AuthConfig["user"], prisma);
const result = await userAuth.signInWithEmailPassword(email, password);
```

### 새 코드 (AuthService 사용)

```typescript
import { AuthService } from "@/lib/auth";

const userAuth = AuthService.getAuth("user");
const result = await userAuth.signInWithEmailPassword(email, password);
```

## 프로필 데이터

프로필 데이터는 프로젝트에 맞게 자유롭게 정의하여 사용할 수 있습니다:

```typescript
// 예시: User 프로필
interface UserProfile {
    name: string;
    phone?: string;
    birthDate?: Date;
    // ... 프로젝트에 필요한 필드
}

// 예시: Admin 프로필
interface AdminProfile {
    name: string;
    department: string;
    level: number;
    // ... 프로젝트에 필요한 필드
}

// 사용 시
const result = await AuthService.user.signUpWithEmailPassword(
    email,
    password,
    userProfile // any 타입이므로 어떤 객체든 전달 가능
);
```

## 주의사항

1. **초기화 필수**: 앱 시작 시 `AuthService.initialize()`를 반드시 호출해야 하며, PrismaClient 인스턴스를 주입해야 합니다.
2. **Convention 기반 프로필 생성**: Auth 이름과 동일한 Prisma 모델이 있으면 자동으로 프로필이 생성됩니다. (예: 'user' auth → 'user' 모델)
3. **PrismaClient 관리**: PrismaClient는 앱 전체에서 하나만 생성하여 사용해야 하며, 앱 종료 시 `prisma.$disconnect()` 호출을 권장합니다.
4. **트랜잭션**: `signUp` 메서드는 자동으로 트랜잭션을 처리합니다.
