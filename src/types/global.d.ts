/**
 * Global type definitions for code assets
 */

import { CurrentUser } from "../lib/context/getCurrentUser";

declare global {
    /**
     * Get the current authenticated user information
     * @returns The current user object or null if not authenticated
     */
    function getCurrentUser(): CurrentUser | null;
}
