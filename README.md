# server-usage-ledger

多人共用一台 GPU / 计算服务器时的**使用台账**：一张飞书文档 + 一个零依赖 CLI + 一套 AI 维护规范。

- 📄 **文档四段**：使用说明 / AI 操作规范 / 填写区 / AI 读取区
- 🔄 **滚动窗口**：只保留「今天 ±3 天」（半径可配，默认 3 天），窗外自动清理
- 🤖 **AI 维护**：人类只登记，AI 负责读写、汇总、冲突检测
- 🧩 **零依赖**：Node ≥ 18，只用内置 `fetch`

## 快速开始

```bash
cp .env.example .env      # 填 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_DOC_TOKEN
node scripts/ledger.mjs read    # 能读出文档 = 配好了
node scripts/ledger.mjs window  # 看当前滚动窗口
```

## 它长什么样

| 段落 | 谁维护 |
|------|--------|
| 一、使用说明 | 人读；AI 不改 |
| 二、AI 操作规范 | 机器读（字段 schema + 维护规则） |
| 三、填写区 | 人 + AI 追加（按日期分组） |
| 四、AI 读取区 | AI 重写（结构化 YAML） |

每条记录的字段：

```yaml
- date: 2026-10-15
  user: A
  cards: [0, 1, 2, 3]
  start: "09:00"
  end: "18:00"
  hours: 9.0
  task: "reco 训练"
  batch_size: 64
  parallel: true
  parallel_mode: "DDP 4卡"
  can_parallel: true
  status: planned          # planned | running | done
  note: ""
```

## 给 AI agent 用

- 通用规范：[`AGENTS.md`](AGENTS.md)
- 维护细则：[`references/maintenance-rules.md`](references/maintenance-rules.md)
- 现成提示词：[`references/codex-prompts.md`](references/codex-prompts.md)
- 文档模板：[`references/doc-template.md`](references/doc-template.md)

## 目录

```
SKILL.md                        # AgentSkill 主文件
AGENTS.md                       # 给 AI agent 的执行规范
SETUP.md                        # 飞书应用配置 + 权限 + 常见坑
scripts/ledger.mjs              # 零依赖 CLI
references/doc-template.md      # 可粘贴的飞书文档模板
references/maintenance-rules.md # 维护细则
references/codex-prompts.md     # 给 Codex 的自检 / 开工提示词
.env.example                    # 凭据模板（无真实密钥）
```

## 许可

MIT
