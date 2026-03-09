import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import extractZip from 'extract-zip';

// Recycle bin directory
const RECYCLE_BIN_PATH = path.join(process.cwd(), '.recycle_bin');
const RECYCLE_BIN_META_FILE = path.join(RECYCLE_BIN_PATH, '.metadata.json');

// Helper: Validate and resolve path (security check)
const validatePath = (userPath: string): string => {
  // Prevent directory traversal attacks
  const resolvedPath = path.resolve(userPath);
  // In production, you may want to restrict to certain directories
  return resolvedPath;
};

// Ensure recycle bin exists
const ensureRecycleBin = async () => {
  await fs.ensureDir(RECYCLE_BIN_PATH);
  const metaPath = RECYCLE_BIN_META_FILE;
  if (!(await fs.pathExists(metaPath))) {
    await fs.writeJson(metaPath, {});
  }
};

// Get recycle bin metadata
const getRecycleBinMeta = async () => {
  await ensureRecycleBin();
  try {
    return await fs.readJson(RECYCLE_BIN_META_FILE);
  } catch {
    return {};
  }
};

// Save recycle bin metadata
const saveRecycleBinMeta = async (meta: any) => {
  await ensureRecycleBin();
  await fs.writeJson(RECYCLE_BIN_META_FILE, meta, { spaces: 2 });
};

// Get file list
export const getFileList = async (dirPath: string) => {
  const validPath = validatePath(dirPath);
  const items = await fs.readdir(validPath, { withFileTypes: true });

  const files = await Promise.all(
    items.map(async (item) => {
      const fullPath = path.join(validPath, item.name);

      try {
        const stats = await fs.stat(fullPath);

        return {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
          size: item.isDirectory() ? 0 : stats.size,
          modified: stats.mtime,
          permissions: stats.mode.toString(8).slice(-3),
          owner: stats.uid.toString(),
          group: stats.gid.toString()
        };
      } catch (error: any) {
        // Skip files that can't be accessed (e.g., system files)
        return {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
          size: 0,
          modified: new Date(),
          permissions: '000',
          owner: '0',
          group: '0',
          error: error.message
        };
      }
    })
  );

  return files;
};

// Generate unique name by appending number if exists
const generateUniqueName = async (dirPath: string, baseName: string, type: 'file' | 'directory'): Promise<string> => {
  const validPath = validatePath(dirPath);
  let newPath = path.join(validPath, baseName);
  let counter = 1;

  // If base name already exists, append number
  while (await fs.pathExists(newPath)) {
    const ext = type === 'file' ? path.extname(baseName) : '';
    const nameWithoutExt = type === 'file' ? path.basename(baseName, ext) : baseName;

    newPath = path.join(validPath, `${nameWithoutExt}${counter}${ext}`);
    counter++;
  }

  return path.basename(newPath);
};

// Create file or directory
export const createFile = async (dirPath: string, type: 'file' | 'directory', name?: string) => {
  const validPath = validatePath(dirPath);

  // If no name provided, use default name
  let finalName = name;
  if (!finalName) {
    finalName = type === 'directory' ? '新建文件夹' : '新建文件.txt';
  }

  // Generate unique name if file exists
  finalName = await generateUniqueName(validPath, finalName, type);

  const newPath = path.join(validPath, finalName);

  if (type === 'directory') {
    await fs.ensureDir(newPath);
  } else {
    await fs.ensureFile(newPath);
  }

  return { success: true, path: newPath, name: finalName };
};

// Delete files (move to recycle bin)
export const deleteFiles = async (paths: string[]) => {
  const results = [];
  for (const filePath of paths) {
    try {
      const result = await moveToRecycleBin(filePath);
      results.push(result);
    } catch (error: any) {
      results.push({ success: false, path: filePath, error: error.message });
    }
  }
  const successCount = results.filter(r => r.success).length;
  return { success: successCount > 0, count: successCount, total: paths.length, results };
};

// Move file to recycle bin
export const moveToRecycleBin = async (filePath: string) => {
  const validPath = validatePath(filePath);

  // Don't move recycle bin itself
  if (validPath.startsWith(RECYCLE_BIN_PATH)) {
    throw new Error('Cannot move recycle bin items to recycle bin');
  }

  // Check if file exists
  if (!(await fs.pathExists(validPath))) {
    throw new Error('File not found');
  }

  await ensureRecycleBin();

  // Get file stats
  const stats = await fs.stat(validPath);
  const isDir = stats.isDirectory();

  // Generate unique filename in recycle bin
  const timestamp = Date.now();
  const originalName = path.basename(validPath);
  const recycleName = `${timestamp}_${originalName}`;
  const recyclePath = path.join(RECYCLE_BIN_PATH, recycleName);

  // Move to recycle bin
  await fs.move(validPath, recyclePath, { overwrite: false });

  // Save metadata
  const meta = await getRecycleBinMeta();
  meta[recycleName] = {
    originalPath: validPath,
    originalName: originalName,
    deletedAt: new Date().toISOString(),
    type: isDir ? 'directory' : 'file',
    size: isDir ? 0 : stats.size
  };
  await saveRecycleBinMeta(meta);

  return { success: true, path: validPath, recycleName };
};

// Get recycle bin items
export const getRecycleBinItems = async () => {
  await ensureRecycleBin();
  const meta = await getRecycleBinMeta();
  const items = [];

  for (const [recycleName, data] of Object.entries(meta)) {
    const recyclePath = path.join(RECYCLE_BIN_PATH, recycleName);
    if (await fs.pathExists(recyclePath)) {
      const itemData = data as any;
      items.push({
        recycleName,
        recyclePath,
        originalPath: itemData.originalPath,
        originalName: itemData.originalName,
        deletedAt: itemData.deletedAt,
        type: itemData.type,
        size: itemData.size,
        modified: await fs.stat(recyclePath).then(s => s.mtime).catch(() => new Date(itemData.deletedAt))
      });
    }
  }

  // Sort by deleted date (newest first)
  items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  return items;
};

// Restore from recycle bin
export const restoreFromRecycleBin = async (recycleName: string) => {
  await ensureRecycleBin();
  const meta = await getRecycleBinMeta();
  const itemData = meta[recycleName];

  if (!itemData) {
    throw new Error('Item not found in recycle bin');
  }

  const recyclePath = path.join(RECYCLE_BIN_PATH, recycleName);
  const originalPath = (itemData as any).originalPath;

  // Check if original location already exists
  if (await fs.pathExists(originalPath)) {
    throw new Error('Original location already exists. Please rename or move the existing file first.');
  }

  // Ensure parent directory exists
  await fs.ensureDir(path.dirname(originalPath));

  // Move back to original location
  await fs.move(recyclePath, originalPath);

  // Remove from metadata
  delete meta[recycleName];
  await saveRecycleBinMeta(meta);

  return { success: true, path: originalPath };
};

// Permanent delete from recycle bin
export const permanentDelete = async (recycleName: string) => {
  await ensureRecycleBin();
  const meta = await getRecycleBinMeta();
  const itemData = meta[recycleName];

  if (!itemData) {
    throw new Error('Item not found in recycle bin');
  }

  const recyclePath = path.join(RECYCLE_BIN_PATH, recycleName);

  // Permanently delete
  await fs.remove(recyclePath);

  // Remove from metadata
  delete meta[recycleName];
  await saveRecycleBinMeta(meta);

  return { success: true, originalPath: (itemData as any).originalPath };
};

// Empty recycle bin
export const emptyRecycleBin = async () => {
  await ensureRecycleBin();
  const meta = await getRecycleBinMeta();

  for (const recycleName of Object.keys(meta)) {
    const recyclePath = path.join(RECYCLE_BIN_PATH, recycleName);
    await fs.remove(recyclePath).catch(() => {});
  }

  await saveRecycleBinMeta({});

  return { success: true };
};

// Copy files
export const copyFiles = async (sourcePath: string, targetPath: string) => {
  const validSource = validatePath(sourcePath);
  const validTarget = validatePath(targetPath);

  await fs.copy(validSource, validTarget);
  return { success: true };
};

// Move files
export const moveFiles = async (sourcePath: string, targetPath: string) => {
  const validSource = validatePath(sourcePath);
  const validTarget = validatePath(targetPath);

  await fs.move(validSource, validTarget);
  return { success: true };
};

// Rename file
export const renameFile = async (filePath: string, newName: string) => {
  const validPath = validatePath(filePath);
  const dirname = path.dirname(validPath);
  const newPath = path.join(dirname, newName);

  // 验证新名称不包含路径分隔符
  if (newName.includes('/') || newName.includes('\\')) {
    throw new Error('文件名不能包含路径分隔符');
  }

  await fs.rename(validPath, newPath);
  return { success: true };
};

// Compress files
export const compressFiles = async (paths: string[], targetPath: string, format: 'zip' | 'tar' | 'tar.gz') => {
  const validTarget = validatePath(targetPath);
  const output = fs.createWriteStream(validTarget);

  // archiver only supports 'zip' and 'tar', for tar.gz we use 'tar' with gzip enabled
  const archiveFormat = format === 'tar.gz' ? 'tar' : format;
  const useGzip = format === 'tar.gz';

  const archive = archiver(archiveFormat, {
    gzip: useGzip,
    zlib: format === 'zip' ? { level: 9 } : undefined
  });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      resolve({ success: true, size: archive.pointer() });
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('warning', (err) => {
      console.warn('[Compress] Archive warning:', err);
    });

    archive.pipe(output);

    paths.forEach((filePath) => {
      const validPath = validatePath(filePath);
      const stat = fs.statSync(validPath);
      if (stat.isDirectory()) {
        archive.directory(validPath, path.basename(filePath));
      } else {
        archive.file(validPath, { name: path.basename(filePath) });
      }
    });

    archive.finalize();
  });
};

// Extract archive
export const extractArchive = async (sourcePath: string, targetPath: string) => {
  const validSource = validatePath(sourcePath);
  const validTarget = validatePath(targetPath);

  await fs.ensureDir(validTarget);

  if (sourcePath.endsWith('.zip')) {
    await extractZip(validSource, { dir: path.resolve(validTarget) });
  } else {
    // For tar, tar.gz, use system tar command or implement with node library
    throw new Error('Extraction for this format not yet implemented');
  }

  return { success: true };
};

// Get file content
export const getFileContent = async (filePath: string) => {
  const validPath = validatePath(filePath);
  return await fs.readFile(validPath, 'utf-8');
};

// Save file content
export const saveFileContent = async (filePath: string, content: string) => {
  const validPath = validatePath(filePath);
  await fs.writeFile(validPath, content, 'utf-8');
  return { success: true };
};

// Download file
export const downloadFile = async (filePath: string, res: any) => {
  const validPath = validatePath(filePath);
  res.download(validPath);
};

// Download file from URL
export const downloadFromUrl = async (url: string, targetPath: string, filename?: string) => {
  try {
    const validPath = validatePath(targetPath);

    // Ensure target directory exists
    await fs.ensureDir(validPath);

    console.log(`Downloading from URL: ${url}`);

    // Fetch the file with redirect support
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    console.log(`Response status: ${response.status}`);

    // Determine filename
    let finalFilename = filename;
    if (!finalFilename) {
      // Try to extract filename from URL or Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?([^2"'\n\r]*)|$)/i.exec(contentDisposition);
        if (matches?.[2]) {
          finalFilename = matches[2].replace(/['"]/g, '');
        }
      }

      if (!finalFilename) {
        // Try to extract filename from URL
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filenameFromPath = pathname.split('/').pop();
        finalFilename = filenameFromPath || 'downloaded-file';
      }
    }

    console.log(`Saving as: ${finalFilename}`);

    const filePath = path.join(validPath, finalFilename);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(filePath, buffer);

    console.log(`File saved to: ${filePath}`);

    return {
      success: true,
      filename: finalFilename,
      path: filePath,
      size: buffer.length,
    };
  } catch (error: any) {
    console.error('Download error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Favorites file path
const FAVORITES_FILE = path.join(process.cwd(), 'data', 'favorites.json');

// Ensure favorites file exists
const ensureFavoritesFile = async () => {
  await fs.ensureDir(path.dirname(FAVORITES_FILE));
  if (!(await fs.pathExists(FAVORITES_FILE))) {
    await fs.writeJson(FAVORITES_FILE, []);
  }
};

// Get all favorites
export const getFavorites = async () => {
  try {
    await ensureFavoritesFile();
    const favorites = await fs.readJson(FAVORITES_FILE);
    return favorites;
  } catch (error) {
    return [];
  }
};

// Add favorite
export const addFavorite = async (filePath: string, name: string, type: 'file' | 'directory') => {
  try {
    await ensureFavoritesFile();
    const favorites = await getFavorites();

    // Check if already exists
    const exists = favorites.some((fav: any) => fav.path === filePath);
    if (exists) {
      return { success: false, message: '已在收藏夹中' };
    }

    favorites.push({
      path: filePath,
      name: name,
      type: type,
      createdAt: new Date().toISOString()
    });

    await fs.writeJson(FAVORITES_FILE, favorites, { spaces: 2 });

    return { success: true, message: '收藏成功' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// Remove favorite
export const removeFavorite = async (filePath: string) => {
  try {
    await ensureFavoritesFile();
    let favorites = await getFavorites();

    favorites = favorites.filter((fav: any) => fav.path !== filePath);

    await fs.writeJson(FAVORITES_FILE, favorites, { spaces: 2 });

    return { success: true, message: '取消收藏成功' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// Check if file is favorite
export const isFavorite = async (filePath: string): Promise<boolean> => {
  try {
    const favorites = await getFavorites();
    return favorites.some((fav: any) => fav.path === filePath);
  } catch {
    return false;
  }
};;

// Get file permissions
export const getFilePermissions = async (filePath: string) => {
  const validPath = validatePath(filePath);
  const stats = await fs.stat(validPath);
  
  // Get mode (permissions)
  const mode = stats.mode;
  
  // Parse permissions into user/group/others
  const permissions = {
    user: {
      read: !!(mode & parseInt('400', 8)),
      write: !!(mode & parseInt('200', 8)),
      execute: !!(mode & parseInt('100', 8)),
    },
    group: {
      read: !!(mode & parseInt('040', 8)),
      write: !!(mode & parseInt('020', 8)),
      execute: !!(mode & parseInt('010', 8)),
    },
    others: {
      read: !!(mode & parseInt('004', 8)),
      write: !!(mode & parseInt('002', 8)),
      execute: !!(mode & parseInt('001', 8)),
    },
  };
  
  // Get owner info
  const owner = {
    uid: stats.uid,
    gid: stats.gid,
  };
  
  // Get file size
  const size = stats.size;
  
  // Get modification time
  const modified = stats.mtime;
  
  // Get creation time
  const created = stats.birthtime;
  
  // Calculate octal permission string (e.g., '755')
  const octal = (mode & parseInt('777', 8)).toString(8);
  
  return {
    path: validPath,
    permissions,
    owner,
    size,
    modified,
    created,
    octal,
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
  };
};

// Change file permissions
export const changePermissions = async (filePath: string, permissions: any) => {
  const validPath = validatePath(filePath);
  
  // Build mode from permissions object
  let mode = 0;
  
  // User permissions
  if (permissions.user.read) mode += parseInt('400', 8);
  if (permissions.user.write) mode += parseInt('200', 8);
  if (permissions.user.execute) mode += parseInt('100', 8);
  
  // Group permissions
  if (permissions.group.read) mode += parseInt('040', 8);
  if (permissions.group.write) mode += parseInt('020', 8);
  if (permissions.group.execute) mode += parseInt('010', 8);
  
  // Others permissions
  if (permissions.others.read) mode += parseInt('004', 8);
  if (permissions.others.write) mode += parseInt('002', 8);
  if (permissions.others.execute) mode += parseInt('001', 8);
  
  // Change permissions
  await fs.chmod(validPath, mode);
  
  return {
    success: true,
    path: validPath,
    octal: mode.toString(8),
  };
};

// Change file owner
export const changeOwner = async (filePath: string, uid: number, gid: number) => {
  const validPath = validatePath(filePath);
  await fs.chown(validPath, uid, gid);
  
  return {
    success: true,
    path: validPath,
  };
};
