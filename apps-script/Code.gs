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
  'desc_ko', 'desc_ja', 'desc_en', 'image_url'];

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
