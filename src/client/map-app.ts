// 지도 화면 클라이언트 로직: 달력 · 카테고리 · 목록 · 지도 마커 · 모바일 바텀시트
type P = { id: string; r: string; c: string; s: number; n: string; a: string; b: string; y: number; x: number; rv: string; f: string; ig: string; im: string };
type Boot = {
  lang: 'ko' | 'ja' | 'en';
  style: string;
  popups: P[];
  cats: { k: string; n: string; col: string; ic: string }[];
  regions: { k: string; n: string; c: [number, number]; z: number; on: boolean }[];
  t: Record<string, any>;
  fx: 'hide' | 'full';
};

const B: Boot = JSON.parse(document.getElementById('boot')!.textContent!);
const { t, lang } = B;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const catOf = Object.fromEntries(B.cats.map((c) => [c.k, c]));
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (m) => `&#${m.charCodeAt(0)};`);

// ── 날짜 (서울 기준) ──
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const fmt = (s: string) => {
  const d = parse(s);
  return lang === 'en'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : `${d.getMonth() + 1}/${d.getDate()}`;
};
const period = (p: P) => (p.a === p.b ? fmt(p.a) : `${fmt(p.a)} – ${fmt(p.b)}`);
function status(p: P) {
  if (p.b < TODAY) return ['ended', t.ended];
  if (p.a > TODAY) return ['upcoming', t.upcoming];
  if (p.b === TODAY) return ['last', t.endsToday];
  return ['open', t.open];
}

// ── 상태 (URL 쿼리와 동기화 → 공유 가능) ──
const qs = new URLSearchParams(location.search);
const state = {
  region: B.regions.find((r) => r.k === qs.get('r') && r.on)?.k || B.regions[0].k,
  q: (qs.get('d') && /^\d{4}-\d{2}-\d{2}$/.test(qs.get('d')!) ? 'day' : qs.get('d') || 'today') as 'today' | 'weekend' | 'all' | 'day',
  day: qs.get('d') && /^\d{4}-\d{2}-\d{2}$/.test(qs.get('d')!) ? qs.get('d')! : TODAY,
  cats: new Set(qs.get('c') ? qs.get('c')!.split(',') : B.cats.map((c) => c.k)),
  month: '',
};
// 상세페이지에서 "지도에서 보기"로 왔을 때(#p=id) 그 팝업이 보이도록 필터 조정
const hashP = B.popups.find((p) => p.id === new URLSearchParams(location.hash.slice(1)).get('p'));
if (hashP) {
  state.region = hashP.r;
  state.cats.add(hashP.c);
  if (!(hashP.a <= TODAY && hashP.b >= TODAY)) { state.q = 'day'; state.day = hashP.a > TODAY ? hashP.a : hashP.b; }
}
state.month = (state.q === 'day' ? state.day : TODAY).slice(0, 7);

function range(): [string, string] | null {
  if (state.q === 'all') return null;
  if (state.q === 'today') return [TODAY, TODAY];
  if (state.q === 'day') return [state.day, state.day];
  // 이번 주말: 토~일 (일요일이면 오늘만)
  const dow = parse(TODAY).getDay();
  if (dow === 0) return [TODAY, TODAY];
  const sat = addDays(TODAY, 6 - dow);
  return [sat, addDays(sat, 1)];
}
const inRegion = (p: P) => p.r === state.region;
const inRange = (p: P, rg = range()) => !rg || (p.a <= rg[1] && p.b >= rg[0]);
const visible = () => B.popups.filter((p) => inRegion(p) && state.cats.has(p.c) && inRange(p));

function syncURL() {
  const u = new URL(location.href);
  const d = state.q === 'day' ? state.day : state.q === 'today' ? '' : state.q;
  d ? u.searchParams.set('d', d) : u.searchParams.delete('d');
  state.cats.size === B.cats.length ? u.searchParams.delete('c') : u.searchParams.set('c', [...state.cats].join(','));
  state.region === B.regions[0].k ? u.searchParams.delete('r') : u.searchParams.set('r', state.region);
  history.replaceState(null, '', u);
}

// ── 달력 ──
const calGrid = $('#calGrid');
const dowCells = [...calGrid.querySelectorAll('.dow')];
function renderCal() {
  const [y, m] = state.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  $('#calTitle').textContent = first.toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long' });
  const start = new Date(first); start.setDate(1 - first.getDay());
  const rg = range();
  const pool = B.popups.filter((p) => inRegion(p) && state.cats.has(p.c));
  const cells: HTMLElement[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const s = ymd(d);
    if (i >= 35 && d.getMonth() !== m - 1) break;
    const n = pool.filter((p) => p.a <= s && p.b >= s).length;
    const b = document.createElement('button');
    b.className = 'day';
    if (d.getMonth() !== m - 1) b.classList.add('out');
    if (s === TODAY) b.classList.add('today');
    if (rg && s >= rg[0] && s <= rg[1]) b.classList.add(rg[0] === rg[1] ? 'sel' : 'inrange');
    b.dataset.d = s;
    b.innerHTML = `${d.getDate()}${n ? `<span class="dot">${n}</span>` : ''}`;
    b.setAttribute('aria-label', `${s} · ${n}`);
    cells.push(b);
  }
  calGrid.replaceChildren(...dowCells, ...cells);
}
calGrid.addEventListener('click', (e) => {
  const d = (e.target as HTMLElement).closest<HTMLElement>('.day')?.dataset.d;
  if (!d) return;
  state.day = d;
  state.q = d === TODAY ? 'today' : 'day';
  if (d.slice(0, 7) !== state.month) state.month = d.slice(0, 7);
  update();
});
const shiftMonth = (n: number) => {
  const [y, m] = state.month.split('-').map(Number);
  state.month = ymd(new Date(y, m - 1 + n, 1)).slice(0, 7);
  renderCal();
};
$('#calPrev').onclick = () => shiftMonth(-1);
$('#calNext').onclick = () => shiftMonth(1);

// ── 빠른 필터 ──
$('#quick').addEventListener('click', (e) => {
  const q = (e.target as HTMLElement).closest<HTMLElement>('[data-q]')?.dataset.q as any;
  if (!q) return;
  state.q = q;
  if (q === 'today') { state.day = TODAY; state.month = TODAY.slice(0, 7); }
  if (q === 'weekend') state.month = range()![0].slice(0, 7);
  update();
});

// ── 카테고리 ──
const chips = [...document.querySelectorAll<HTMLElement>('[data-cat]')];
$('#cats').addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-cat]')?.dataset.cat;
  if (!k) return;
  state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
  update();
});
$('#catAll').onclick = () => { B.cats.forEach((c) => state.cats.add(c.k)); update(); };
$('#catNone').onclick = () => { state.cats.clear(); update(); };

// ── 지역 ──
$('#regions').addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-region]');
  if (!k || k.disabled) return;
  state.region = k.dataset.region!;
  const r = B.regions.find((x) => x.k === state.region)!;
  map?.flyTo({ center: r.c, zoom: r.z });
  update();
});

// ── 목록 ──
const thumb = (p: P) =>
  p.im
    ? `<img class="thumb" src="${esc(p.im)}" alt="" loading="lazy" decoding="async" width="62" height="62">`
    : `<span class="thumb" style="background:${catOf[p.c].col}1f">${catOf[p.c].ic}</span>`;
function badges(p: P) {
  const [cls, label] = status(p);
  let h = `<span class="badge ${cls}">${esc(label)}</span>`;
  if (p.s) h += `<span class="badge sp">★ ${esc(t.sp)}</span>`;
  if (p.rv === 'required') h += `<span class="badge resv">${esc(t.resv.required)}</span>`;
  if (B.fx === 'full' && (p.f === 'yes' || p.f === 'onsite')) h += `<span class="badge fx">🌏 ${esc(t.foreign[p.f])}</span>`;
  return h;
}
function renderList(vis: P[]) {
  const ul = $('#list');
  ul.innerHTML = vis.length
    ? vis.map((p) => `<li class="item" data-id="${p.id}">${thumb(p)}<div>
        <div class="item-badges">${badges(p)}</div>
        <div class="item-name">${esc(p.n)}</div>
        <div class="item-meta">${period(p)} · ${esc(catOf[p.c].n)}</div></div></li>`).join('')
    : `<li class="empty">${esc(t.noResults)}</li>`;
  const label = t.results.replace('{n}', String(vis.length));
  $('#count').textContent = label;
  $('#tabCount').textContent = `(${vis.length})`;
}
$('#list').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('.item')?.dataset.id;
  if (id) focusPopup(id, true);
});

function renderChips() {
  const rg = range();
  chips.forEach((c) => {
    const k = c.dataset.cat!;
    const on = state.cats.has(k);
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', String(on));
    const n = B.popups.filter((p) => p.c === k && inRegion(p) && inRange(p, rg)).length;
    c.querySelector('.n')!.textContent = n ? String(n) : '';
  });
  document.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === state.q));
  document.querySelectorAll<HTMLElement>('[data-region]').forEach((b) => b.classList.toggle('on', b.dataset.region === state.region));
}

// ── 지도 (지연 로딩) ──
let map: any = null;
let ml: any = null;
let popup: any = null;
const markers = new Map<string, { el: HTMLElement; m: any }>();
const isMobile = () => matchMedia('(max-width: 767px)').matches;

function cardHTML(p: P) {
  const img = p.im ? `<img src="${esc(p.im)}" alt="" loading="lazy">` : catOf[p.c].ic;
  const ig = p.ig ? `<a class="btn" href="https://instagram.com/${esc(p.ig)}" target="_blank" rel="noopener" aria-label="Instagram">📷</a>` : '';
  return `<div class="pcard"><div class="pcard-img" style="background:${catOf[p.c].col}1f">${img}</div>
    <div class="pcard-body"><div class="row">${badges(p)}</div>
    <h3>${esc(p.n)}</h3>
    <div class="meta">📅 ${period(p)} · ${esc(catOf[p.c].n)}</div>
    <div class="acts"><a class="btn pri" href="/${lang}/popup/${p.id}/">${esc(t.detail)} →</a>${ig}</div></div></div>`;
}

function focusPopup(id: string, fly = false) {
  const p = B.popups.find((x) => x.id === id);
  if (!p || !map) return;
  markers.forEach(({ el }, k) => el.classList.toggle('active', k === id));
  popup?.remove();
  popup = new ml.Popup({ offset: 30, maxWidth: '270px', focusAfterOpen: false })
    .setLngLat([p.x, p.y]).setHTML(cardHTML(p)).addTo(map);
  popup.on('close', () => markers.get(id)?.el.classList.remove('active'));
  if (isMobile()) setSheet(false);
  if (fly || isMobile()) map.easeTo({ center: [p.x, p.y], zoom: Math.max(map.getZoom(), 15.5), offset: [0, isMobile() ? 110 : 80], duration: 500 });
}

function renderMarkers(vis: P[]) {
  if (!map) return;
  const ids = new Set(vis.map((p) => p.id));
  markers.forEach(({ el }, id) => (el.style.display = ids.has(id) ? '' : 'none'));
  if (popup && ![...ids].some((id) => markers.get(id)?.el.classList.contains('active'))) popup.remove();
}

async function initMap() {
  const [{ default: maplibregl }] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ]);
  ml = maplibregl;
  const r = B.regions.find((x) => x.k === state.region)!;
  map = new maplibregl.Map({
    container: 'map', style: B.style, center: r.c, zoom: r.z, minZoom: 10, maxZoom: 19,
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
  map.on('style.load', () => {
    // 지도 라벨을 현재 언어로
    for (const l of map.getStyle().layers) {
      if (l.type === 'symbol' && l.layout?.['text-field']) {
        map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', `name:${lang}`], ['get', 'name:en'], ['get', 'name']]);
      }
    }
  });
  // 스폰서는 위에 그리도록 나중에 추가
  [...B.popups].sort((a, b) => a.s - b.s).forEach((p) => {
    const el = document.createElement('button');
    el.className = 'mkw' + (p.s ? ' sp' : '') + (p.b < TODAY ? ' dim' : '');
    el.style.setProperty('--c', catOf[p.c].col);
    el.setAttribute('aria-label', p.n);
    el.innerHTML = `<i class="mk"><span>${p.s ? '★' : catOf[p.c].ic}</span></i>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); focusPopup(p.id); });
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.x, p.y]).addTo(map);
    markers.set(p.id, { el, m });
  });
  renderMarkers(visible());
  if (hashP) map.once('load', () => focusPopup(hashP.id, true));
}

// ── 모바일 바텀시트 ──
const panel = $('#panel');
function setSheet(open: boolean) { panel.classList.toggle('open', open); }
document.querySelectorAll<HTMLElement>('[data-tab-btn]').forEach((b) =>
  b.addEventListener('click', () => {
    const tab = b.dataset.tabBtn!;
    const same = panel.dataset.tab === tab && panel.classList.contains('open');
    panel.dataset.tab = tab;
    document.querySelectorAll('[data-tab-btn]').forEach((x) => x.classList.toggle('on', x === b));
    setSheet(!same);
  }));
{
  const h = $('#handle');
  let y0 = 0, dy = 0, dragging = false, base = 0;
  h.addEventListener('pointerdown', (e) => {
    dragging = true; y0 = e.clientY; dy = 0;
    base = panel.classList.contains('open') ? 0 : panel.offsetHeight - parseInt(getComputedStyle(panel).getPropertyValue('--peek') || '160');
    panel.classList.add('dragging'); h.setPointerCapture(e.pointerId);
  });
  h.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = e.clientY - y0;
    panel.style.transform = `translateY(${Math.max(0, base + dy)}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false; panel.classList.remove('dragging'); panel.style.transform = '';
    if (Math.abs(dy) < 6) setSheet(!panel.classList.contains('open'));
    else setSheet(dy < 0);
  };
  h.addEventListener('pointerup', end);
  h.addEventListener('pointercancel', end);
}

// ── 갱신 ──
function update() {
  const vis = visible();
  renderChips();
  renderCal();
  renderList(vis);
  renderMarkers(vis);
  syncURL();
}
update();

// 지도는 첫 화면이 그려진 뒤 로드 (체감 속도↑)
('requestIdleCallback' in window ? (window as any).requestIdleCallback : setTimeout)(() => initMap(), { timeout: 300 });
