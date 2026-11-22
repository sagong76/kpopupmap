import { existsSync, readFileSync } from 'node:fs';
import { parseCSV } from '../../scripts/csv.mjs';
import { CATEGORIES, REGIONS, LANGS, type Lang, type CategoryKey } from '../config';

export type L3 = Record<Lang, string>;
export interface Popup {
  id: string;
  region: string;
  category: CategoryKey;
  sponsored: boolean;
  name: L3;
  start: string; // YYYY-MM-DD
  end: string;
  hours: string;
  address: L3;
  lat: number;
  lng: number;
  station: L3;
  instagram: string; // handle without @
  homepage: string;
  reservation: 'required' | 'optional' | 'walkin' | 'none' | 'unknown';
  foreigner: 'yes' | 'no' | 'onsite' | 'unknown';
  method: 'naver' | 'catchtable' | 'tabling' | 'instagram' | 'website' | 'onsite' | 'none';
  reservationUrl: string;
  desc: L3;
  image: string;
}

const lc = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '');

function toCategory(v: string): CategoryKey {
  const s = lc(v);
  for (const c of CATEGORIES) {
    if (s === c.key || s === lc(c.ko) || s === lc(c.en) || c.alias.some((a) => lc(a) === s)) return c.key;
  }
  return 'etc';
}

export function toDate(v: string): string {
  if (!v) return '';
  v = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    // ISO 시각 → 서울 날짜
    return new Date(v).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  }
  const m = v.match(/^(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '';
  const y = m[1].length === 2 ? '20' + m[1] : m[1];
  return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function pick<T extends string>(v: string, map: [RegExp, T][], dflt: T): T {
  const s = lc(v);
  if (!s) return dflt;
  for (const [re, val] of map) if (re.test(s)) return val;
  return dflt;
}

const handle = (v: string) =>
  (v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');

const url = (v: string) => {
  v = (v || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function l3(r: Record<string, string>, base: string): L3 {
  const ko = r[`${base}_ko`] || '';
  const en = r[`${base}_en`] || ko;
  const ja = r[`${base}_ja`] || en || ko;
  return { ko, ja, en };
}

function normalize(r: Record<string, string>): Popup | null {
  r = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v == null ? '' : String(v).trim()]));
  if (/^(hide|숨김|n|no|x)$/i.test(r.status || '')) return null;
  const name = l3(r, 'name');
  const start = toDate(r.start_date);
  const end = toDate(r.end_date) || start;
  const lat = parseFloat(r.lat), lng = parseFloat(r.lng);
  if (!name.ko || !start || !isFinite(lat) || !isFinite(lng)) {
    console.warn(`[data] 건너뜀 (이름·시작일·좌표 확인): ${name.ko || JSON.stringify(r).slice(0, 80)}`);
    return null;
  }
  const region = lc(r.region) || 'seongsu';
  const regionKey = REGIONS.find((x) => x.key === region || lc(x.ko) === region || lc(x.en) === region)?.key || region;
  return {
    id: slugify(r.id || '') || slugify(name.en) || 'p-' + Math.abs(hash(name.ko + start)).toString(36),
    region: regionKey,
    category: toCategory(r.category),
    sponsored: /^(y|yes|o|true|1|추천|스폰서)$/i.test(r.sponsored || ''),
    name,
    start,
    end: end < start ? start : end,
    hours: r.hours || '',
    address: l3(r, 'address'),
    lat,
    lng,
    station: l3(r, 'station'),
    instagram: handle(r.instagram),
    homepage: url(r.homepage),
    reservation: pick(r.reservation, [[/required|필수/, 'required'], [/optional|권장|선택/, 'optional'], [/walk|현장|웨이팅|대기/, 'walkin'], [/none|없음|자유|불필요/, 'none']], 'unknown'),
    foreigner: pick(r.foreigner, [[/onsite|현장/, 'onsite'], [/^(yes|y|o|가능|true)$/, 'yes'], [/^(no|n|x|불가|false)/, 'no']], 'unknown'),
    method: pick(r.reservation_method, [[/naver|네이버/, 'naver'], [/catch|캐치/, 'catchtable'], [/tabling|테이블링/, 'tabling'], [/insta|인스타/, 'instagram'], [/web|site|홈페이지|사이트/, 'website'], [/onsite|현장/, 'onsite']], 'none'),
    reservationUrl: url(r.reservation_url),
    desc: l3(r, 'desc'),
    image: url(r.image_url),
  };
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

let cache: Popup[] | null = null;
export function getPopups(): Popup[] {
  if (cache) return cache;
  const remote = new URL('../../data/popups.remote.json', import.meta.url);
  const local = new URL('../../data/popups.csv', import.meta.url);
  const rows: Record<string, string>[] = existsSync(remote)
    ? JSON.parse(readFileSync(remote, 'utf8'))
    : parseCSV(readFileSync(local, 'utf8'));
  const seen = new Set<string>();
  cache = rows
    .map(normalize)
    .filter((p): p is Popup => !!p)
    .map((p) => {
      let id = p.id, n = 2;
      while (seen.has(id)) id = `${p.id}-${n++}`;
      seen.add(id);
      return { ...p, id };
    })
    .sort((a, b) => Number(b.sponsored) - Number(a.sponsored) || a.start.localeCompare(b.start));
  return cache;
}

/** 브라우저로 보내는 가벼운 데이터 (언어 하나만) */
export function clientPopups(lang: Lang) {
  return getPopups().map((p) => ({
    id: p.id, r: p.region, c: p.category, s: p.sponsored ? 1 : 0,
    n: p.name[lang], a: p.start, b: p.end, y: +p.lat.toFixed(6), x: +p.lng.toFixed(6),
    rv: p.reservation, f: p.foreigner, ig: p.instagram, im: p.image,
  }));
}

export const langs = LANGS;
