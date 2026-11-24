// 한국어 "이번 주말 성수 팝업" 모음 — 매주 목요일 0시(서울) 공개
import { WEEKEND_LAUNCH } from '../config';
import type { Popup } from './data';
import { today } from './listing';

export const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (s: string) => new Date(s + 'T00:00:00Z').getUTCDay(); // 0=일 … 6=토

/** 발행된 주말판 목록 (토요일 날짜, 오래된 순). 발행일 = 토요일 - 2일(목요일) */
export function editions(d = today()) {
  const out: string[] = [];
  for (let sat = addDays(WEEKEND_LAUNCH, 2); addDays(sat, -2) <= d; sat = addDays(sat, 7)) out.push(sat);
  return out;
}

/** 지금 /ko/weekend/ 에 보여줄 상태: 발행된 이번 주말판(목~일) 또는 다음 판 예고(월~수) */
export function currentWeekend(d = today()) {
  const eds = editions(d);
  const latest = eds.at(-1);
  if (latest && d <= addDays(latest, 1)) return { live: latest, past: eds.slice(0, -1) };
  const nextSat = addDays(d, (6 - dow(d) + 7) % 7 || 7);
  return { teaser: nextSat, publish: addDays(nextSat, -2), past: eds };
}

/** 주말판 내용 */
export function editionData(sat: string, all: Popup[]) {
  const sun = addDays(sat, 1), mon = addDays(sat, -5);
  const on = all.filter((p) => p.start <= sun && p.end >= sat);
  const last = on.filter((p) => p.end <= sun);
  const fresh = on.filter((p) => p.end > sun && p.start >= mon);
  const ongoing = on.filter((p) => !last.includes(p) && !fresh.includes(p));
  const next = all.filter((p) => p.start > sun && p.start <= addDays(sun, 7));
  return { sat, sun, thu: addDays(sat, -2), on, last, fresh, ongoing, next };
}

const md = (s: string) => `${+s.slice(5, 7)}월 ${+s.slice(8, 10)}일`;
export const weekendLabel = (sat: string) => {
  const sun = addDays(sat, 1);
  return sat.slice(5, 7) === sun.slice(5, 7) ? `${md(sat)}~${+sun.slice(8, 10)}일` : `${md(sat)}~${md(sun)}`;
};
export const mdShort = (s: string) => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
