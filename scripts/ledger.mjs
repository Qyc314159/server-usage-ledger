#!/usr/bin/env node
/**
 * ledger — 维护「服务器使用台账」飞书文档的极简 CLI（供 AI agent / 脚本调用）。
 *
 * 零依赖：只用 Node 18+ 内置 fetch。凭据从环境变量或同目录 .env 读取。
 *
 *   FEISHU_APP_ID      飞书自建应用 App ID
 *   FEISHU_APP_SECRET  飞书自建应用 App Secret
 *   FEISHU_DOC_TOKEN   台账文档 token（飞书 URL /docx/<这一串>）
 *   FEISHU_DOC_URL     可选，设置后 `where` 直接打印它
 *
 * 用法：
 *   node ledger.mjs read                     # 把文档导出为 Markdown（供 AI 读取）
 *   node ledger.mjs read --ids               # 额外打印每个区块的 block_id
 *   node ledger.mjs append <file.md>         # 把一个 Markdown 文件追加到文档
 *   node ledger.mjs append -                 # 从 stdin 读 Markdown 追加
 *   node ledger.mjs del <block_id> [...]     # 删除指定区块（清理窗口外条目）
 *   node ledger.mjs where                    # 输出文档地址
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://open.feishu.cn/open-apis';

function loadEnv() {
  const env = { ...process.env };
  const f = path.join(HERE, '.env');
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const APP_ID = env.FEISHU_APP_ID;
const APP_SECRET = env.FEISHU_APP_SECRET;
const DOC = env.FEISHU_DOC_TOKEN;

if (!APP_ID || !APP_SECRET || !DOC) {
  console.error('缺少 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_DOC_TOKEN（见 .env.example）');
  process.exit(2);
}

let TOKEN = null;
async function api(method, url, body) {
  if (!TOKEN) {
    const r = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    });
    const j = await r.json();
    if (j.code !== 0) throw new Error(`auth failed: ${j.msg}`);
    TOKEN = j.tenant_access_token;
  }
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`${method} ${url} -> ${j.code} ${j.msg}`);
  return j.data;
}

function textOf(b) {
  for (const k of ['text', 'heading1', 'heading2', 'heading3', 'heading4', 'bullet', 'ordered', 'code', 'quote', 'todo']) {
    const e = b[k]?.elements;
    if (e) return e.map((x) => x.text_run?.content ?? '').join('');
  }
  return '';
}

const PREFIX = { 3: '# ', 4: '## ', 5: '### ', 6: '#### ', 12: '- ', 13: '1. ' };

async function cmdRead() {
  const items = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ page_size: '500' });
    if (pageToken) q.set('page_token', pageToken);
    const d = await api('GET', `/docx/v1/documents/${DOC}/blocks?${q}`);
    items.push(...(d.items || []));
    pageToken = d.page_token || '';
  } while (pageToken);

  const byParent = new Map();
  const byId = new Map();
  for (const b of items) {
    byId.set(b.block_id, b);
    if (!byParent.has(b.parent_id)) byParent.set(b.parent_id, []);
    byParent.get(b.parent_id).push(b);
  }
  // 优先用父块的 children 数组保证文档顺序，缺失时退回 API 顺序
  const kidsOf = (id) => {
    const order = byId.get(id)?.children;
    if (Array.isArray(order) && order.length) {
      return order.map((cid) => byId.get(cid)).filter(Boolean);
    }
    return byParent.get(id) || [];
  };
  const out = [];
  const walk = (id, depth) => {
    for (const b of kidsOf(id)) {
      const t = textOf(b);
      if (b.block_type === 14) out.push('```\n' + t + '\n```');
      else if (PREFIX[b.block_type]) out.push(' '.repeat(depth * 2) + PREFIX[b.block_type] + t);
      else if (t) out.push(t);
      out.push(''); // block id 便于 del：见 --ids
      walk(b.block_id, depth + 1);
    }
  };
  walk(DOC, 0);
  if (process.argv.includes('--ids')) {
    for (const b of items) if (textOf(b)) out.push(`<!-- ${b.block_id} | ${textOf(b).slice(0, 40)} -->`);
  }
  console.log(out.join('\n'));
}

const _el = (content) => [{ text_run: { content, text_element_style: {} } }];

/** Markdown → 飞书区块（自建，保证顺序；不用 convert 接口——它返回的区块顺序是乱的）。 */
function mdToBlocks(md) {
  const out = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      const code = buf.join('\n');
      if (code.trim()) out.push({ block_type: 14, code: { elements: _el(code), style: { language: 1, wrap: false } } });
      continue;
    }
    if (!line.trim()) continue;
    const clean = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    if (line.startsWith('### ')) { out.push({ block_type: 5, heading3: { elements: _el(clean.slice(4)), style: {} } }); continue; }
    if (line.startsWith('## ')) { out.push({ block_type: 4, heading2: { elements: _el(clean.slice(3)), style: {} } }); continue; }
    if (line.startsWith('# ')) { out.push({ block_type: 3, heading1: { elements: _el(clean.slice(2)), style: {} } }); continue; }
    if (line.startsWith('- ')) { out.push({ block_type: 12, bullet: { elements: _el(clean.slice(2)), style: {} } }); continue; }
    if (/^\d+\. /.test(line)) { out.push({ block_type: 13, ordered: { elements: _el(clean.replace(/^\d+\. /, '')), style: {} } }); continue; }
    if (line.startsWith('> ')) { out.push({ block_type: 2, text: { elements: _el(clean.slice(2)), style: {} } }); continue; }
    out.push({ block_type: 2, text: { elements: _el(clean), style: {} } });
  }
  return out;
}

async function cmdAppend(src) {
  const md = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8');
  const blocks = mdToBlocks(md);
  let added = 0;
  for (let i = 0; i < blocks.length; i += 40) {
    const chunk = blocks.slice(i, i + 40);
    const data = chunk.length === blocks.length ? { children: chunk } : { children: chunk, index: added };
    const r = await api('POST', `/docx/v1/documents/${DOC}/blocks/${DOC}/children`, data);
    added += (r.children || []).length;
  }
  console.log(JSON.stringify({ ok: true, appended_blocks: added }));
}

async function listAllBlocks() {
  const items = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ page_size: '500' });
    if (pageToken) q.set('page_token', pageToken);
    const d = await api('GET', `/docx/v1/documents/${DOC}/blocks?${q}`);
    items.push(...(d.items || []));
    pageToken = d.page_token || '';
  } while (pageToken);
  return items;
}

async function cmdDel(ids) {
  const all = await listAllBlocks();
  const byParent = new Map();
  for (const b of all) {
    if (!byParent.has(b.parent_id)) byParent.set(b.parent_id, []);
    byParent.get(b.parent_id).push(b);
  }
  const index = new Map();
  for (const [, kids] of byParent) kids.forEach((b, i) => index.set(b.block_id, i));

  const results = [];
  // 按父块分组，从大到小删，避免索引位移
  const groups = new Map();
  for (const id of ids) {
    const b = all.find((x) => x.block_id === id);
    if (!b) {
      results.push({ id, ok: false, why: 'not found' });
      continue;
    }
    if (!groups.has(b.parent_id)) groups.set(b.parent_id, []);
    groups.get(b.parent_id).push(index.get(id));
  }
  for (const [parent, idxs] of groups) {
    idxs.sort((a, b) => b - a);
    for (const i of idxs) {
      await api('DELETE', `/docx/v1/documents/${DOC}/blocks/${parent}/children/batch_delete`, {
        start_index: i,
        end_index: i + 1,
      });
      results.push({ parent, index: i, ok: true });
    }
  }
  console.log(JSON.stringify({ ok: true, deleted: results.filter((r) => r.ok).length, results }));
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'read') await cmdRead();
  else if (cmd === 'append') await cmdAppend(rest[0]);
  else if (cmd === 'del') await cmdDel(rest);
  else if (cmd === 'where') {
    console.log(env.FEISHU_DOC_URL || `doc_token=${DOC}（未设置 FEISHU_DOC_URL）`);
  }
  else {
    console.error(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(1);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
