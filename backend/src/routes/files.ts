import { Router, Request, Response } from 'express';
import * as fileService from '../services/fileService';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import uploadRouter from './filesUpload';

const router = Router();

// Mount upload routes
router.use('/', uploadRouter);

// Get file list
router.get('/list', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const filePath = req.query.path as string || '/';
    const files = await fileService.getFileList(filePath);
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create file or folder
router.post('/create', requirePermission('files', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, type, name } = req.body;
    const result = await fileService.createFile(path, type, name);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
router.post('/delete', requirePermission('files', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { paths } = req.body;
    const result = await fileService.deleteFiles(paths);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Copy files
router.post('/copy', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { sourcePath, targetPath } = req.body;
    const result = await fileService.copyFiles(sourcePath, targetPath);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Move files
router.post('/move', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { sourcePath, targetPath } = req.body;
    const result = await fileService.moveFiles(sourcePath, targetPath);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Compress files
router.post('/compress', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { paths, targetPath, format } = req.body;
    const result = await fileService.compressFiles(paths, targetPath, format);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Extract archive
router.post('/extract', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { sourcePath, targetPath } = req.body;
    const result = await fileService.extractArchive(sourcePath, targetPath);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get file content
router.get('/content', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const filePath = req.query.path as string;
    const content = await fileService.getFileContent(filePath);
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save file content
router.post('/content', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, content } = req.body;
    const result = await fileService.saveFileContent(path, content);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download file
router.get('/download', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const filePath = req.query.path as string;
    await fileService.downloadFile(filePath, res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file
router.post('/rename', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, newName } = req.body;
    const result = await fileService.renameFile(path, newName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save file content (alternative endpoint)
router.post('/save', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, content } = req.body;
    const result = await fileService.saveFileContent(path, content);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download file from URL
router.post('/download-url', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { url, path, filename } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const result = await fileService.downloadFromUrl(url, path, filename);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recycle bin items
router.get('/recycle-bin', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const items = await fileService.getRecycleBinItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from recycle bin
router.post('/restore', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { recycleName } = req.body;
    const result = await fileService.restoreFromRecycleBin(recycleName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Permanent delete from recycle bin
router.post('/permanent-delete', requirePermission('files', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { recycleName } = req.body;
    const result = await fileService.permanentDelete(recycleName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Empty recycle bin
router.post('/empty-recycle-bin', requirePermission('files', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await fileService.emptyRecycleBin();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all favorites
router.get('/favorites', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await fileService.getFavorites();
    res.json(favorites);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add favorite
router.post('/favorites/add', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, name, type } = req.body;
    const result = await fileService.addFavorite(path, name, type);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove favorite
router.post('/favorites/remove', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path } = req.body;
    const result = await fileService.removeFavorite(path);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check if favorite
router.get('/favorites/check', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const path = req.query.path as string;
    const isFav = await fileService.isFavorite(path);
    res.json({ isFavorite: isFav });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user home directory
router.get('/home-dir', (req: AuthRequest, res: Response) => {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
    res.json({ homeDir });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

// Get file permissions
router.get('/permissions', requirePermission('files', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: '文件路径不能为空' });
    }
    
    const permissions = await fileService.getFilePermissions(filePath);
    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change file permissions
router.put('/permissions', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, permissions } = req.body;
    
    if (!path || !permissions) {
      return res.status(400).json({ error: '文件路径和权限不能为空' });
    }
    
    const result = await fileService.changePermissions(path, permissions);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change file owner
router.put('/owner', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { path, uid, gid } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: '文件路径不能为空' });
    }
    
    // Note: Changing owner requires root privileges
    // This will likely fail unless running as root
    const result = await fileService.changeOwner(path, uid, gid);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
