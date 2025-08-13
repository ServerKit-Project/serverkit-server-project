import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import {
  Identity,
  IdentityStatus,
  CredentialPlatform,
  CredentialProvider,
} from '@/interface';

export class UserRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: number): Promise<Identity | null> {
    return this.prisma.identity.findUnique({
      where: { id },
      include: {
        credentials: true,
        identityRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string): Promise<Identity | null> {
    return this.prisma.identity.findFirst({
      where: { email },
      include: {
        credentials: true,
        identityRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findByProviderUserId(providerUserId: string): Promise<Identity | null> {
    const credential = await this.prisma.credential.findUnique({
      where: { providerUserId },
      include: {
        identity: {
          include: {
            credentials: true,
            identityRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    return credential?.identity || null;
  }

  async create(data: {
    displayName?: string;
    email?: string;
    status: IdentityStatus;
    userMetadata: any;
  }): Promise<Identity> {
    return this.prisma.identity.create({
      data,
      include: {
        credentials: true,
        identityRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async update(
    id: number,
    data: Partial<{
      displayName: string;
      email: string;
      status: IdentityStatus;
      userMetadata: any;
    }>
  ): Promise<Identity> {
    return this.prisma.identity.update({
      where: { id },
      data,
      include: {
        credentials: true,
        identityRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.identity.delete({
      where: { id },
    });
  }

  async createCredential(data: {
    identityId: number;
    platform: CredentialPlatform;
    provider: CredentialProvider;
    providerUserId: string;
    passwordHash?: string;
  }) {
    return this.prisma.credential.create({
      data,
    });
  }

  async assignRole(identityId: number, roleId: string) {
    return this.prisma.identityRole.create({
      data: {
        identityId,
        roleId,
      },
    });
  }

  async removeRole(identityId: number, roleId: string) {
    return this.prisma.identityRole.delete({
      where: {
        identityId_roleId: {
          identityId,
          roleId,
        },
      },
    });
  }
}
