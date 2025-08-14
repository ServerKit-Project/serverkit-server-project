import { asyncLocalStorage } from "./asyncContext";

export interface CurrentUser {
    id: number;
    authAssetId: string;
    roleIds: string[];
    roleNames: string[];
}

/**
 * Get the current authenticated user information
 * @returns The current user object or null if not authenticated
 */
export function getCurrentUser(): CurrentUser | null {
    const store = asyncLocalStorage.getStore();
    return store?.user || null;
}
