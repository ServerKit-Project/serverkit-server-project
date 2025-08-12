import { PrismaClient } from '@prisma/client';
import { UserRepository, RoleRepository } from '@/repository';
import { Identity, IdentityStatus, UserPayload } from '@/interface';

export class UserService {
  private userRepository: UserRepository;
  private roleRepository: RoleRepository;

  constructor(prisma: PrismaClient) {
    this.userRepository = new UserRepository(prisma);
    this.roleRepository = new RoleRepository(prisma);
  }

  async getUserById(id: number): Promise<Identity | null> {
    return this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<Identity | null> {
    return this.userRepository.findByEmail(email);
  }

  async updateUser(id: number, data: {
    displayName?: string;
    email?: string;
    userMetadata?: any;
  }): Promise<Identity> {
    return this.userRepository.update(id, data);
  }

  async updateUserStatus(id: number, status: IdentityStatus): Promise<Identity> {
    return this.userRepository.update(id, { status });
  }

  async deleteUser(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async assignRoleToUser(userId: number, roleId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    const existingRole = user.identityRoles.find((ir: any) => ir.roleId === roleId);
    if (existingRole) {
      throw new Error('User already has this role');
    }

    await this.userRepository.assignRole(userId, roleId);
  }

  async removeRoleFromUser(userId: number, roleId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const existingRole = user.identityRoles.find((ir: any) => ir.roleId === roleId);
    if (!existingRole) {
      throw new Error('User does not have this role');
    }

    await this.userRepository.removeRole(userId, roleId);
  }

  async getUserRoles(userId: number): Promise<Array<{ id: string; name: string; authAssetId: string }>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user.identityRoles.map((ir: any) => ({
      id: ir.role.id,
      name: ir.role.name,
      authAssetId: ir.role.authAssetId
    }));
  }

  async searchUsers(query: {
    email?: string;
    displayName?: string;
    status?: IdentityStatus;
    limit?: number;
    offset?: number;
  }): Promise<Identity[]> {
    // Note: This would require implementing search in the repository
    // For now, we'll return a simple email search
    if (query.email) {
      const user = await this.userRepository.findByEmail(query.email);
      return user ? [user] : [];
    }

    // This is a simplified implementation
    // In a real application, you'd implement proper search functionality
    throw new Error('Search functionality not fully implemented');
  }

  transformToUserPayload(identity: Identity, authAssetId: string): UserPayload {
    const roles = identity.identityRoles.filter((ir: any) => ir.role.authAssetId === authAssetId);
    
    return {
      id: identity.id,
      authAssetId,
      roleIds: roles.map((r: any) => r.roleId),
      roleNames: roles.map((r: any) => r.role.name)
    };
  }
}