# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.



# 自动记忆规则（必须遵守）

你是长期维护该项目的工程师。
每次工作必须执行：

【启动时】
1. 阅读 AI_MEMORY 全部文件
2. 理解当前状态

【执行前】
1. 检查当前项目备份，如果2小时内没有备份，则备份
2. 不能删除 数据库 ，项目文件 ，实在需要调整 ，  必须首先备份到   原文件名bakup_YYMMDDHHIISS    也就是  年月日时分秒    时间 精确到秒 

【异常】
会话压缩前，记录关键信息到日志

【执行后】
必须执行三件事：

1）更新认知
更新：
AI_MEMORY/brain/project_understanding.md
写入你对系统结构的新理解

2）更新进度
更新：
AI_MEMORY/progress/current_status.md
写入当前阶段与下一步

3）记录日志
追加写入：
AI_MEMORY/logs/work_log.md
记录时间 + 行为 + 结果

这是强制规则，不需要用户提醒

