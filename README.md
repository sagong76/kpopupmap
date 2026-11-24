# K-Popup Map (kpopupmap.com)

성수 팝업스토어 지도 웹사이트. 한국어·일본어·영어를 지원하고, 구글 시트로 운영합니다.

- **구조**: Astro 정적 사이트 → Cloudflare Pages (무료, 대역폭 무제한)
- **지도**: MapLibre + OpenFreeMap (무료, API 키 불필요)
- **데이터**: 구글 시트 → Apps Script 웹앱 → 빌드 시 반영
- **운영비**: 도메인 비용만 (연 1~2만 원)

---

## 처음 한 번만: 설치 (약 30분)

### 1. 구글 시트 만들기
1. 새 구글 시트를 만들고 탭 이름을 `popups` 로 바꿉니다.
2. `docs/sheet-template.csv` 를 **파일 → 가져오기 → 업로드 → "현재 시트 바꾸기"** 로 불러옵니다.
3. **확장 프로그램 → Apps Script** 를 열고 `apps-script/Code.gs` 내용을 붙여넣은 뒤 저장합니다.
   - 프로젝트 설정(⚙️)에서 "appsscript.json 표시"를 켜고 `apps-script/appsscript.json` 내용도 붙여넣습니다.
4. 시트를 새로고침하면 **🚀 팝업맵** 메뉴가 생깁니다. **⚙️ 처음 설정**을 실행합니다(권한 승인 필요).
5. Apps Script에서 **배포 → 새 배포 → 유형: 웹 앱**, 액세스 권한을 "모든 사용자"로 설정하고 배포합니다.
   - 나오는 `https://script.google.com/macros/s/.../exec` URL을 복사해 둡니다 (= `SHEET_API_URL`).
   - ⚠️ 이 URL로는 `popups` 탭의 내용이 공개됩니다. 공개하면 안 되는 메모는 다른 탭에 적으세요.

### 2. GitHub
이 폴더를 GitHub 저장소(예: `kpopupmap`)에 올립니다.

### 3. Cloudflare (Workers 방식)
1. Cloudflare 대시보드 → **Workers & Pages → Create → Import a repository** → `sagong76/kpopupmap` 선택
2. 설정 화면:
   - Project name: `kpopupmap` (wrangler.jsonc 의 name 과 같아야 함)
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (기본값 그대로)
   - Preview command: `npx wrangler versions upload` 또는 기본값 그대로
   → **Deploy**
3. 배포 후 프로젝트 → **Settings → Build → Variables and secrets** 에 추가:
   - `SHEET_API_URL` = 1-5에서 복사한 URL
   - `NODE_VERSION` = `22`
4. **Settings → Domains & Routes → Add → Custom domain** 에서 `kpopupmap.com` 연결
5. **Settings → Build → Deploy Hooks** 에서 훅 생성(브랜치 `main`) → URL 복사
6. 시트 메뉴 **⚙️ 배포 훅 URL 등록** 에 붙여넣기
7. (선택) **⚙️ 매일 새벽 자동 배포 켜기**

---

## 매일 하는 일: 팝업 업데이트 (1분)

1. 시트에 팝업 정보를 붙여넣습니다. **필수는 `name_ko`, `start_date`, `address_ko`** 뿐입니다.
2. **🚀 팝업맵 → 사이트에 배포하기** 를 누릅니다.
   - 빈 id, 좌표(주소 → 위경도), 일본어·영어 번역이 자동으로 채워집니다.
   - 오류가 있으면 빨간 칸으로 표시하고 배포를 멈춥니다.
3. 1~3분 뒤 사이트에 반영됩니다.

### 시트 칸 설명

| 칸 | 내용 | 예시 |
|---|---|---|
| id | 페이지 주소(비우면 자동 생성). **한 번 정한 뒤에는 바꾸지 마세요** (검색 노출 유지) | `sensel-market` |
| status | `show` / `hide`(숨김) | |
| sponsored | `y`면 추천(스폰서): 목록 맨 위, 큰 ★ 마커 | |
| region | `seongsu` / `hongdae` / `jongno` | |
| category | 뷰티 · K-pop · 음식·카페 · 패션 · 캐릭터·IP · 라이프스타일 · 기타 | |
| start_date / end_date | `2026-11-20` 또는 `26. 11. 20` | |
| hours | 운영시간 (자유 입력) | `11:00-20:00` |
| address_ko | 주소. 있으면 좌표가 자동으로 채워짐 | `서울 성동구 연무장길 5-9` |
| lat / lng | 좌표 (자동). 주소가 없을 때만 직접 입력 | |
| station_ko/ja/en | 가까운 역·출구 | `성수역 3번 출구 도보 3분` |
| instagram | 계정 또는 URL | `@brand` |
| homepage | 공식 홈페이지 | |
| reservation | `required` 필수 / `optional` 권장 / `walkin` 현장대기 / `none` 자유입장 / `unknown` | |
| foreigner | `yes` 외국인 예약 가능 / `no` 어려움 / `onsite` 현장대기 가능 / `unknown` | |
| reservation_method | `naver` `catchtable` `tabling` `instagram` `website` `onsite` | |
| reservation_url | 예약 링크 | |
| desc_ko/ja/en | 소개 문구 | |
| image_url | 대표 이미지 URL (**사용 허락을 받은 이미지만**) | |

> 드롭다운 값 대신 한글(`필수`, `가능`, `네이버` 등)을 써도 인식합니다.

---

## 언어별 운영

팝업 정보는 공통이고, 아래는 언어마다 다르게 운영합니다.

| | 한국어 | 일본어 | 영어 |
|---|---|---|---|
| 기획 페이지 | `/ko/weekend/` 이번 주말 (목요일 0시 공개) | `/ja/kpop/` K-POP 모음 (월별 자동) | `/en/this-month/` 이번 달 |
| 카테고리 순서·배지·SNS | `config.ts` → `LANG_PROFILE` | | |
| 가이드 | `src/guides/ko/` | `src/guides/ja/` | `src/guides/en/` |

- **가이드**: 같은 파일 이름 = 같은 글의 번역본(언어 전환 시 서로 연결). 파일 이름이 다르면 그 언어 전용 글.
- **언어별 추천**: 시트 `sponsored` 칸에 `y` = 전체 언어, `ja` / `ko,en` = 해당 언어에서만 추천.
- **주말판**: 목요일 0시 이후 첫 배포 때 공개되므로 **매일 새벽 자동 배포**가 켜져 있어야 합니다. 시트 메뉴 **📬 수요일 주말판 준비 메일 켜기**를 켜면 수요일 오전에 이번 주말 팝업 목록과 빠진 정보를 메일로 받습니다.

## 설정 변경 (`src/config.ts`)

| 항목 | 할 일 |
|---|---|
| `ADSENSE` | 애드센스 승인 후 `client`(ca-pub-…)와 슬롯 ID 입력 → 광고 자동 표시 |
| `FORMS` | 구글 폼 3종(의견·제보·비즈니스) 링크 입력 |
| `AFFILIATES` | 언어별 제휴 링크 입력 (비어 있으면 숨김) |
| `SOCIAL` | SNS 계정 URL |
| `REGIONS` | 홍대·종로 오픈 시 `active: true` |
| `SEARCH_VERIFY` | 구글 서치콘솔·네이버 서치어드바이저·Bing 소유확인 코드 |
| `CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics (무료) |

## 개발

```bash
npm install
npm run dev      # http://localhost:4321  (data/popups.csv 사용)
npm run build    # dist/ 생성
```

## 주요 주소
- `/ko/` `/ja/` `/en/` : 지도
- `/{lang}/popup/{id}/` : 상세페이지 (구글 이벤트 구조화 데이터 포함)
- `/{lang}/popups/` : 전체 목록 · `/{lang}/category/{key}/` : 카테고리별 · `/{lang}/month/{YYYY-MM}/` : 월별 (검색 유입용, 자동 생성)
- `/{lang}/about/` : 사이트 소개 (애드센스 심사용)
- `/ads.txt` : 애드센스 ID 입력 시 자동 생성
- `/{lang}/guide/` : 안내 페이지 (`src/guides/{lang}/*.md` 파일을 추가하면 자동으로 생성)
- `/data/popups.json` : 앱 연동용 전체 데이터
- `/sitemap-index.xml` : 사이트맵
