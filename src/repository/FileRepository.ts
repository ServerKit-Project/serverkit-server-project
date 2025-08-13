import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import { FileInfo } from '@/interface';

export class FileRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<FileInfo | null> {
    return this.prisma.fileInfo.findUnique({
      where: { id },
    });
  }

  async create(data: {
    size: number;
    filename: string;
    mimetype: string;
    filePath?: string;
    originalname: string;
  }): Promise<FileInfo> {
    return this.prisma.fileInfo.create({
      data,
    });
  }

  async update(
    id: string,
    data: Partial<{
      size: number;
      filename: string;
      mimetype: string;
      filePath: string;
      originalname: string;
    }>
  ): Promise<FileInfo> {
    return this.prisma.fileInfo.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.fileInfo.delete({
      where: { id },
    });
  }

  async findAll(limit?: number, offset?: number): Promise<FileInfo[]> {
    return this.prisma.fileInfo.findMany({
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByMimetype(mimetype: string): Promise<FileInfo[]> {
    return this.prisma.fileInfo.findMany({
      where: {
        mimetype: {
          contains: mimetype,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
