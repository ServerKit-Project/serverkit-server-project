import { AsyncLocalStorage } from "async_hooks";

interface ContextStore {
    user: {
        id: number;
        authAssetId: string;
        roleIds: string[];
        roleNames: string[];
    } | null;
}

// Create a single instance of AsyncLocalStorage for the entire application
export const asyncLocalStorage = new AsyncLocalStorage<ContextStore>();
