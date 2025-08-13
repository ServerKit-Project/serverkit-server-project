import { Request, Response, NextFunction } from 'express';
import { RoleTreeNode, AuthRole, RoleCheckResult } from '@/interface';

export function findRolesByPathAndMethod(
  root: RoleTreeNode,
  targetPath: string,
  targetMethod: string
): RoleCheckResult {
  const segments = targetPath.split('/').filter(Boolean);
  let currentNode = root;
  const collectedRoles: Array<{ authId: string; roleId: string }> = [];

  for (let i = 0; i < segments.length; i++) {
    if (!currentNode || !currentNode.children) {
      break;
    }

    if (currentNode.roles && currentNode.roles.length > 0) {
      collectedRoles.push(...currentNode.roles);
    }

    const matchingChild = currentNode.children.find(child => {
      const childPath = child.path.startsWith('/')
        ? child.path.slice(1)
        : child.path;
      return childPath === segments[i];
    });

    if (!matchingChild) {
      break;
    }

    currentNode = matchingChild;
  }

  if (!currentNode) {
    return { authRoles: [] };
  }

  if (
    currentNode.method &&
    currentNode.method.toLowerCase() !== targetMethod.toLowerCase()
  ) {
    return { authRoles: [] };
  }

  if (currentNode.roles && currentNode.roles.length > 0) {
    collectedRoles.push(...currentNode.roles);
  }

  const authRolesMap: Record<string, string[]> = {};
  collectedRoles.forEach(role => {
    if (!authRolesMap[role.authId]) {
      authRolesMap[role.authId] = [];
    }
    authRolesMap[role.authId].push(role.roleId);
  });

  const authRoles: AuthRole[] = Object.entries(authRolesMap).map(
    ([authId, roleIds]) => ({
      authId,
      roleIds,
    })
  );

  return { authRoles };
}

export function createRoleCheckMiddleware(roleTree: RoleTreeNode) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.$user;
    const { authRoles } = findRolesByPathAndMethod(
      roleTree,
      req.path,
      req.method
    );

    if (authRoles.length === 0) {
      return next();
    }

    if (!user) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const matchingAuth = authRoles.find(ar => ar.authId === user.authAssetId);

    if (!matchingAuth) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (matchingAuth.roleIds.length === 0) {
      return next();
    }

    if (
      user.roleIds.some((userRoleId: string) =>
        matchingAuth.roleIds.includes(userRoleId)
      )
    ) {
      return next();
    }

    res.status(403).json({ message: 'Forbidden' });
  };
}
