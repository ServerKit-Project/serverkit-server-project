import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService, UserService, FileService } from '@/service';
import { uploadSingle, uploadMultiple } from '@/middlewares';
import { CredentialPlatform } from '@/interface';

export function createRoutes(
  prisma: PrismaClient,
  authService: AuthService,
  userService: UserService,
  fileService: FileService
): Router {
  const router = Router();

  // Auth routes
  router.post('/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, displayName, platform = 'WEB', authAssetId = 'default' } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const sessionData = await authService.register({
        email,
        password,
        displayName,
        platform: platform as CredentialPlatform,
        authAssetId
      });

      res.status(201).json({
        success: true,
        data: sessionData
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Registration failed'
      });
    }
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password, platform = 'WEB', authAssetId = 'default' } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const sessionData = await authService.login({
        email,
        password,
        platform: platform as CredentialPlatform,
        authAssetId
      });

      res.json({
        success: true,
        data: sessionData
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Login failed'
      });
    }
  });

  router.post('/auth/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const sessionData = await authService.refreshToken(refreshToken);

      res.json({
        success: true,
        data: sessionData
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Token refresh failed'
      });
    }
  });

  // User routes
  router.get('/users/me', async (req: Request, res: Response) => {
    try {
      if (!req.$user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await userService.getUserById(req.$user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
          userMetadata: user.userMetadata,
          roles: user.identityRoles.map((ir: any) => ({
            id: ir.role.id,
            name: ir.role.name,
            authAssetId: ir.role.authAssetId
          }))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get user'
      });
    }
  });

  router.put('/users/me', async (req: Request, res: Response) => {
    try {
      if (!req.$user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { displayName, userMetadata } = req.body;

      const updatedUser = await userService.updateUser(req.$user.id, {
        displayName,
        userMetadata
      });

      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          status: updatedUser.status,
          userMetadata: updatedUser.userMetadata
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update user'
      });
    }
  });

  // File routes
  router.post('/files/upload', uploadSingle, async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const fileInfo = await fileService.saveFile({
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer
      });

      res.status(201).json({
        success: true,
        data: fileInfo
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'File upload failed'
      });
    }
  });

  router.post('/files/upload/multiple', uploadMultiple, async (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const uploadPromises = req.files.map((file: Express.Multer.File) => 
        fileService.saveFile({
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer
        })
      );

      const fileInfos = await Promise.all(uploadPromises);

      res.status(201).json({
        success: true,
        data: fileInfos
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'File upload failed'
      });
    }
  });

  router.get('/files/:fileId', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const result = await fileService.getFileStream(fileId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const { stream, fileInfo } = result;

      res.setHeader('Content-Type', fileInfo.mimetype);
      res.setHeader('Content-Length', fileInfo.size);
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.originalname}"`);

      stream.pipe(res);

      stream.on('error', (error: Error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error reading file'
          });
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get file'
      });
    }
  });

  router.get('/files/:fileId/download', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const result = await fileService.getFileStream(fileId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const { stream, fileInfo } = result;

      res.setHeader('Content-Type', fileInfo.mimetype);
      res.setHeader('Content-Length', fileInfo.size);
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.originalname}"`);

      stream.pipe(res);

      stream.on('error', (error: Error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error reading file'
          });
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to download file'
      });
    }
  });

  router.delete('/files/:fileId', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      
      await fileService.deleteFile(fileId);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error: any) {
      const statusCode = error.message === 'File not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete file'
      });
    }
  });

  router.get('/files', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const mimetype = req.query.mimetype as string;

      const fileOptions: { limit?: number; offset?: number; mimetype?: string } = {};
      if (limit !== undefined) fileOptions.limit = limit;
      if (offset !== undefined) fileOptions.offset = offset;
      if (mimetype) fileOptions.mimetype = mimetype;
      
      const files = await fileService.listFiles(fileOptions);

      res.json({
        success: true,
        data: files
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to list files'
      });
    }
  });

  return router;
}