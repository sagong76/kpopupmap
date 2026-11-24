// 빌드 직전: 시트의 image_url(구글 드라이브 공유 링크 또는 일반 이미지 주소)을 내려받아
// 가벼운 WebP(400/800px)와 공유용 JPG(1200x630)로 만들어 public/img/p/ 에 저장합니다.
// 사이트는 원본이 아닌 이 파일을 Cloudflare에서 서비스하므로 빠르고, 드라이브에 부담이 없습니다.
// 실패한 이미지는 건너뛰고(카테고리 아이콘 표시) 빌드는 계속됩니다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { parseCSV } from './csv.mjs';

const root = new URL('../', import.meta.url);
const OUT_DIR = new URL('public/img/p/', root);
const MAP_FILE = new URL('data/images.json', root);
const MAX_BYTES = 20 * 1024 * 1024;

/** 구글 드라이브 링크 → 파일 ID */
export function driveId(url) {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) ||
    url.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:.*&)?id=([\w-]{10,})/) ||
    url.match(/drive\.usercontent\.google\.com\/download\?(?:.*&)?id=([\w-]{10,})/) ||
    url.match(/lh3\.googleusercontent\.com\/d\/([\w-]{10,})/);
  return m ? m[1] : null;
}

/** 내려받을 후보 주소들 (앞에서부터 시도) */
export function candidates(url) {
  const id = driveId(url);
  if (!id) return [url];
  return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
    `https://lh3.googleusercontent.com/d/${id}=w2000`,
    `https://drive.usercontent.google.com/download?id=${id}&export=view`,
  ];
}

const key = (url) => createHash('sha1').update(driveId(url) || url).digest('hex').slice(0, 16);

async function download(url) {
  let lastErr = '';
  for (const u of candidates(url)) {
    try {
      const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Mozilla/5.0 kpopupmap-build' } });
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) { lastErr = '이미지가 아닌 페이지가 옴 (드라이브 공유 설정이 "링크가 있는 모든 사용자"인지 확인)'; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) { lastErr = '파일이 너무 큼 (20MB 초과)'; continue; }
      return buf;
    } catch (e) {
      lastErr = e.name === 'TimeoutError' ? '시간 초과' : e.message;
    }
  }
  throw new Error(lastErr);
}

async function processOne(url) {
  const k = key(url);
  const files = { s: `/img/p/${k}-400.webp`, m: `/img/p/${k}-800.webp`, og: `/img/p/${k}-og.jpg` };
  const done = Object.values(files).every((f) => existsSync(new URL('public' + f, root)));
  if (!done) {
    const buf = await download(url);
    const img = sharp(buf, { failOn: 'none' }).rotate(); // 휴대폰 사진 회전 정보 반영
    const meta = await img.metadata();
    if (!meta.width) throw new Error('이미지 파일을 읽을 수 없음');
    await Promise.all([
      img.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 74 }).toFile(new URL('public' + files.s, root).pathname),
      img.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 }).toFile(new URL('public' + files.m, root).pathname),
      img.clone().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(new URL('public' + files.og, root).pathname),
    ]);
  }
  return files;
}

function readRows() {
  const remote = new URL('data/popups.remote.json', root);
  return existsSync(remote)
    ? JSON.parse(readFileSync(remote, 'utf8'))
    : parseCSV(readFileSync(new URL('data/popups.csv', root), 'utf8'));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const urls = [...new Set(readRows().map((r) => String(r.image_url || '').trim()).filter((u) => /^https?:\/\//i.test(u)))];
  const map = {};
  let ok = 0, fail = 0;
  const queue = [...urls];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const u = queue.shift();
      try { map[u] = await processOne(u); ok++; }
      catch (e) { fail++; console.warn(`[images] 실패: ${u.slice(0, 90)} → ${e.message}`); }
    }
  }));
  writeFileSync(MAP_FILE, JSON.stringify(map));
  console.log(`[images] ${ok}개 준비, ${fail}개 실패 (실패한 팝업은 아이콘으로 표시)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
