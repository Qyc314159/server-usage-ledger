# AI 操作规范（维护细则）

> 本文件是给 **AI agent** 的完整执行规范。文档内的「二、AI 操作规范」是它的精简版。

## 0. 你负责什么

人类只填「三、填写区」。你要做四件事：

1. **读**：把最新文档读出来
2. **追加/更新**：把新记录写进「三、填写区」，按日期分组
3. **重算**：覆写「四、AI 读取区」（结构化 YAML）
4. **清理**：删掉窗口外的条目

**滚动窗口 = 今天 −N 天 ~ 今天 +N 天**（`LEDGER_WINDOW_DAYS`，默认 3）。
> **别自己算窗口** —— 跑 `node scripts/ledger.mjs window`，它按配置返回 `[起, 止]`。

## 1. 工具

```bash
node scripts/ledger.mjs read             # 文档 → Markdown
node scripts/ledger.mjs read --ids       # 附带 block_id（清理时用）
node scripts/ledger.mjs append <file.md> # 追加 Markdown
node scripts/ledger.mjs del <block_id>... # 删除区块
node scripts/ledger.mjs window           # 打印滚动窗口（按 LEDGER_WINDOW_DAYS）
node scripts/ledger.mjs where            # 文档地址
```

凭据来自同目录 `.env`（`FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_DOC_TOKEN`）。

**若 CLI 不可用**，直接调飞书 OpenAPI：

| 动作 | 接口 |
|------|------|
| 取 token | `POST /open-apis/auth/v3/tenant_access_token/internal` |
| 读 | `GET /open-apis/docx/v1/documents/{doc}/blocks?page_size=500` |
| 追加 | `POST /open-apis/docx/v1/documents/blocks/convert` → 再 `POST /open-apis/docx/v1/documents/{doc}/blocks/{doc}/children` |
| 删 | `DELETE /open-apis/docx/v1/documents/{doc}/blocks/{parent}/children/batch_delete`（`{start_index,end_index}`） |

> ⚠️ `blocks/convert` 返回的**顺序是乱的**，别直接按数组顺序建块。

## 2. 记录格式（写入「三、填写区」）

按日期分组（`### YYYY-MM-DD`），每条：

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
  status: planned
  note: ""
```

规则：
- **纯文本或代码块均可**，保持字段完整、缩进一致即可。
- **缺字段留空**，不要编造。`hours` 能从 `start`/`end` 算出来就补上。
- 同一天多条 → 同一天下面写多条。
- 更新既有条目时**整条替换**，不要留半条。

## 3. AI 读取区格式（覆写「四、AI 读取区」的 YAML 代码块）

```yaml
window: ["2026-10-12", "2026-10-18"]     # 用 `ledger.mjs window` 输出，别手算
generated_at: "2026-10-15T10:00:00+08:00"   # 本机时区的当前时间
summary:
  total_card_hours: 128.0                # Σ(hours × len(cards))
  by_user: { A: 64.0, B: 64.0 }          # 人 → 卡·小时
  by_card: { 0: 16.0, 1: 16.0 }          # 卡号 → 小时
conflicts: []                            # 同卡同时段重叠：[{cards:[0], a:"...", b:"..."}]
entries: []                              # 规范化后的逐条记录（同 §2 字段）
```

## 4. 每次操作的标准流程

1. `read --ids`（拿到最新内容 + block_id）
2. `window`（拿到本次要保留的日期区间）
3. 判断要**追加**、**更新**还是**删除**
4. 写入 / 修改
5. **重算 §3**：只用窗口内的条目
6. **清理**：`del` 掉窗口外的条目（早于起点 / 晚于终点）
7. 回读一次确认

## 5. 铁律

- **只写「三、填写区」和「四、AI 读取区」**。**不要**改「一、使用说明」「二、AI 操作规范」。
- **删除前把清单说给人类听**，确认后再删。
- **不猜数据**：拿不准就留空并标 `note: "待确认"`。
- **冲突要点名**：同卡同时段两人用 → 写进 `conflicts` 并提醒人类。
- 不要动文档权限、不要改标题。
