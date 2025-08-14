import { Request, Response, NextFunction } from "express";

export interface RoleUnit {
    authId: string;
    roleId: string;
}

export interface RoleTreeNode {
    path: string;
    roles: RoleUnit[];
    method?: string;
    children: RoleTreeNode[];
}

export interface AuthUser {
    id: number;
    authAssetId: string;
    roleIds: string[];
    roleNames: string[];
}

interface AuthRoleRequirement {
    authId: string;
    roleIds: string[];
}

/**
 * Find all auth and role requirements for a given path and method
 * by traversing the role tree and collecting requirements from all levels
 */
function findRolesByPathAndMethod(
    root: RoleTreeNode,
    targetPath: string,
    targetMethod: string
): { authRoles: AuthRoleRequirement[] } {
    const segments = targetPath.split("/").filter(Boolean);
    let currentNode = root;
    const collectedRoles: RoleUnit[] = [];

    // Navigate through the path segments
    for (let i = 0; i < segments.length; i++) {
        if (!currentNode || !currentNode.children) {
            break;
        }

        // Collect roles from current node (for route groups)
        if (currentNode.roles && currentNode.roles.length > 0) {
            collectedRoles.push(...currentNode.roles);
        }

        // Find the child node that matches the current segment
        const matchingChild = currentNode.children.find(child => {
            const childPath = child.path.startsWith('/') ? child.path.slice(1) : child.path;
            return childPath === segments[i];
        });

        if (!matchingChild) {
            break;
        }

        currentNode = matchingChild;
    }

    // Check if we found a matching node
    if (!currentNode) {
        return { authRoles: [] };
    }

    // If the node has a method specified, it must match the target method
    if (currentNode.method && currentNode.method.toLowerCase() !== targetMethod.toLowerCase()) {
        return { authRoles: [] };
    }

    // Collect roles from the final node (for routes)
    if (currentNode.roles && currentNode.roles.length > 0) {
        collectedRoles.push(...currentNode.roles);
    }

    // Group roles by authId
    const authRolesMap: Record<string, string[]> = {};
    collectedRoles.forEach(role => {
        if (!authRolesMap[role.authId]) {
            authRolesMap[role.authId] = [];
        }
        authRolesMap[role.authId].push(role.roleId);
    });

    // Convert to array format
    const authRoles = Object.entries(authRolesMap).map(([authId, roleIds]) => ({
        authId,
        roleIds
    }));

    return { authRoles };
}

/**
 * Express middleware factory for role-based access control
 * @param roleTree - The role tree structure containing auth and role requirements
 * @returns Express middleware function
 */
function createRoleCheckMiddleware(roleTree: RoleTreeNode) {
    return (req: Request & { $user?: AuthUser }, res: Response, next: NextFunction) => {
        const user = req.$user;
        const { authRoles } = findRolesByPathAndMethod(roleTree, req.path, req.method);

        if (authRoles.length === 0) {
            // No auth requirements for this route
            return next();
        }

        if (!user) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // Find if user's authAssetId matches any of the required auth sources
        const matchingAuth = authRoles.find(ar => ar.authId === user.authAssetId);
        
        if (!matchingAuth) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // If no specific roles are required for this auth, allow access
        if (matchingAuth.roleIds.length === 0) {
            return next();
        }

        // Check if user has any of the required roles for this auth
        if (user.roleIds.some((userRoleId) => matchingAuth.roleIds.includes(userRoleId))) {
            return next();
        }

        return res.status(403).json({ message: "Forbidden" });
    };
}

export default createRoleCheckMiddleware;

// Export the internal function for testing
export { findRolesByPathAndMethod, createRoleCheckMiddleware };