import { Request, Response, NextFunction } from 'express';
import { FileService } from '@/service';

export function createDownloadMiddleware(fileService: FileService) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const fileId = req.params.fileId;

      if (!fileId) {
        res.status(400).json({ message: 'File ID is required' });
        return;
      }

      const result = await fileService.getFileStream(fileId);

      if (!result) {
        res.status(404).json({ message: 'File not found' });
        return;
      }

      const { stream, fileInfo } = result;

      res.setHeader('Content-Type', fileInfo.mimetype);
      res.setHeader('Content-Length', fileInfo.size);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileInfo.originalname}"`
      );

      stream.pipe(res);

      stream.on('error', (error: Error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error reading file' });
        }
      });
    } catch (error: any) {
      console.error('Download middleware error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  };
}
