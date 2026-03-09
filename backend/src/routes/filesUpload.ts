import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import { db } from '../services/database';

const router = Router();

// 生成唯一文件名（如果文件名已存在，则添加数字后缀）
const generateUniqueFileName = async (originalName: string, uploadPath: string): Promise<string> => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  let fileName = originalName;
  let counter = 1;

  // 检查文件是否已存在
  while (await fs.pathExists(path.join(uploadPath, fileName))) {
    fileName = `${baseName} (${counter})${ext}`;
    counter++;
  }

  return fileName;
};

// 配置 multer 存储 - 先上传到临时目录
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // 上传到临时目录
      const tempDir = path.join(process.cwd(), 'data', 'temp', 'uploads');
      await fs.ensureDir(tempDir);
      cb(null, tempDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // 使用原始文件名，稍后移动时再处理重名
    cb(null, file.originalname);
  }
});

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 允许的文件类型
  const allowedTypes = [
    'image/',
    'text/',
    'application/json',
    'application/xml',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-tar',
    'application/x-gzip',
    'application/javascript',
    'application/typescript',
    'application/octet-stream' // 允许各种二进制文件
  ];

  const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`));
  }
};

// 创建 multer 实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB - 支持大视频文件
    files: 10 // 最多 10 个文件
  }
});

// 文件上传路由
router.post('/upload', requirePermission('files', 'write'), upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // 获取目标路径
    const targetPath = (req.body.path as string) || '/tmp';

    // 确保目标目录存在
    await fs.ensureDir(targetPath);

    console.log('Upload request:', {
      bodyPath: req.body.path,
      targetPath,
      fileCount: files.length,
      files: files.map(f => ({ originalname: f.originalname, tempPath: f.path }))
    });

    // 处理每个文件：从临时目录移动到目标位置
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          // 生成唯一的文件名
          const finalFileName = await generateUniqueFileName(file.originalname, targetPath);
          const finalPath = path.join(targetPath, finalFileName);

          console.log(`Moving file: ${file.path} -> ${finalPath}`);

          // 移动文件到目标位置
          await fs.move(file.path, finalPath, { overwrite: false });

          return {
            originalName: file.originalname,
            filename: finalFileName,
            path: finalPath,
            size: file.size,
            mimetype: file.mimetype
          };
        } catch (error: any) {
          console.error('Error moving file:', error);
          // 如果移动失败，至少返回原始信息
          return {
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            error: error.message
          };
        }
      })
    );

    // 记录上传操作
    for (const file of uploadedFiles) {
      await db.createLog({
        user_id: req.userId || 'unknown',
        username: req.username || 'unknown',
        action: 'upload',
        resource: 'files',
        details: JSON.stringify({
          filename: file.filename,
          size: file.size,
          path: file.path
        }),
        ip: req.ip || 'unknown',
        status: 'success'
      });
    }

    res.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 分片上传 - 初始化
router.post('/upload/chunk/init', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { filename, totalChunks, fileSize } = req.body;

    if (!filename || !totalChunks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const uploadId = crypto.randomBytes(16).toString('hex');
    const chunkDir = path.join(process.cwd(), 'data', 'uploads', uploadId);
    await fs.ensureDir(chunkDir);

    // 保存元数据
    const metadata = {
      uploadId,
      filename,
      totalChunks: parseInt(totalChunks),
      fileSize: parseInt(fileSize) || 0,
      uploadedChunks: [],
      status: 'uploading',
      createdAt: new Date().toISOString()
    };

    await fs.writeJson(path.join(chunkDir, 'metadata.json'), metadata);

    res.json({
      success: true,
      uploadId,
      chunkSize: 5 * 1024 * 1024 // 5MB per chunk
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 分片上传 - 上传分片
router.post('/upload/chunk/:uploadId/:chunkIndex', requirePermission('files', 'write'), upload.single('chunk'), async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId, chunkIndex } = req.params;
    const chunkDir = path.join(process.cwd(), 'data', 'uploads', uploadId);

    // 检查上传目录是否存在
    if (!await fs.pathExists(chunkDir)) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // 保存分片
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    if (req.file) {
      await fs.move(req.file.path, chunkPath);

      // 更新元数据
      const metadataPath = path.join(chunkDir, 'metadata.json');
      const metadata = await fs.readJSON(metadataPath);
      metadata.uploadedChunks.push(parseInt(chunkIndex));
      metadata.lastUpdate = new Date().toISOString();
      await fs.writeJSON(metadataPath, metadata);

      res.json({
        success: true,
        chunkIndex: parseInt(chunkIndex),
        uploaded: metadata.uploadedChunks.length,
        total: metadata.totalChunks
      });
    } else {
      res.status(400).json({ error: 'No chunk file uploaded' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 分片上传 - 完成
router.post('/upload/chunk/:uploadId/complete', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { targetPath } = req.body;

    const chunkDir = path.join(process.cwd(), 'data', 'uploads', uploadId);
    const metadataPath = path.join(chunkDir, 'metadata.json');

    // 检查元数据
    if (!await fs.pathExists(metadataPath)) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    const metadata = await fs.readJSON(metadataPath);

    // 检查是否所有分片都已上传
    if (metadata.uploadedChunks.length !== metadata.totalChunks) {
      return res.status(400).json({
        error: 'Not all chunks uploaded',
        uploaded: metadata.uploadedChunks.length,
        total: metadata.totalChunks
      });
    }

    // 合并分片
    const finalPath = path.join(targetPath || '/tmp', metadata.filename);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      await fs.appendFile(finalPath, await fs.readFile(chunkPath));
    }

    // 清理分片文件
    await fs.remove(chunkDir);

    // 记录上传操作
    await db.createLog({
      user_id: req.userId || 'unknown',
      username: req.username || 'unknown',
      action: 'upload_chunked',
      resource: 'files',
      details: JSON.stringify({
        filename: metadata.filename,
        size: metadata.fileSize,
        path: finalPath
      }),
      ip: req.ip || 'unknown',
      status: 'success'
    });

    res.json({
      success: true,
      filename: metadata.filename,
      path: finalPath,
      size: metadata.fileSize
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 分片上传 - 取消
router.delete('/upload/chunk/:uploadId', requirePermission('files', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const chunkDir = path.join(process.cwd(), 'data', 'uploads', uploadId);

    // 删除分片目录
    if (await fs.pathExists(chunkDir)) {
      await fs.remove(chunkDir);
    }

    res.json({ success: true, message: 'Upload cancelled' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
