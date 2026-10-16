---
name: server-usage-ledger
description: >
  多人共用一台 GPU / 计算服务器时，用一张飞书文档当「使用台账」：记录谁在什么时候用了哪几张卡、
  跑什么任务、多久、batch_size、是否并行、还有没有并行空间。台账由 AI 读写维护，
  只保留「今天 ±N 天」（`LEDGER_WINDOW_DAYS`，默认 3）的滚动窗口，人类只在填写区登记 —— 解决多人抢卡、互相不知情、排期靠问人的问题。
  触发词：服务器台账、GPU 使用记录、显卡占用、卡占用、并行登记、共享服务器排期、使用日志、
  记录显卡使用、谁在用服务器、飞书台账、usage ledger、server ledger。
---

# 服务器使用台账（Feishu Ledger）

> 给多人共用的服务器（多卡 GPU 机、计算集群等）做一张**由 AI 维护**的使用台账。
> 人类只负责登记，AI 负责读写、汇总、清理窗口。

## 解决什么问题

- 几个人用同一台机器，不知道谁在用哪几张卡 → 抢卡 / 撞车
- 想知道"还能不能并行、还有几张卡空着"→ 只能挨个问人
- 记在群里刷屏，记在自己本子上别人看不到

## 产出

一张飞书文档，四段结构：

| 段落 | 谁维护 |
|------|--------|
| 一、使用说明 | 人读；AI 不改 |
| 二、AI 操作规范 | 机器读（字段 schema + 维护规则）；AI 不改 |
| 三、填写区 | 人 + AI 追加（按日期分组） |
| 四、AI 读取区 | AI 重写（结构化 YAML 汇总） |

**滚动窗口 = 今天 −N 天 ~ 今天 +N 天**（`LEDGER_WINDOW_DAYS`，默认 3），窗外条目自动清理。

## 一次性搭建

1. 在 `open.feishu.cn/app` 建一个**自建应用**（飞书国际版 Lark 用 `open.larksuite.com`），开通权限 `docx:document`（读写文档），发布版本
2. 建一张飞书文档，把 [`references/doc-template.md`](references/doc-template.md) 的内容粘进去
3. 把文档**分享给该应用**（应用 → 可编辑）
4. `cp .env.example .env`，填 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_DOC_TOKEN`
5. 验证：`node scripts/ledger.mjs read`

> 详细步骤（含权限清单、常见坑）见 [`SETUP.md`](SETUP.md)。

## 日常使用

有人跑任务 / 跑完，把情况交给 AI：

> 10 月 15 日 9:00–18:00，我在 0/1/2/3 号卡跑 xxx 训练，batch_size 64，DDP 4 卡并行，
> 另有 4 张卡空闲可并行。状态：已完成。

AI 按 [`references/maintenance-rules.md`](references/maintenance-rules.md) 执行：
**读 → 追加 → 重算读取区 → 清理窗口 → 检测冲突**。

## 工具

零依赖（Node ≥ 18，只用内置 `fetch`）：

```bash
node scripts/ledger.mjs read             # 文档 → Markdown
node scripts/ledger.mjs read --ids       # 附带每个区块的 block_id（清理用）
node scripts/ledger.mjs append <file.md> # Markdown → 飞书区块（顺序可靠）
node scripts/ledger.mjs del <block_id>   # 删除区块（清理窗口外条目）
node scripts/ledger.mjs window           # 打印当前滚动窗口（按 LEDGER_WINDOW_DAYS）
node scripts/ledger.mjs where            # 打印文档地址
```

## 实现注意（踩过的坑）

1. **不要用 `blocks/convert` 的返回顺序建块** —— 它返回的区块顺序是乱的（代码块会跑到最前面）。
   本 skill 自带 markdown→blocks 转换器，顺序可靠。
2. 读文档要按 **page 块的 `children` 数组**排序，不能依赖 blocks 列表的返回顺序。
3. 删除区块用 `DELETE .../blocks/{parent}/children/batch_delete`，需要 `{start_index, end_index}`。
4. 飞书 bot **能直接建 docx**（`POST /open-apis/docx/v1/documents`），但文档落在**应用空间**，
   人类在「我的空间」看不到 —— 要么发链接，要么把应用加为协作者，要么把文档移进人的文件夹。
5. **把"应用"加为文档协作者**这个接口在部分租户恒返 `1063001 Invalid parameter`；
   改用「链接分享 = 租户可编辑」更稳。
6. 换机器 / 换人只需改 `.env`；本 skill **不含任何机器专属路径或凭据**。
