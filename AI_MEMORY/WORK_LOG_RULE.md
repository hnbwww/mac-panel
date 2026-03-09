# AI_MEMORY/logs/work_log.md 使用规则

## ⚠️ 重要警告

**work_log.md 是日志文件，只能追加，不能覆盖！**

## 正确操作方法

### 1. 追加日志（✅ 正确）

```bash
cat >> AI_MEMORY/logs/work_log.md << 'EOF'

---

# 日期时间 - 工作标题

内容...

EOF
```

### 2. 使用 Edit 工具（✅ 正确）

只在已有内容的基础上追加，不要替换整个文件。

### 3. 禁止操作（❌ 错误）

```typescript
// ❌ 错误：使用 Write 工具会覆盖整个文件
Write({
  file_path: "AI_MEMORY/logs/work_log.md",
  content: "新内容"  // 这会删除所有历史记录！
})
```

## 安全脚本

创建 `append-work-log.sh` 脚本：
```bash
#!/bin/bash
LOG_FILE="AI_MEMORY/logs/work_log.md"

# 追加日志
cat >> "$LOG_FILE" << 'EOF'

---

# $(date '+%Y-%m-%d %H:%M') - $1

## 问题

$2

## 解决方案

$3

EOF

echo "✅ 日志已追加到 $LOG_FILE"
```

使用方法：
```bash
./append-work-log.sh "修复nginx配置" "配置生成错误" "修改generateSSLConfig方法"
```

## 恢复方法

如果历史记录丢失：
```bash
# 从备份恢复
cp AI_MEMORY-backup-*/logs/work_log.md AI_MEMORY/logs/work_log.md

# 然后追加今天的日志
```

## 检查命令

```bash
# 检查文件大小（应该持续增长）
ls -lh AI_MEMORY/logs/work_log.md

# 检查行数（应该持续增加）
wc -l AI_MEMORY/logs/work_log.md

# 查看最近日志
tail -50 AI_MEMORY/logs/work_log.md
```

## Claude AI 使用规范

当 Claude Code 需要更新 work_log.md 时：

1. **永远不要使用 Write 工具** - 这会覆盖整个文件
2. **使用 Bash + cat >>** 追加内容
3. **或使用 Edit 工具在文件末尾追加**
4. **更新前先检查文件大小** - 如果突然变小，说明出错了

## 当前状态

- 文件位置：AI_MEMORY/logs/work_log.md
- 备份位置：AI_MEMORY-backup-*/logs/work_log.md
- 最后恢复：2026-03-08 07:10
- 当前行数：4882 行
- 当前大小：约 140KB

**记住：日志文件只能增长，不能缩小！**
