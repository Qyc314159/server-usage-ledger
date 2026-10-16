# SETUP — 让 AI agent 拿到飞书访问权

> 本 skill **不含任何机器专属信息**：路径相对脚本目录推导，凭据只从 `.env` 读。
> 换机器 / 换人，只重做下面 1–3 步。

## 为什么需要这个

飞书文档的读写必须有一个**应用身份**。AI agent 本身没有，所以要建一个飞书自建应用。

## 步骤

1. 打开 <https://open.feishu.cn/app> → **创建企业自建应用**（名字随意，如 `usage-ledger`）
2. 进「**凭证与基础信息**」→ 复制 **App ID / App Secret**
3. 进「**权限管理**」→ 开通：
   - `docx:document` —— **必需**（读写文档）
   - `drive:drive` —— 可选（云空间信息 / 协作者）
4. 「**版本管理与发布**」→ 创建版本 → 提交发布（若需审批，找租户管理员通过）
5. 建一张飞书文档，粘贴 [`references/doc-template.md`](references/doc-template.md) 的内容
6. **把该应用加为文档协作者**（应用 → 可编辑）。两种做法：
   - 在文档「分享」里搜应用名添加
   - 或「链接分享 = 租户内可编辑」（更省事，推荐）
7. `cp .env.example .env`，填 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_DOC_TOKEN`
8. 自检：`node scripts/ledger.mjs read` 能读出内容 = 通了

## 常见坑

| 现象 | 原因 / 解法 |
|------|-------------|
| `read` 报权限错误 | 应用没开通 `docx:document`，或文档没分享给应用 |
| 加应用为协作者报 `1063001 Invalid parameter` | 该接口对部分租户不支持 app 成员；改用「链接分享 = 租户可编辑」 |
| 文档建出来了，但人在「我的空间」看不到 | API 建的文档落在**应用空间**。要么发链接、要么把文档**移进人的文件夹**（`POST /open-apis/drive/v1/files/{token}/move`），要么让人自己建文档再分享给应用 |
| 追加进文档后顺序乱掉 | 用了 `blocks/convert` 的返回顺序。用本 skill 的 `ledger.mjs append`（自带顺序可靠的转换器） |
| `node` 版本太老 | 需要 ≥ 18（内置 `fetch`） |

## 多人共用怎么配

- 台账是**一张文档、多人维护**：建议**共用一个应用**（把 App ID/Secret 发给各自的 AI），
  而不是每人建一个（否则要逐个加协作者）。
- App Secret 属于**共享密钥**：只放进各自的 `.env`，**不要写进文档、不要提交进 git**。
- `.env.example` 里没有真实密钥，可安全分发。
