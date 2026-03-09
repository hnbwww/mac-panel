import { Router, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { AuthRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/permission';
import { logOperation } from '../middlewares/auditLog';

const execAsync = promisify(exec);
const router = Router();

interface ClaudeMemoryConfig {
  autoMemory: boolean;
  autoBackup: boolean;
  backupInterval: number; // hours
}

interface YoloConfig {
  enabled: boolean;
  aliasCommand: string;
}

// 获取系统设置
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const settings = {
      claudeMemory: {
        autoMemory: true,
        autoBackup: true,
        backupInterval: 2
      },
      yolo: {
        enabled: false,
        aliasCommand: "alias yolo=\"claude --dangerously-skip-permissions\""
      }
    };

    // 检查 yolo alias 是否已配置
    try {
      const { stdout } = await execAsync('grep "alias yolo" ~/.zshrc 2>/dev/null || echo ""');
      settings.yolo.enabled = stdout.trim().length > 0;
    } catch {
      settings.yolo.enabled = false;
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// 配置 Yolo 快捷启动
router.post('/yolo', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;

    if (enabled) {
      // 添加 yolo alias
      const aliasCommand = "alias yolo=\"claude --dangerously-skip-permissions\"";

      try {
        // 检查 .zshrc 是否存在
        const zshrcPath = path.join(process.env.HOME || '', '.zshrc');

        // 确保 .zshrc 存在
        if (!await fs.pathExists(zshrcPath)) {
          await fs.writeFile(zshrcPath, '');
        }

        // 检查是否已存在
        const { stdout } = await execAsync(`grep "alias yolo" ${zshrcPath} 2>/dev/null || echo ""`);

        if (!stdout.trim()) {
          // 不存在则添加
          await execAsync(`echo '${aliasCommand}' >> ${zshrcPath}`);

          // 重新加载 zshrc
          await execAsync('source ~/.zshrc');

          // 记录操作
          await logOperation(
            req.userId!,
            req.username!,
            'enable_yolo_alias',
            '/api/settings/yolo',
            { enabled: true },
            getClientIP(req),
            'success'
          );

          res.json({ success: true, message: 'Yolo 快捷启动已配置' });
        } else {
          res.json({ success: true, message: 'Yolo 快捷启动已存在' });
        }
      } catch (error: any) {
        console.error('Enable yolo error:', error);
        await logOperation(
          req.userId!,
          req.username!,
          'enable_yolo_alias',
          '/api/settings/yolo',
          { enabled: true, error: error.message },
          getClientIP(req),
          'failed'
        );
        res.status(500).json({ error: '配置失败: ' + error.message });
      }
    } else {
      // 禁用 yolo alias
      try {
        const zshrcPath = path.join(process.env.HOME || '', '.zshrc');

        if (await fs.pathExists(zshrcPath)) {
          // 移除 yolo alias 行
          await execAsync(`sed -i '' '/alias yolo/d' ${zshrcPath}`);

          // 重新加载 zshrc
          await execAsync('source ~/.zshrc');

          // 记录操作
          await logOperation(
            req.userId!,
            req.username!,
            'disable_yolo_alias',
            '/api/settings/yolo',
            { enabled: false },
            getClientIP(req),
            'success'
          );

          res.json({ success: true, message: 'Yolo 快捷启动已禁用' });
        } else {
          res.json({ success: true, message: '配置文件不存在' });
        }
      } catch (error: any) {
        console.error('Disable yolo error:', error);
        await logOperation(
          req.userId!,
          req.username!,
          'disable_yolo_alias',
          '/api/settings/yolo',
          { enabled: false, error: error.message },
          getClientIP(req),
          'failed'
        );
        res.status(500).json({ error: '禁用失败: ' + error.message });
      }
    }
  } catch (error) {
    console.error('Yolo settings error:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

// 创建 CLAUDE.md 文件
router.post('/claude-md', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  let projectPath: string = '';

  try {
    ({ projectPath } = req.body);

    if (!projectPath) {
      return res.status(400).json({ error: '请提供项目路径' });
    }

    // 验证路径
    if (!await fs.pathExists(projectPath)) {
      return res.status(400).json({ error: '项目路径不存在' });
    }

    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    const aiMemoryDir = path.join(projectPath, 'AI_MEMORY');

    // 创建 AI_MEMORY 目录结构
    await fs.ensureDir(aiMemoryDir);
    await fs.ensureDir(path.join(aiMemoryDir, 'brain'));
    await fs.ensureDir(path.join(aiMemoryDir, 'progress'));
    await fs.ensureDir(path.join(aiMemoryDir, 'logs'));

    // 创建主 CLAUDE.md 文件
    const claudeMdContent = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 自动记忆规则（必须遵守）

你是长期维护该项目的工程师。每次工作必须执行：

【启动时】
1. 阅读 AI_MEMORY 全部文件
2. 理解当前状态

【执行前】
1. 检查当前项目备份，如果2小时内没有备份，则备份
2. 不能删除数据库、项目文件，实在需要调整，必须首先备份到：原文件名bakup_YYMMDDHHIISS（年月日时分秒，时间精确到秒）

【异常】
会话压缩前，记录关键信息到日志

【执行后】
必须执行三件事：

1）更新认知
更新：AI_MEMORY/brain/project_understanding.md
写入你对系统结构的新理解

2）更新进度
更新：AI_MEMORY/progress/current_status.md
写入当前阶段与下一步

3）记录日志
追加写入：AI_MEMORY/logs/work_log.md
记录时间 + 行为 + 结果

这是强制规则，不需要用户提醒。

---

**最后更新**: ${new Date().toISOString()}
**项目**: ${path.basename(projectPath)}
`;

    await fs.writeFile(claudeMdPath, claudeMdContent);

    // 创建子文件
    await fs.writeFile(
      path.join(aiMemoryDir, 'brain', 'project_understanding.md'),
      `# 项目理解

## 项目概述
项目路径: ${projectPath}

## 技术栈
（待补充）

## 架构说明
（待补充）
`
    );

    await fs.writeFile(
      path.join(aiMemoryDir, 'progress', 'current_status.md'),
      `# 当前状态

## 当前阶段
初始化

## 最近工作
- ${new Date().toLocaleString('zh-CN')}: 创建 AI_MEMORY 结构
`
    );

    await fs.writeFile(
      path.join(aiMemoryDir, 'logs', 'work_log.md'),
      `# 工作日志

## ${new Date().toLocaleString('zh-CN')} - 初始化
- 创建 AI_MEMORY 目录结构
- 初始化 Claude Code 记忆文件
`
    );

    // 记录操作
    await logOperation(
      req.userId!,
      req.username!,
      'create_claude_md',
      '/api/settings/claude-md',
      { projectPath },
      getClientIP(req),
      'success'
    );

    res.json({
      success: true,
      message: 'CLAUDE.md 和 AI_MEMORY 结构已创建',
      files: [
        'CLAUDE.md',
        'AI_MEMORY/brain/project_understanding.md',
        'AI_MEMORY/progress/current_status.md',
        'AI_MEMORY/logs/work_log.md'
      ]
    });
  } catch (error: any) {
    console.error('Create CLAUDE.md error:', error);
    await logOperation(
      req.userId!,
      req.username!,
      'create_claude_md',
      '/api/settings/claude-md',
      { projectPath, error: error.message },
      getClientIP(req),
      'failed'
    );
    res.status(500).json({ error: '创建失败: ' + error.message });
  }
});

// 获取 Yolo 状态
router.get('/yolo/status', async (req: AuthRequest, res: Response) => {
  try {
    const { stdout } = await execAsync('grep "alias yolo" ~/.zshrc 2>/dev/null || echo ""');
    const enabled = stdout.trim().length > 0;

    res.json({ enabled });
  } catch {
    res.json({ enabled: false });
  }
});

function getClientIP(req: AuthRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] as string ||
         req.socket.remoteAddress ||
         'unknown';
}

export default router;
