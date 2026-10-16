# 给 Codex / AI agent 的现成提示词

## A. 开工提示词（复制整段发给 AI）

```
你从现在起负责维护飞书文档「服务器使用台账」。

【第一步：只读】
1. 读本 skill 目录下的 AGENTS.md（执行规范）和 README.md（背景）
2. 运行 node scripts/ledger.mjs read --ids 把文档现状读出来
3. 运行 node scripts/ledger.mjs window 拿到本次的滚动窗口

凭据已配在 ledger/.env，直接可用。不要打印/外发 .env 内容。

【第二步：按规范处理本轮记录】
本轮要记的内容：

  （在这里写实际使用情况，例如）
  10 月 15 日 9:00–18:00，我在 0/1/2/3 号卡上跑了 xxx 训练，batch_size 64，
  DDP 4 卡并行；还有 4 张卡空闲可并行。状态：已完成。

【规则提醒】
- 只改「三、填写区」和「四、AI 读取区」；「一、使用说明」「二、AI 操作规范」不要动
- 保持滚动窗口（node scripts/ledger.mjs window 给出的区间）；窗外条目用 del <block_id> 清掉
- 拿不准的字段留空并标 note: "待确认"，不要编数据
- 写完回读一次确认

【命令】（在本 skill 目录下运行）
node scripts/ledger.mjs read --ids
node scripts/ledger.mjs window
node scripts/ledger.mjs append 记录.md
node scripts/ledger.mjs del <block_id>
node scripts/ledger.mjs where

完成后用 3 行以内汇报：记了什么 / 清了什么 / 有无冲突。
```

## B. 环境自检提示词（换机器 / 换人时先发这个）

```
你接下来要维护一张飞书文档（读写走飞书 OpenAPI）。
正式开工前，请做只读自检并结构化汇报。不要修改文件、不要创建东西、不要贴出密钥明文。

请逐项回答，每项一行结论：
1. 运行环境：跑在哪里？当前工作目录？操作系统？
2. Node.js：node -v 是什么？是否 ≥ 18（需要内置 fetch）？
3. 网络：能否访问 open.feishu.cn？实测：
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal -H "Content-Type: application/json" -d '{}'
   （400/200 = 通；000/超时 = 不通）如走代理，说明代理地址。
4. 飞书凭据：有没有可用的飞书自建应用 App ID / App Secret？
   - 有 → 只回答「有」+ App ID 前缀（不要贴 App Secret）
   - 没有 → 回答「无」
5. 文件能力：能否读写本地文件？能否执行 shell 命令？
6. 调度能力：被手动唤起，还是能设定时任务？

汇报完为止，先不要动飞书文档。
```

## C. 为什么需要"自检"这一步

AI agent 要能维护台账，必须凑齐三样：**能连通 `open.feishu.cn`**、**有 Node ≥18**、**有飞书应用凭据**。
第 3 项通常需要人工去开放平台建应用，所以先用 B 问清楚，再决定怎么配。
