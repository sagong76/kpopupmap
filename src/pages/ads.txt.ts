// 애드센스 승인 후 config.ts 의 ADSENSE.client 를 넣으면 자동으로 채워집니다.
import { ADSENSE } from '../config';
export function GET() {
  const pub = ADSENSE.client.replace(/^ca-/, '');
  const body = pub ? `google.com, ${pub}, DIRECT, f08c49aa6b0a5d5b\n` : '# ads.txt — AdSense publisher ID not set yet\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
