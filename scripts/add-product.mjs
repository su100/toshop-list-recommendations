#!/usr/bin/env node
// 쿠팡 파트너스 링크 태그를 받아서 recommendations.json 에 자동 반영.
//
// 사용법:
//   node scripts/add-product.mjs "<품목명>" < <(pbpaste)
// 또는 heredoc:
//   node scripts/add-product.mjs "샴푸" <<'EOF'
//   <a href="https://link.coupang.com/a/XXX" ...><img src="..." alt="..." width="120" height="240"></a>
//   EOF
//
// 품목 키가 이미 있으면 상품을 배열에 append. 같은 link 가 이미 있으면 중복 제거.
// JSON 파일만 수정하고 git 작업은 안 함 — 리뷰 후 수동 commit/push.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(__dirname, '..', 'recommendations.json');

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function match(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function parseHtml(html) {
  const link = match(html, /href=["']([^"']+)["']/);
  const image = match(html, /<img[^>]*\bsrc=["']([^"']+)["']/);
  const title = match(html, /<img[^>]*\balt=["']([^"']+)["']/);
  const width = match(html, /<img[^>]*\bwidth=["']?(\d+)["']?/);
  const height = match(html, /<img[^>]*\bheight=["']?(\d+)["']?/);

  if (!link) fail('a href 를 찾을 수 없음. HTML 형식 확인.');
  if (!image) fail('img src 를 찾을 수 없음.');
  if (!title) fail('img alt 를 찾을 수 없음.');

  const product = { title, image, link };
  if (width) product.imageWidth = Number(width);
  if (height) product.imageHeight = Number(height);
  return product;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  const itemName = process.argv[2];
  if (!itemName) {
    fail('품목명 인자 필요. 예: node scripts/add-product.mjs "샴푸" < input.html');
  }

  if (process.stdin.isTTY) {
    fail('HTML 을 stdin 으로 전달. 예: node scripts/add-product.mjs "샴푸" <<< "<a ...></a>"');
  }

  const html = await readStdin();
  if (!html) fail('stdin 이 비어있음.');

  const product = parseHtml(html);

  const raw = await readFile(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);

  if (!data.items) data.items = {};
  if (!data.items[itemName]) data.items[itemName] = [];

  const list = data.items[itemName];
  const existingIdx = list.findIndex((p) => p.link === product.link);
  const action = existingIdx >= 0 ? '교체' : '추가';
  if (existingIdx >= 0) list[existingIdx] = product;
  else list.push(product);

  const today = new Date().toISOString().slice(0, 10);
  data.updatedAt = today;

  await writeFile(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`✓ "${itemName}" 에 상품 ${action} 완료`);
  console.log(`  title : ${product.title}`);
  console.log(`  link  : ${product.link}`);
  console.log(`  image : ${product.image}`);
  if (product.imageWidth) console.log(`  size  : ${product.imageWidth}×${product.imageHeight}`);
  console.log(`  품목 상품 수: ${list.length}`);
  console.log('');
  console.log('다음 단계:');
  console.log('  git add . && git commit -m "🛒 ..." && git push');
  console.log(
    '  purge: https://purge.jsdelivr.net/gh/su100/toshop-list-recommendations@main/recommendations.json',
  );
}

main().catch((e) => fail(e.message));
