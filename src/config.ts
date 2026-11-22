// ─────────────────────────────────────────────────────────────
//  사이트 설정 — 운영 중 바꿀 값은 대부분 여기에 있습니다.
// ─────────────────────────────────────────────────────────────

export const SITE = {
  name: 'K-Popup Map',
  url: 'https://kpopupmap.com',
  timezone: 'Asia/Seoul',
};

export const LANGS = ['ko', 'ja', 'en'] as const;
export type Lang = (typeof LANGS)[number];

// 카테고리 (시트에는 key 또는 한글 이름 어느 쪽을 써도 됩니다)
export const CATEGORIES = [
  { key: 'beauty', color: '#e8457c', icon: '💄', ko: '뷰티', ja: 'ビューティー', en: 'Beauty', alias: ['뷰티', '코스메틱', 'cosmetic'] },
  { key: 'kpop', color: '#7c4dff', icon: '🎤', ko: 'K-pop', ja: 'K-POP', en: 'K-pop', alias: ['케이팝', '연예인', '연예인/셀럽', '셀럽', '아이돌', 'idol'] },
  { key: 'food', color: '#f08c00', icon: '🍰', ko: '음식·카페', ja: 'グルメ・カフェ', en: 'Food & Cafe', alias: ['음식', '카페', 'f&b', 'fnb', '디저트', '음식·카페'] },
  { key: 'fashion', color: '#1c7ed6', icon: '👟', ko: '패션', ja: 'ファッション', en: 'Fashion', alias: ['패션', '의류'] },
  { key: 'character', color: '#2fb344', icon: '🧸', ko: '캐릭터·IP', ja: 'キャラクター', en: 'Character & IP', alias: ['캐릭터', 'ip', '애니', '게임', '캐릭터·ip'] },
  { key: 'lifestyle', color: '#0ca678', icon: '🏠', ko: '라이프스타일', ja: 'ライフスタイル', en: 'Lifestyle', alias: ['라이프스타일', '리빙', '전시'] },
  { key: 'etc', color: '#868e96', icon: '✨', ko: '기타', ja: 'その他', en: 'Others', alias: ['기타', 'other', 'others'] },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]['key'];

// 지역 — 홍대·종로를 추가할 때 여기에 한 줄 넣고 시트 region 칸에 key를 쓰면 됩니다.
export const REGIONS = [
  { key: 'seongsu', ko: '성수', ja: '聖水', en: 'Seongsu', center: [127.0557, 37.5445] as [number, number], zoom: 15, active: true },
  { key: 'hongdae', ko: '홍대', ja: '弘大', en: 'Hongdae', center: [126.9236, 37.5563] as [number, number], zoom: 15, active: false },
  { key: 'jongno', ko: '종로', ja: '鍾路', en: 'Jongno', center: [126.9910, 37.5720] as [number, number], zoom: 15, active: false },
];

// 지도 타일 (무료). 트래픽이 커지면 자체 호스팅 스타일 URL로 바꾸면 됩니다.
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// 구글 애드센스 — 승인 후 'ca-pub-XXXXXXXX' 와 슬롯 ID를 넣으면 광고가 켜집니다. 비어 있으면 광고 없음.
export const ADSENSE = {
  client: '',
  slots: { list: '', detail: '', guide: '' },
};

// 의견 수렴 — 구글 폼 링크를 넣으세요. 비어 있으면 버튼이 숨겨집니다.
export const FORMS = {
  feedback: '', // 사이트 의견
  report: '', // 팝업 제보 / 정보 오류 신고
  business: '', // 브랜드 입점·광고 문의
};
export const CONTACT_EMAIL = '';

// SNS 채널 — 계정을 만들면 URL을 넣으세요. 비어 있으면 숨김.
export const SOCIAL = {
  instagram: '',
  x: '',
  threads: '',
  tiktok: '',
  youtube: '',
  line: '',
};

// 어필리에이트 — 언어별로 다른 상품을 노출합니다. url이 빈 항목은 숨김.
export const AFFILIATES: Record<Lang, { icon: string; title: string; desc: string; url: string }[]> = {
  ko: [
    { icon: '🛍️', title: '성수 팝업 굿즈 모아보기', desc: '쿠팡파트너스 링크', url: '' },
    { icon: '🏨', title: '성수·서울숲 근처 숙소', desc: '숙박 제휴 링크', url: '' },
  ],
  ja: [
    { icon: '📶', title: '韓国eSIM・Wi-Fi', desc: '空港で受け取り不要、到着後すぐ使える', url: '' },
    { icon: '🚄', title: '空港鉄道(AREX)チケット', desc: '仁川空港→ソウル駅 直通', url: '' },
    { icon: '🏨', title: '聖水・ソウルの森周辺ホテル', desc: 'ポップアップ巡りに便利', url: '' },
  ],
  en: [
    { icon: '📶', title: 'Korea eSIM / Wi-Fi', desc: 'Stay online from the moment you land', url: '' },
    { icon: '🚄', title: 'AREX Airport Express ticket', desc: 'Incheon Airport → Seoul Station', url: '' },
    { icon: '🏨', title: 'Hotels near Seongsu', desc: 'Walk to the popups', url: '' },
  ],
};

// Cloudflare Web Analytics (무료) 토큰 — 선택
export const CF_ANALYTICS_TOKEN = '';
