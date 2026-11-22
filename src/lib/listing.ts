import type { Lang } from '../config';
import type { Popup } from './data';

/** 서울 기준 오늘 날짜 (빌드 시점) */
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export type Status = 'open' | 'upcoming' | 'ended';
export const statusOf = (p: Popup, d = today()): Status => (p.end < d ? 'ended' : p.start > d ? 'upcoming' : 'open');

/** 진행중 → 오픈예정 → 종료 순, 그 안에서는 스폰서 → 종료 임박/오픈 임박 순 */
export function sortForList(list: Popup[], d = today()) {
  const rank = { open: 0, upcoming: 1, ended: 2 } as const;
  return [...list].sort((a, b) => {
    const sa = statusOf(a, d), sb = statusOf(b, d);
    if (sa !== sb) return rank[sa] - rank[sb];
    if (a.sponsored !== b.sponsored) return Number(b.sponsored) - Number(a.sponsored);
    if (sa === 'open') return a.end.localeCompare(b.end);
    if (sa === 'upcoming') return a.start.localeCompare(b.start);
    return b.end.localeCompare(a.end);
  });
}

/** 팝업이 하루라도 걸쳐 있는 달 목록 (YYYY-MM) */
export function monthsOf(list: Popup[]) {
  const set = new Set<string>();
  for (const p of list) {
    let [y, m] = p.start.slice(0, 7).split('-').map(Number);
    const end = p.end.slice(0, 7);
    for (let i = 0; i < 24; i++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      set.add(ym);
      if (ym >= end) break;
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  return [...set].sort();
}

export const inMonth = (p: Popup, ym: string) => p.start.slice(0, 7) <= ym && p.end.slice(0, 7) >= ym;

export function monthLabel(ym: string, lang: Lang) {
  const [y, m] = ym.split('-').map(Number);
  if (lang === 'en') return new Date(y, m - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  return lang === 'ja' ? `${y}年${m}月` : `${y}년 ${m}월`;
}

export const shortDate = (s: string) => `${s.slice(2, 4)}. ${s.slice(5, 7)}. ${s.slice(8, 10)}`;

export const L = {
  ko: {
    allNav: '목록',
    allCat: '전체',
    about: '소개',
    allTitle: (m: string) => `성수 팝업스토어 일정 전체 목록 (${m} 업데이트)`,
    allDesc: '지금 운영 중이거나 곧 오픈하는 성수동 팝업스토어 전체 목록. 기간, 카테고리, 예약 방법을 한눈에 확인하세요.',
    allH1: '성수 팝업스토어 전체 목록',
    catTitle: (c: string, m: string) => `성수 ${c} 팝업스토어 모음 (${m}) - 운영중·오픈예정`,
    catDesc: (c: string, n: number) => `성수동 ${c} 팝업스토어 ${n}곳의 기간, 위치, 예약 방법을 정리했습니다.`,
    catH1: (c: string) => `성수 ${c} 팝업스토어`,
    monTitle: (m: string) => `${m} 성수 팝업스토어 일정 총정리`,
    monDesc: (m: string, n: number) => `${m}에 열리는 성수동 팝업스토어 ${n}곳. 날짜별 일정과 예약 방법, 위치를 확인하세요.`,
    monH1: (m: string) => `${m} 성수 팝업스토어 일정`,
    open: '운영중', upcoming: '오픈 예정', ended: '종료된 팝업',
    count: (n: number) => `${n}곳`,
    byCat: '카테고리별', byMonth: '월별 일정',
    viewMap: '지도에서 보기',
    empty: '현재 등록된 팝업이 없습니다.',
  },
  ja: {
    allNav: '一覧',
    allCat: 'すべて',
    about: 'サイトについて',
    allTitle: (m: string) => `聖水(ソンス)ポップアップストア開催一覧(${m}更新)`,
    allDesc: 'ソウル・聖水洞で開催中・開催予定のポップアップストア一覧。期間、カテゴリ、予約方法、外国人予約の可否をまとめてチェック。',
    allH1: '聖水 ポップアップストア一覧',
    catTitle: (c: string, m: string) => `聖水 ${c} ポップアップストアまとめ(${m})開催中・開催予定`,
    catDesc: (c: string, n: number) => `ソウル・聖水洞の${c}ポップアップストア${n}件の期間、場所、予約方法をまとめました。`,
    catH1: (c: string) => `聖水 ${c} ポップアップストア`,
    monTitle: (m: string) => `${m} 聖水ポップアップストア開催スケジュールまとめ`,
    monDesc: (m: string, n: number) => `${m}に開催されるソウル・聖水洞のポップアップストア${n}件。日程、予約方法、場所をチェック。`,
    monH1: (m: string) => `${m} 聖水ポップアップストア スケジュール`,
    open: '開催中', upcoming: '開催予定', ended: '終了したポップアップ',
    count: (n: number) => `${n}件`,
    byCat: 'カテゴリ別', byMonth: '月別スケジュール',
    viewMap: 'マップで見る',
    empty: '現在登録されているポップアップはありません。',
  },
  en: {
    allNav: 'List',
    allCat: 'All',
    about: 'About',
    allTitle: (m: string) => `Seongsu Pop-up Stores: Full Schedule (Updated ${m})`,
    allDesc: 'Every pop-up store open now or opening soon in Seongsu, Seoul — dates, categories, how to book and whether foreigners can reserve.',
    allH1: 'All Seongsu Pop-up Stores',
    catTitle: (c: string, m: string) => `Seongsu ${c} Pop-up Stores (${m}) - Open Now & Coming Soon`,
    catDesc: (c: string, n: number) => `${n} ${c} pop-up stores in Seongsu, Seoul with dates, locations and booking info.`,
    catH1: (c: string) => `Seongsu ${c} Pop-up Stores`,
    monTitle: (m: string) => `Seongsu Pop-up Stores in ${m}: Full Schedule`,
    monDesc: (m: string, n: number) => `${n} pop-up stores in Seongsu, Seoul during ${m}. Dates, booking tips and locations.`,
    monH1: (m: string) => `Seongsu Pop-ups in ${m}`,
    open: 'Open now', upcoming: 'Coming soon', ended: 'Past pop-ups',
    count: (n: number) => `${n}`,
    byCat: 'By category', byMonth: 'By month',
    viewMap: 'View on map',
    empty: 'No pop-ups listed right now.',
  },
} satisfies Record<Lang, Record<string, unknown>>;
