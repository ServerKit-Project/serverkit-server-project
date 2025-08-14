import axios, { AxiosError } from "axios";

export interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
    token_type: string;
    used_client_id?: string;
}

export class GoogleAuthError extends Error {
    constructor(
        message: string,
        public readonly originalError?: any,
        public readonly errorCode?: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = "GoogleAuthError";
    }
}

export class GoogleAuth {
    private static readonly TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static readonly REQUEST_TIMEOUT = 10000;

    static async exchangeCodeForTokens(code: string, googleConfig: any): Promise<GoogleTokenResponse> {
        // 입력값 검증
        if (!code || typeof code !== "string" || code.trim() === "") {
            throw new GoogleAuthError("Authorization code is required and must be a non-empty string");
        }

        if (googleConfig.clientIdList.length === 0) {
            throw new GoogleAuthError("No client IDs provided");
        }

        // 각 client ID를 순차적으로 시도
        const errors: Array<{ clientId: string; error: GoogleAuthError }> = [];

        for (let i = 0; i < googleConfig.clientIdList.length; i++) {
            const clientId = googleConfig.clientIdList[i];

            try {
                const result = await this.tryTokenExchange(code, clientId, googleConfig.clientSecret, googleConfig.redirectUri);

                // 성공한 client ID 정보를 결과에 포함
                return {
                    ...result,
                    used_client_id: clientId
                };
            } catch (error) {
                // Axios 에러 직접 처리
                if (axios.isAxiosError(error)) {
                    const axiosError = error as AxiosError;

                    // 타임아웃 에러 - client ID는 맞을 수 있음
                    if (axiosError.code === "ECONNABORTED") {
                        console.warn(`⚠️  Client ID ${i + 1}이 올바를 수 있습니다! 에러 코드: TIMEOUT`);
                        console.warn(`🔧 이 에러를 해결하면 정상 동작할 가능성이 높습니다: Request timeout`);
                        throw new GoogleAuthError(
                            `Client ID ${i + 1}/${googleConfig.clientIdList.length}이 올바른 것 같지만 다른 이유로 실패했습니다. 에러를 해결하세요: Request timeout`,
                            error,
                            "LIKELY_CORRECT_CLIENT_ID"
                        );
                    }

                    // HTTP 응답이 있는 경우
                    if (axiosError.response) {
                        const status = axiosError.response.status;
                        const errorData = axiosError.response.data as any;

                        // invalid_client는 client ID가 틀린 것 - 다음 시도
                        if (status === 401 && errorData?.error === "invalid_client") {
                            const googleError = new GoogleAuthError("Invalid client credentials", error, "INVALID_CLIENT", 401);
                            errors.push({ clientId, error: googleError });
                            continue; // 다음 client ID 시도
                        }

                        // 다른 에러들은 client ID가 맞을 가능성이 있음
                        let errorMessage = errorData?.error_description || "Unknown error";
                        let errorCode = errorData?.error || "UNKNOWN";

                        if (status === 400 && errorData?.error === "invalid_grant") {
                            errorMessage = "Authorization code is invalid, expired, or already used";
                            errorCode = "INVALID_GRANT";
                        }

                        console.warn(`⚠️  Client ID ${i + 1}이 올바를 수 있습니다! 에러 코드: ${errorCode}`);
                        console.warn(`🔧 이 에러를 해결하면 정상 동작할 가능성이 높습니다: ${errorMessage}`);

                        throw new GoogleAuthError(
                            `Client ID ${i + 1}/${googleConfig.clientIdList.length}이 올바른 것 같지만 다른 이유로 실패했습니다. 에러를 해결하세요: ${errorMessage}`,
                            error,
                            "LIKELY_CORRECT_CLIENT_ID",
                            status
                        );
                    }

                    // 네트워크 에러 - client ID는 맞을 수 있음
                    console.warn(`⚠️  Client ID ${i + 1}이 올바를 수 있습니다! 에러 코드: NETWORK_ERROR`);
                    console.warn(`🔧 이 에러를 해결하면 정상 동작할 가능성이 높습니다: Network error`);
                    throw new GoogleAuthError(
                        `Client ID ${i + 1}/${googleConfig.clientIdList.length}이 올바른 것 같지만 다른 이유로 실패했습니다. 에러를 해결하세요: Network error`,
                        error,
                        "LIKELY_CORRECT_CLIENT_ID"
                    );
                }

                // 기타 예상치 못한 에러
                const googleError = new GoogleAuthError("Unexpected error during token exchange", error, "UNKNOWN_ERROR");
                errors.push({ clientId, error: googleError });
            }
        }

        // 모든 client ID 시도 실패
        console.error(`💥 모든 client ID (${googleConfig.clientIdList.length}개) 시도 실패`);

        // 간단하고 명확한 에러 메시지
        throw new GoogleAuthError(
            `모든 client ID에서 토큰 교환 실패. 시도한 개수: ${googleConfig.clientIdList.length}개`,
            errors[0]?.error?.originalError, // 첫 번째 원본 에러만 포함
            "ALL_CLIENT_IDS_FAILED"
        );
    }

    private static async tryTokenExchange(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<GoogleTokenResponse> {
        const params = {
            client_id: clientId,
            client_secret: clientSecret,
            code: code.trim(),
            grant_type: "authorization_code",
            redirect_uri: redirectUri
        };

        const response = await axios.post(this.TOKEN_URL, params, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout: this.REQUEST_TIMEOUT
        });

        // 응답 데이터 검증
        const tokenData = this.validateTokenResponse(response.data);

        console.log("🔐 Google 토큰 교환 성공");
        // 보안: 민감한 정보는 로그에서 제외
        console.log("📋 토큰 정보:", {
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            has_access_token: !!tokenData.access_token,
            has_refresh_token: !!tokenData.refresh_token
        });

        return tokenData;
    }

    private static validateTokenResponse(data: any): GoogleTokenResponse {
        if (!data || typeof data !== "object") {
            throw new GoogleAuthError("Invalid response format from Google OAuth API");
        }

        if (!data.access_token || typeof data.access_token !== "string") {
            throw new GoogleAuthError("Missing or invalid access_token in response");
        }

        if (!data.expires_in || typeof data.expires_in !== "number") {
            throw new GoogleAuthError("Missing or invalid expires_in in response");
        }

        if (!data.token_type || typeof data.token_type !== "string") {
            throw new GoogleAuthError("Missing or invalid token_type in response");
        }

        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            id_token: data.id_token,
            expires_in: data.expires_in,
            token_type: data.token_type
        };
    }
}
