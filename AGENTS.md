# AGENTS.md — 服务器使用台账 · AI 执行规范

> 给 AI agent（Codex 等）看的。人类操作说明见 [`README.md`](README.md)。
> 完整细则见 [`references/maintenance-rules.md`](references/maintenance-rules.md)。

## 你负责什么

人类只填「三、填写区」。你做四件事：**读 → 追加/更新 → 重算读取区 → 清理窗口**。

**滚动窗口 = 今天 −N 天 ~ 今天 +N 天**（`LEDGER_WINDOW_DAYS`，默认 3）。
> 别自己算，直接跑：`node scripts/ledger.mjs window`

## 工具

```bash
node scripts/ledger.mjs read             # 文档 → Markdown
node scripts/ledger.mjs read --ids       # 附带 block_id
node scripts/ledger.mjs append <file.md> # 追加 Markdown
node scripts/ledger.mjs del <block_id>   # 删除区块
node scripts/ledger.mjs window           # 打印当前滚动窗口
node scripts/ledger.mjs where            # 文档地址
```

凭据在 `.env`（`FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_DOC_TOKEN`）。**不要打印或外发 `.env`。**

## 记录格式（写入「三、填写区」）

```yaml
- date: 2026-10-15
  user: A
  cards: [0, 1, 2, 3]
  start: "09:00"
  end: "18:00"
  hours: 9.0
  task: "xxx 训练"
  batch_size: 64
  parallel: true
  parallel_mode: "DDP 4卡"
  can_parallel: true
  status: planned          # planned | running | done
  note: ""
```

纯文本或代码块均可；缺字段留空、不编造；同一天多条就写多条。

## AI 读取区（覆写其 YAML 代码块）

```yaml
window: ["2026-10-12", "2026-10-18"]
generated_at: "2026-10-15T10:00:00+08:00"   # 用本机时区的当前时间
summary:
  total_card_hours: 128.0
  by_user: { A: 64.0 }
  by_card: { 0: 16.0 }
conflicts: []
entries: []
```

## 铁律

- **只写「三、填写区」和「四、AI 读取区」**；「一、使用说明」「二、AI 操作规范」不要动。
- **删除前先列清单给人类确认。**
- **不猜数据**：拿不准就留空并标 `note: "待确认"`。
- **冲突要点名**：同卡同时段重叠 → 写进 `conflicts` 并提醒。
- 不动文档权限、不改标题。
