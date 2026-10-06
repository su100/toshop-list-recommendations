#!/usr/bin/env node
// 로컬 HTTP UI: 브라우저에서 쿠팡 HTML 복붙 → recommendations.json 자동 반영.
//
// 실행: node scripts/serve.mjs
// 열기: http://localhost:3131
//
// git / CDN purge 는 수동. 리뷰 후 commit → push → purge 요청.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(__dirname, '..', 'recommendations.json');
const PORT = 3131;

function parseHtml(html) {
  const link = html.match(/href=["']([^"']+)["']/)?.[1];
  const image = html.match(/<img[^>]*\bsrc=["']([^"']+)["']/)?.[1];
  const title = html.match(/<img[^>]*\balt=["']([^"']+)["']/)?.[1];
  const width = html.match(/<img[^>]*\bwidth=["']?(\d+)["']?/)?.[1];
  const height = html.match(/<img[^>]*\bheight=["']?(\d+)["']?/)?.[1];
  if (!link) throw new Error('a href 를 찾을 수 없음. HTML 형식 확인.');
  if (!image) throw new Error('img src 를 찾을 수 없음.');
  if (!title) throw new Error('img alt 를 찾을 수 없음.');
  const p = { title, image, link };
  if (width) p.imageWidth = Number(width);
  if (height) p.imageHeight = Number(height);
  return p;
}

async function readJson() {
  return JSON.parse(await readFile(JSON_PATH, 'utf8'));
}

async function writeJson(data) {
  await writeFile(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const PAGE = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>쿠팡 상품 추가 · 토마토 장바구니</title>
<style>
  :root { color-scheme: light dark;
    --bg:#f5efe3; --card:#fff; --ink:#3a2f24; --muted:#6e5b47;
    --accent:#c25a52; --border:#d6cab5; --ok:#2d6a3e; --err:#c24444; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#1f1a14; --card:#2a241b; --ink:#f0dfc1; --muted:#b39875; --border:#473a2b; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1rem; background:var(--bg); color:var(--ink);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
  main { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 1.5rem; }
  .card { background:var(--card); border-radius:12px; padding:1.4rem; margin-bottom:1rem; border:1px solid var(--border); }
  label { display:block; font-weight:600; margin-bottom:0.35rem; font-size:0.9rem; }
  input, textarea { width:100%; padding:0.6rem 0.75rem; border:1px solid var(--border);
    border-radius:8px; background:var(--bg); color:var(--ink); font-family:inherit; font-size:0.95rem; }
  textarea { min-height: 150px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size:0.8rem; }
  input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  button { padding:0.65rem 1.3rem; border:none; border-radius:8px; background:var(--accent);
    color:#fff; font-weight:600; cursor:pointer; font-size:0.95rem; }
  button:disabled { opacity:0.5; cursor:wait; }
  .result { margin-top:1rem; padding:0.75rem 1rem; border-radius:8px; font-size:0.9rem; }
  .result.ok { background: color-mix(in srgb, var(--ok) 15%, transparent); border:1px solid color-mix(in srgb, var(--ok) 40%, transparent); }
  .result.err { background: color-mix(in srgb, var(--err) 15%, transparent); border:1px solid color-mix(in srgb, var(--err) 40%, transparent); color:var(--err); }
  .muted { color:var(--muted); font-size:0.85rem; }
  .items { list-style:none; padding:0; margin:0.8rem 0 0; }
  .items li { padding:0.4rem 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; }
  .items li:last-child { border:0; }
  .next { font-size:0.8rem; color:var(--muted); margin-top:1rem; line-height:1.6; }
  code { background:var(--bg); padding:0.15rem 0.5rem; border-radius:4px; font-size:0.8rem; user-select:all; }
  .row { display:flex; gap:0.8rem; align-items:center; }
</style>
</head>
<body>
<main>
  <h1>🛒 쿠팡 상품 추가</h1>

  <div class="card">
    <form id="add-form">
      <label for="name">품목명 <span class="muted">(앱에서 입력한 항목명과 완전 일치)</span></label>
      <input id="name" name="name" placeholder="예: 샴푸" autocomplete="off" required>
      <div style="height:1rem"></div>
      <label for="html">쿠팡 파트너스 HTML 태그</label>
      <textarea id="html" name="html" placeholder='<a href="..."><img src="..." alt="..." width="120" height="240"></a>' required></textarea>
      <div style="height:1rem"></div>
      <div class="row">
        <button type="submit">추가 / 교체</button>
        <span id="result"></span>
      </div>
    </form>
  </div>

  <div class="card">
    <strong>현재 등록된 품목</strong>
    <ul id="items" class="items muted"><li>불러오는 중…</li></ul>
    <p class="next">
      <strong>반영 순서</strong><br>
      1. <code>git add . && git commit -m "🛒 상품 추가" && git push</code><br>
      2. 즉시 CDN 반영 필요 시 브라우저로 열기:<br>
      &nbsp;&nbsp;&nbsp;<code>https://purge.jsdelivr.net/gh/su100/toshop-list-recommendations@main/recommendations.json</code>
    </p>
  </div>
</main>

<script>
async function loadItems() {
  try {
    const r = await fetch('/items');
    const d = await r.json();
    const list = document.getElementById('items');
    const keys = Object.keys(d.items || {});
    if (!keys.length) { list.innerHTML = '<li>아직 없음</li>'; return; }
    list.innerHTML = keys
      .map(function(k) { return '<li><span>' + k + '</span><span>' + d.items[k].length + '개</span></li>'; })
      .join('');
  } catch (e) {
    document.getElementById('items').innerHTML = '<li>조회 실패: ' + e.message + '</li>';
  }
}
loadItems();

document.getElementById('add-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button');
  const result = document.getElementById('result');
  btn.disabled = true;
  result.className = '';
  result.textContent = '';
  try {
    const r = await fetch('/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name.value.trim(), html: form.html.value.trim() }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'unknown');
    result.className = 'result ok';
    result.innerHTML = '✓ <strong>' + d.name + '</strong> 에 ' + d.action + ' — ' + d.product.title;
    form.html.value = '';
    form.html.focus();
    await loadItems();
  } catch (err) {
    result.className = 'result err';
    result.textContent = '✗ ' + err.message;
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    if (req.method === 'GET' && req.url === '/items') {
      const data = await readJson();
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }
    if (req.method === 'POST' && req.url === '/add') {
      const body = await readBody(req);
      const name = (body.name || '').trim();
      const html = (body.html || '').trim();
      if (!name) throw new Error('품목명이 비어있음');
      if (!html) throw new Error('HTML 이 비어있음');
      const product = parseHtml(html);
      const data = await readJson();
      if (!data.items) data.items = {};
      if (!data.items[name]) data.items[name] = [];
      const list = data.items[name];
      const idx = list.findIndex((p) => p.link === product.link);
      const action = idx >= 0 ? '교체' : '추가';
      if (idx >= 0) list[idx] = product;
      else list.push(product);
      data.updatedAt = new Date().toISOString().slice(0, 10);
      await writeJson(data);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, name, action, product }));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`▶ http://localhost:${PORT}`);
  console.log(`  recommendations.json 편집기. 브라우저로 접속해.`);
});
