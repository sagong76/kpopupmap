/**
 * K-Popup Map · 구글 시트 관리 스크립트
 * 설치: 시트 메뉴 [확장 프로그램] → [Apps Script] → 이 파일 내용을 붙여넣고 저장.
 * 시트를 새로고침하면 상단에 [🚀 팝업맵] 메뉴가 생깁니다.
 */

var SHEET = 'popups';
var HEADERS = ['id', 'status', 'sponsored', 'region', 'category', 'name_ko', 'name_ja', 'name_en',
  'start_date', 'end_date', 'hours', 'address_ko', 'address_en', 'lat', 'lng',
  'station_ko', 'station_ja', 'station_en', 'instagram', 'homepage',
  'reservation', 'foreigner', 'reservation_method', 'reservation_url',
  'desc_ko', 'desc_ja', 'desc_en', 'image_url', 'hashtags'];

var LISTS = {
  status: ['show', 'hide'],
  sponsored: ['', 'y'],
  region: ['seongsu', 'hongdae', 'jongno'],
  category: ['뷰티', 'K-pop', '음식·카페', '패션', '캐릭터·IP', '라이프스타일', '기타'],
  reservation: ['required', 'optional', 'walkin', 'none', 'unknown'],
  foreigner: ['yes', 'no', 'onsite', 'unknown'],
  reservation_method: ['naver', 'catchtable', 'tabling', 'instagram', 'website', 'onsite', 'none'],
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 팝업맵')
    .addItem('🚀 사이트에 배포하기 (검사+좌표+번역 포함)', 'deploy')
    .addSeparator()
    .addItem('🐦 X 게시글 만들기 (선택한 줄)', 'xPostSelected')
    .addItem('🐦 X 今週末まとめ 스레드 만들기', 'xPostWeekend')
    .addSeparator()
    .addItem('✅ 데이터 검사만', 'validateOnly')
    .addItem('📍 주소 → 좌표 채우기', 'fillCoordinates')
    .addItem('🌐 일본어·영어 빈칸 자동번역', 'fillTranslations')
    .addSeparator()
    .addItem('⚙️ 처음 설정: 시트 머리글·드롭다운 만들기', 'setupSheet')
    .addItem('⚙️ 배포 훅(Deploy Hook) URL 등록', 'setDeployHook')
    .addItem('⚙️ 매일 새벽 자동 배포 켜기', 'installDailyTrigger')
    .addItem('📬 수요일 주말판 준비 메일 켜기', 'installWeeklyReminder')
    .addItem('📬 주말판 준비 메일 지금 받아보기', 'weeklyReminder')
    .addToUi();
}

// ───────── 웹앱: 사이트 빌드가 이 주소에서 데이터를 읽어 갑니다 ─────────
function doGet() {
  var rows = readRows_().map(function (r) { return r.obj; });
  return ContentService.createTextOutput(JSON.stringify({ popups: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────── 배포 ─────────
function deploy() {
  var ui = SpreadsheetApp.getUi();
  fillIds_();
  fillCoordinates(true);
  fillTranslations(true);
  var errors = validate_();
  if (errors.length) {
    ui.alert('❌ 배포 중단 — 아래 문제를 고쳐 주세요 (빨간 칸 표시)\n\n' + errors.slice(0, 15).join('\n'));
    return;
  }
  var hook = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK');
  if (!hook) { ui.alert('배포 훅 URL이 없습니다. [⚙️ 배포 훅 URL 등록]을 먼저 해 주세요.'); return; }
  var res = UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
  if (res.getResponseCode() < 300) {
    ui.alert('✅ 배포 시작! 1~3분 후 사이트에 반영됩니다.\n(팝업 ' + readRows_().length + '개)');
  } else {
    ui.alert('⚠️ 배포 요청 실패: ' + res.getResponseCode() + '\n' + res.getContentText().slice(0, 300));
  }
}

function scheduledDeploy() {
  var hook = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK');
  if (hook && validate_().length === 0) UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
}

function setDeployHook() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Cloudflare → kpopupmap → Settings → Build → Deploy Hooks 에서 만든 URL을 붙여넣으세요.');
  if (r.getSelectedButton() === ui.Button.OK && /^https:\/\//.test(r.getResponseText().trim())) {
    PropertiesService.getScriptProperties().setProperty('DEPLOY_HOOK', r.getResponseText().trim());
    ui.alert('저장했습니다.');
  }
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scheduledDeploy') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scheduledDeploy').timeBased().everyDays(1).atHour(0).nearMinute(10).inTimezone('Asia/Seoul').create();
  SpreadsheetApp.getUi().alert('매일 00시 무렵 자동 배포가 설정되었습니다.');
}

// ───────── 데이터 도우미 ─────────
function sheet_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  if (!sh) throw new Error('"' + SHEET + '" 탭이 없습니다. [⚙️ 처음 설정]을 실행하세요.');
  return sh;
}

function headerIndex_(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = {};
  head.forEach(function (h, i) { idx[String(h).trim()] = i; });
  return idx;
}

function fmt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v).trim();
}

function readRows_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var idx = headerIndex_(sh);
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var out = [];
  values.forEach(function (row, i) {
    if (row.join('').trim() === '') return;
    var obj = {};
    Object.keys(idx).forEach(function (k) { if (k) obj[k] = fmt_(row[idx[k]]); });
    out.push({ row: i + 2, obj: obj });
  });
  return out;
}

function setCell_(sh, row, idx, key, value) {
  if (idx[key] === undefined) return;
  sh.getRange(row, idx[key] + 1).setValue(value);
}

function fillIds_() {
  var sh = sheet_(), idx = headerIndex_(sh), used = {};
  var rows = readRows_();
  rows.forEach(function (r) { if (r.obj.id) used[r.obj.id] = true; });
  rows.forEach(function (r) {
    if (r.obj.id) return;
    var base = (r.obj.name_en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'popup';
    var id = base, n = 2;
    while (used[id]) id = base + '-' + n++;
    used[id] = true;
    setCell_(sh, r.row, idx, 'id', id);
  });
}

function fillCoordinates(silent) {
  var sh = sheet_(), idx = headerIndex_(sh), n = 0;
  var geocoder = Maps.newGeocoder().setLanguage('ko').setRegion('kr');
  readRows_().forEach(function (r) {
    var o = r.obj;
    if ((o.lat && o.lng) || !o.address_ko) return;
    var res = geocoder.geocode(o.address_ko);
    if (res.status === 'OK' && res.results.length) {
      var loc = res.results[0].geometry.location;
      setCell_(sh, r.row, idx, 'lat', loc.lat);
      setCell_(sh, r.row, idx, 'lng', loc.lng);
      n++;
    }
    Utilities.sleep(150);
  });
  if (silent !== true) SpreadsheetApp.getUi().alert('좌표 ' + n + '건 채움');
}

function fillTranslations(silent) {
  var sh = sheet_(), idx = headerIndex_(sh), n = 0;
  var pairs = [['name', true], ['desc', true], ['station', true], ['address', false]];
  readRows_().forEach(function (r) {
    var o = r.obj;
    pairs.forEach(function (p) {
      var ko = o[p[0] + '_ko'];
      if (!ko) return;
      if (!o[p[0] + '_en']) { setCell_(sh, r.row, idx, p[0] + '_en', LanguageApp.translate(ko, 'ko', 'en')); n++; }
      if (p[1] && !o[p[0] + '_ja']) { setCell_(sh, r.row, idx, p[0] + '_ja', LanguageApp.translate(ko, 'ko', 'ja')); n++; }
    });
  });
  if (silent !== true) SpreadsheetApp.getUi().alert('번역 ' + n + '칸 채움 (확인 후 필요하면 고쳐 주세요)');
}

function validateOnly() {
  var e = validate_();
  SpreadsheetApp.getUi().alert(e.length ? '문제 ' + e.length + '건\n\n' + e.slice(0, 20).join('\n') : '✅ 문제 없음');
}

function validate_() {
  var sh = sheet_(), idx = headerIndex_(sh), errors = [];
  var rows = readRows_();
  if (rows.length) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).setBackground(null);
  var mark = function (r, key, msg) {
    errors.push(r.row + '행 ' + (r.obj.name_ko || '') + ': ' + msg);
    if (idx[key] !== undefined) sh.getRange(r.row, idx[key] + 1).setBackground('#ffd6d6');
  };
  var isDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2,4}\D+\d{1,2}\D+\d{1,2}/.test(s); };
  rows.forEach(function (r) {
    var o = r.obj;
    if (o.status === 'hide') return;
    if (!o.name_ko) mark(r, 'name_ko', '이름(name_ko) 없음');
    if (!isDate(o.start_date)) mark(r, 'start_date', '시작일 형식 오류 (예: 2026-11-20)');
    if (o.end_date && !isDate(o.end_date)) mark(r, 'end_date', '종료일 형식 오류');
    if (o.end_date && o.start_date && o.end_date < o.start_date) mark(r, 'end_date', '종료일이 시작일보다 빠름');
    if (!o.lat || !o.lng) mark(r, 'address_ko', '좌표 없음 — 주소(address_ko)를 넣거나 lat/lng 직접 입력');
    if (o.reservation_url && !/^https?:\/\//.test(o.reservation_url)) mark(r, 'reservation_url', '예약 링크는 https:// 로 시작');
    if (o.image_url && /cdninstagram|fbcdn|scontent/.test(o.image_url)) mark(r, 'image_url', '인스타그램 이미지 주소는 며칠 뒤 깨집니다. 구글 드라이브에 올린 뒤 그 링크를 넣어 주세요');
    if (o.image_url && /drive\.google\.com\/drive\/folders/.test(o.image_url)) mark(r, 'image_url', '폴더 링크가 아니라 사진 파일 하나의 링크를 넣어 주세요');
    if (o.image_url && !/^https?:\/\//.test(o.image_url)) mark(r, 'image_url', '이미지 링크는 https:// 로 시작');
  });
  return errors;
}

// ───────── 처음 설정 ─────────
function setupSheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#ffe5ec');
  var idx = headerIndex_(sh);
  Object.keys(LISTS).forEach(function (k) {
    if (idx[k] === undefined) return;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(LISTS[k], true).setAllowInvalid(true).build();
    sh.getRange(2, idx[k] + 1, 1000, 1).setDataValidation(rule);
  });
  ['start_date', 'end_date'].forEach(function (k) {
    if (idx[k] !== undefined) sh.getRange(2, idx[k] + 1, 1000, 1).setNumberFormat('yyyy-mm-dd');
  });
  SpreadsheetApp.getUi().alert('설정 완료! 이제 팝업 정보를 붙여넣으세요.');
}

// ───────── 주말판(목요일 발행) 준비 알림 ─────────
// 매주 수요일 오전, 이번 주말에 열리는 팝업 수와 빠진 정보를 메일로 보냅니다.
function installWeeklyReminder() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'weeklyReminder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyReminder').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(10).inTimezone('Asia/Seoul').create();
  SpreadsheetApp.getUi().alert('매주 수요일 오전 10시쯤 주말판 준비 메일이 옵니다.');
}

function weeklyReminder() {
  var tz = 'Asia/Seoul';
  var now = new Date();
  var dow = Number(Utilities.formatDate(now, tz, 'u')); // 1=월 … 7=일
  var sat = new Date(now.getTime() + ((6 - dow + 7) % 7) * 864e5);
  var satS = Utilities.formatDate(sat, tz, 'yyyy-MM-dd');
  var sunS = Utilities.formatDate(new Date(sat.getTime() + 864e5), tz, 'yyyy-MM-dd');
  var thuS = Utilities.formatDate(new Date(sat.getTime() - 2 * 864e5), tz, 'M월 d일');
  var norm = function (v) {
    var m = String(v || '').match(/(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return '';
    return (m[1].length === 2 ? '20' + m[1] : m[1]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  };
  var on = [], lines = [];
  readRows_().forEach(function (r) {
    var o = r.obj;
    if (o.status === 'hide') return;
    var a = norm(o.start_date), b = norm(o.end_date) || a;
    if (!a || a > sunS || b < satS) return;
    var miss = [];
    if (!o.hours) miss.push('운영시간');
    if (!o.instagram && !o.homepage) miss.push('인스타/홈페이지');
    if (!o.reservation || o.reservation === 'unknown') miss.push('예약방식');
    if (!o.foreigner || o.foreigner === 'unknown') miss.push('외국인예약');
    if (!o.station_ko) miss.push('가까운역');
    on.push(o);
    lines.push('· ' + o.name_ko + ' (' + a.slice(5) + '~' + b.slice(5) + ')' + (miss.length ? '  ← 빠짐: ' + miss.join(', ') : '  ✓'));
  });
  var hasDaily = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'scheduledDeploy'; });
  var body = '이번 주말(' + satS.slice(5) + '~' + sunS.slice(5) + ') 주말판은 ' + thuS + '(목) 0시에 자동 공개됩니다.\n\n'
    + '현재 등록된 이번 주말 팝업: ' + on.length + '곳\n\n' + (lines.join('\n') || '(아직 없음)') + '\n\n'
    + '오늘 안에 새 팝업을 추가하고 빠진 정보를 채운 뒤 [🚀 사이트에 배포하기]를 눌러 주세요.\n'
    + (hasDaily ? '' : '\n⚠️ "매일 새벽 자동 배포"가 꺼져 있습니다. 꺼져 있으면 목요일에 주말판이 공개되지 않습니다. 시트 메뉴에서 켜 주세요.\n')
    + '\n시트 열기: ' + SpreadsheetApp.getActive().getUrl();
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[K-Popup Map] 주말판 준비: 이번 주말 팝업 ' + on.length + '곳', body);
}

// ───────── X(트위터) 일본어 게시글 자동 생성 ─────────
var SITE_URL = 'https://kpopupmap.com';
var JA_DOW = ['日', '月', '火', '水', '木', '金', '土'];
var X_CAT = {
  beauty: { ic: '💄', tag: '#韓国コスメ' }, kpop: { ic: '🎤', tag: '#KPOP' },
  food: { ic: '🍰', tag: '#韓国カフェ' }, fashion: { ic: '👟', tag: '#韓国ファッション' },
  character: { ic: '🧸', tag: '#キャラクター' }, lifestyle: { ic: '🏠', tag: '#韓国雑貨' }, etc: { ic: '✨', tag: '' },
};
var X_RESV = { required: '要予約', optional: '予約推奨', walkin: '不要(現地待ち)', none: '不要', unknown: '要確認' };
var X_FX = { yes: 'OK', no: '予約は難しい', onsite: '現地待ちOK', unknown: '要確認' };

function xCat_(v) {
  var s = String(v || '').toLowerCase().replace(/\s+/g, '');
  var map = {
    beauty: ['beauty', '뷰티', '코스메틱'], kpop: ['kpop', 'k-pop', '케이팝', '연예인', '연예인/셀럽', '셀럽', '아이돌'],
    food: ['food', '음식', '카페', 'f&b', 'fnb', '음식·카페', '디저트'], fashion: ['fashion', '패션', '의류'],
    character: ['character', '캐릭터', '캐릭터·ip', 'ip', '애니', '게임'], lifestyle: ['lifestyle', '라이프스타일', '리빙', '전시'],
  };
  for (var k in map) if (map[k].indexOf(s) >= 0) return k;
  return 'etc';
}
function xEnum_(v, pairs, dflt) {
  var s = String(v || '').toLowerCase().replace(/\s+/g, '');
  if (!s) return dflt;
  for (var i = 0; i < pairs.length; i++) if (pairs[i][0].test(s)) return pairs[i][1];
  return dflt;
}
function xResv_(v) { return xEnum_(v, [[/required|필수/, 'required'], [/optional|권장|선택/, 'optional'], [/walk|현장|웨이팅|대기/, 'walkin'], [/none|없음|자유|불필요/, 'none']], 'unknown'); }
function xFx_(v) { return xEnum_(v, [[/onsite|현장/, 'onsite'], [/^(yes|y|o|가능|true)$/, 'yes'], [/^(no|n|x|불가|false)/, 'no']], 'unknown'); }
function xDate_(v) {
  var m = String(v || '').match(/(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '';
  return (m[1].length === 2 ? '20' + m[1] : m[1]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
function xMd_(ymd) {
  var d = new Date(ymd + 'T00:00:00Z');
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + JA_DOW[d.getUTCDay()] + ')';
}
function xAddDays_(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function xToday_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }

/** X 글자 수 (일본어·이모지 2, URL 23, 영문 1) */
function xWeight_(text) {
  var n = 0;
  text = text.replace(/https?:\/\/\S+/g, function () { n += 23; return ''; });
  for (var i = 0; i < text.length; i++) {
    var c = text.codePointAt(i);
    if (c > 0xffff) i++;
    n += (c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247)) ? 1 : 2;
  }
  return n;
}

/** 팝업 한 줄 → X 게시글 */
function xBuildPost_(o, today) {
  var a = xDate_(o.start_date), b = xDate_(o.end_date) || a;
  var cat = X_CAT[xCat_(o.category)];
  var name = o.name_ja || o.name_en || o.name_ko;
  var head = a > today ? (a <= xAddDays_(today, 7) ? '【まもなくオープン】' : '【近日オープン】')
    : b === today ? '【本日最終日】'
    : b <= xAddDays_(today, 3) ? '【まもなく終了】'
    : a >= xAddDays_(today, -3) ? '【NEW】聖水ポップアップ' : '【聖水ポップアップ】';
  var date = a === b ? xMd_(a) + 'のみ' : xMd_(a) + '〜' + xMd_(b);
  var tags = ['#渡韓', '#聖水'];
  if (cat.tag) tags.push(cat.tag);
  String(o.hashtags || '').split(/[\s,、]+/).forEach(function (t) {
    if (!t) return; t = t.charAt(0) === '#' ? t : '#' + t;
    if (tags.indexOf(t) < 0) tags.push(t);
  });
  var lines = [head, cat.ic + ' ' + name, '📅 ' + date];
  var station = o.station_ja ? '📍 ' + o.station_ja : '📍 聖水エリア';
  var resv = '🎟 予約：' + X_RESV[xResv_(o.reservation)] + '｜外国人：' + X_FX[xFx_(o.foreigner)];
  var link = '詳細・地図はこちら👇\n' + SITE_URL + '/ja/popup/' + o.id + '/';
  var build = function (st, tg) { return lines.concat(st ? [st] : [], [resv, '', link, '', tg.join(' ')]).join('\n'); };
  // 280 넘으면: 해시태그 줄이기 → 역 줄 빼기 → 이름 자르기
  var text = build(station, tags);
  while (xWeight_(text) > 280 && tags.length > 2) { tags.pop(); text = build(station, tags); }
  if (xWeight_(text) > 280) text = build('', tags);
  while (xWeight_(text) > 280 && name.length > 10) { name = name.slice(0, -2); lines[1] = cat.ic + ' ' + name + '…'; text = build('', tags); }
  return text;
}

function xRowsForSelection_() {
  var sh = sheet_();
  if (SpreadsheetApp.getActiveSheet().getName() !== SHEET) throw new Error('"' + SHEET + '" 탭에서 팝업 줄을 선택한 뒤 실행하세요.');
  var want = {};
  SpreadsheetApp.getActiveRangeList().getRanges().forEach(function (rg) {
    for (var r = rg.getRow(); r < rg.getRow() + rg.getNumRows(); r++) want[r] = true;
  });
  return readRows_().filter(function (r) { return want[r.row]; });
}

function xPostSelected() {
  fillIds_();
  var rows;
  try { rows = xRowsForSelection_(); } catch (e) { SpreadsheetApp.getUi().alert(e.message); return; }
  if (!rows.length) { SpreadsheetApp.getUi().alert('팝업이 있는 줄을 선택해 주세요. (여러 줄 선택 가능)'); return; }
  var today = xToday_();
  var posts = rows.map(function (r) { return { title: r.obj.name_ko, text: xBuildPost_(r.obj, today) }; });
  xShowDialog_('X 게시글 (' + posts.length + '개)', posts,
    '복사해서 X에 붙여넣거나, [X에서 열기]를 누르세요. 일본 시간 20~23시 게시를 추천합니다.<br>⚠️ 사이트에 배포된 팝업인지 확인하세요 (링크가 열려야 함).');
}

function xPostWeekend() {
  var today = xToday_();
  var dow = new Date(today + 'T00:00:00Z').getUTCDay();
  var sat = dow === 0 ? xAddDays_(today, -1) : xAddDays_(today, (6 - dow + 7) % 7);
  var sun = xAddDays_(sat, 1), mon = xAddDays_(sat, -5);
  var on = readRows_().map(function (r) { return r.obj; }).filter(function (o) {
    var a = xDate_(o.start_date), b = xDate_(o.end_date) || a;
    return o.status !== 'hide' && a && a <= sun && b >= sat && o.id;
  });
  if (!on.length) { SpreadsheetApp.getUi().alert('이번 주말(' + sat + '~' + sun + ')에 열리는 팝업이 없습니다.'); return; }
  var last = on.filter(function (o) { return (xDate_(o.end_date) || xDate_(o.start_date)) <= sun; });
  var fresh = on.filter(function (o) { return xDate_(o.start_date) >= mon && last.indexOf(o) < 0; });
  var head = ['【今週末の聖水ポップアップ】' + xMd_(sat) + '・' + xMd_(sun).replace(/^\d+\//, ''),
    '開催中のポップアップは全' + on.length + '件!', ''];
  if (last.length) head.push('🔥 今週末で終了 … ' + last.length + '件');
  if (fresh.length) head.push('✨ 今週オープン … ' + fresh.length + '件');
  var kp = on.filter(function (o) { return xCat_(o.category) === 'kpop'; }).length;
  if (kp) head.push('🎤 K-POP … ' + kp + '件');
  head.push('', '外国人の予約可否つき、地図で見る👇', SITE_URL + '/ja/kpop/', '', '#渡韓 #聖水 #ソンス #韓国ポップアップ');
  var posts = [{ title: '① 첫 게시글 (스레드 시작)', text: head.join('\n') }];
  // 스레드 답글: K-POP → 이번 주말 종료 → 신규 순, 최대 6개
  var order = on.slice().sort(function (x, y) {
    var sc = function (o) { return (xCat_(o.category) === 'kpop' ? 0 : 3) + (last.indexOf(o) >= 0 ? 0 : fresh.indexOf(o) >= 0 ? 1 : 2); };
    return sc(x) - sc(y);
  }).slice(0, 6);
  order.forEach(function (o, i) {
    posts.push({ title: (i + 2) + ' 답글: ' + o.name_ko, text: xBuildPost_(o, today) });
  });
  xShowDialog_('X 今週末まとめ 스레드 (' + posts.length + '개)', posts,
    '① 첫 게시글을 올린 뒤, 그 게시글에 ②부터 차례로 <b>답글</b>로 이어 붙이면 스레드가 됩니다.');
}

function xShowDialog_(title, posts, help) {
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var html = '<style>body{font-family:sans-serif;font-size:13px;margin:0;padding:4px}'
    + '.p{border:1px solid #ddd;border-radius:8px;padding:8px;margin-bottom:10px}'
    + 'textarea{width:100%;height:190px;box-sizing:border-box;font-size:13px;line-height:1.5}'
    + 'button,a.b{background:#ff4f7b;color:#fff;border:0;border-radius:6px;padding:6px 12px;margin-right:6px;cursor:pointer;text-decoration:none;font-size:13px;display:inline-block}'
    + 'a.b{background:#111}.n{color:#888;float:right}.over{color:#d00;font-weight:bold}</style>'
    + '<p style="color:#555">' + help + '</p>';
  posts.forEach(function (p, i) {
    var w = xWeight_(p.text);
    html += '<div class="p"><b>' + esc(p.title) + '</b><span class="n' + (w > 280 ? ' over' : '') + '">' + w + ' / 280</span>'
      + '<textarea id="t' + i + '">' + esc(p.text) + '</textarea>'
      + '<button onclick="cp(' + i + ',this)">📋 복사</button>'
      + '<a class="b" target="_blank" href="https://x.com/intent/post?text=' + encodeURIComponent(p.text) + '">X에서 열기</a></div>';
  });
  html += '<script>function cp(i,b){var t=document.getElementById("t"+i);t.select();'
    + 'try{navigator.clipboard.writeText(t.value).then(function(){b.textContent="✓ 복사됨"},function(){document.execCommand("copy");b.textContent="✓ 복사됨"})}'
    + 'catch(e){document.execCommand("copy");b.textContent="✓ 복사됨"}}</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(640), title);
}
