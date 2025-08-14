/**
 * Register global functions for use in code assets
 * This centralizes all global function registrations in one place
 */

import { getCurrentUser } from "./getCurrentUser";

// Extend global namespace
declare global {
    function getCurrentUser(): ReturnType<typeof getCurrentUser>;
}

export function registerGlobals(): void {
    // Register getCurrentUser as a global function
    (global as any).getCurrentUser = getCurrentUser;

    // Future global functions can be added here
    // Example:
    // (global as any).getRequestHeaders = getRequestHeaders;
    // (global as any).getClientIP = getClientIP;
    // (global as any).getRequestContext = getRequestContext;

    console.log("✅ Global functions registered");
}
