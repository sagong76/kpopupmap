// 빌드 직전에 구글 시트 데이터를 받아 data/popups.remote.json 으로 저장합니다.
//  - SHEET_API_URL : Apps Script 웹앱 URL (권장, 실시간 반영)
//  - SHEET_CSV_URL : 시트 "웹에 게시" CSV URL (대안, 최대 5분 지연)
// 둘 다 없으면 로컬 data/popups.csv 를 사용합니다 (개발용).
import { writeFileSync, rmSync } from 'node:fs';
import { parseCSV } from './csv.mjs';

const OUT = new URL('../data/popups.remote.json', import.meta.url);
const { SHEET_API_URL, SHEET_CSV_URL } = process.env;

async function main() {
  rmSync(OUT, { force: true });
  let rows;
  if (SHEET_API_URL) {
    const res = await fetch(SHEET_API_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error(`SHEET_API_URL ${res.status}`);
    const body = await res.json();
    rows = Array.isArray(body) ? body : body.popups;
  } else if (SHEET_CSV_URL) {
    const res = await fetch(SHEET_CSV_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error(`SHEET_CSV_URL ${res.status}`);
    rows = parseCSV(await res.text());
  } else {
    console.log('[fetch-sheet] 시트 URL 없음 → data/popups.csv 사용');
    return;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    // 빈 데이터로 배포되는 사고 방지: 빌드를 실패시켜 기존 사이트를 유지
    throw new Error('시트에서 받은 팝업이 0개입니다. 배포를 중단합니다.');
  }
  writeFileSync(OUT, JSON.stringify(rows));
  console.log(`[fetch-sheet] ${rows.length}개 행 저장`);
}

main().catch((e) => { console.error('[fetch-sheet] 실패:', e.message); process.exit(1); });
