import fs from 'fs-extra';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { FileRepository } from '@/repository';
import { FileInfo } from '@/interface';

export class FileService {
  private fileRepository: FileRepository;
  private uploadPath: string;

  constructor(prisma: PrismaClient, uploadPath = './uploads') {
    this.fileRepository = new FileRepository(prisma);
    this.uploadPath = uploadPath;
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    await fs.ensureDir(this.uploadPath);
  }

  async saveFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): Promise<FileInfo> {
    const fileId = uuid();
    const fileExtension = path.extname(file.originalname);
    const filename = `${fileId}${fileExtension}`;
    const filePath = path.join(this.uploadPath, filename);

    await fs.writeFile(filePath, file.buffer);

    const fileInfo = await this.fileRepository.create({
      size: file.size,
      filename,
      mimetype: file.mimetype,
      filePath,
      originalname: file.originalname
    });

    return fileInfo;
  }

  async getFile(fileId: string): Promise<{ fileInfo: FileInfo; filePath: string } | null> {
    const fileInfo = await this.fileRepository.findById(fileId);
    if (!fileInfo || !fileInfo.filePath) {
      return null;
    }

    const exists = await fs.pathExists(fileInfo.filePath);
    if (!exists) {
      return null;
    }

    return {
      fileInfo,
      filePath: fileInfo.filePath
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const fileInfo = await this.fileRepository.findById(fileId);
    if (!fileInfo) {
      throw new Error('File not found');
    }

    if (fileInfo.filePath) {
      const exists = await fs.pathExists(fileInfo.filePath);
      if (exists) {
        await fs.remove(fileInfo.filePath);
      }
    }

    await this.fileRepository.delete(fileId);
  }

  async getFileStream(fileId: string): Promise<{ stream: fs.ReadStream; fileInfo: FileInfo } | null> {
    const result = await this.getFile(fileId);
    if (!result) {
      return null;
    }

    const stream = fs.createReadStream(result.filePath);
    return {
      stream,
      fileInfo: result.fileInfo
    };
  }

  async listFiles(options: {
    limit?: number;
    offset?: number;
    mimetype?: string;
  } = {}): Promise<FileInfo[]> {
    if (options.mimetype) {
      return this.fileRepository.findByMimetype(options.mimetype);
    }

    return this.fileRepository.findAll(options.limit, options.offset);
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    return this.fileRepository.findById(fileId);
  }

  async updateFileInfo(fileId: string, data: {
    originalname?: string;
  }): Promise<FileInfo> {
    const fileInfo = await this.fileRepository.findById(fileId);
    if (!fileInfo) {
      throw new Error('File not found');
    }

    return this.fileRepository.update(fileId, data);
  }
}