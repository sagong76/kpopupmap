// 앱·외부 연동용 공개 데이터 (/data/popups.json)
import { getPopups } from '../../lib/data';
import { CATEGORIES, REGIONS } from '../../config';

export function GET() {
  return new Response(
    JSON.stringify({
      updated: new Date().toISOString(),
      categories: CATEGORIES.map(({ alias, ...c }) => c),
      regions: REGIONS,
      popups: getPopups(),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
