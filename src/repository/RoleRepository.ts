import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import { Role } from '@/interface';

export class RoleRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }

  async findByAuthAssetId(authAssetId: string): Promise<Role[]> {
    return this.prisma.role.findMany({
      where: { authAssetId },
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }

  async findByName(name: string, authAssetId: string): Promise<Role | null> {
    return this.prisma.role.findFirst({
      where: {
        name,
        authAssetId,
      },
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }

  async create(data: { name: string; authAssetId: string }): Promise<Role> {
    return this.prisma.role.create({
      data,
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      authAssetId: string;
    }>
  ): Promise<Role> {
    return this.prisma.role.update({
      where: { id },
      data,
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({
      where: { id },
    });
  }

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    return this.prisma.role.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        identityRoles: {
          include: {
            identity: true,
          },
        },
      },
    });
  }
}
