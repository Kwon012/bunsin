// 한국식 큰 수 단위 포맷. 표시는 상위 두 단위까지.
export const UNITS: { name: string; exp: number }[] = [
  { name: '만', exp: 4 }, { name: '억', exp: 8 }, { name: '조', exp: 12 }, { name: '경', exp: 16 },
  { name: '해', exp: 20 }, { name: '자', exp: 24 }, { name: '양', exp: 28 }, { name: '구', exp: 32 },
  { name: '간', exp: 36 }, { name: '정', exp: 40 }, { name: '재', exp: 44 }, { name: '극', exp: 48 },
  { name: '항하사', exp: 52 }, { name: '아승기', exp: 56 }, { name: '나유타', exp: 60 },
  { name: '불가사의', exp: 64 }, { name: '무량대수', exp: 68 },
];

/** n이 쓰는 가장 큰 단위의 인덱스(-1 = 만 미만) */
export function unitIndex(n: number): number {
  if (!Number.isFinite(n) || n < 1e4) return -1;
  const e = Math.floor(Math.log10(n) + 1e-9);
  let idx = -1;
  for (let i = 0; i < UNITS.length; i++) if (e >= UNITS[i].exp) idx = i;
  return idx;
}

export function formatKR(n: number): string {
  if (Number.isNaN(n)) return '0';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n < 0) return '-' + formatKR(-n);
  if (n < 100) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
  if (n < 1e4) return String(Math.floor(n));
  const i = unitIndex(n);
  const top = UNITS[i];
  // 무량대수 이상은 지수 표기 보조
  if (i === UNITS.length - 1 && n >= 1e72) return `${(n / 10 ** top.exp).toExponential(2)}${top.name}`;
  const hi = Math.floor(n / 10 ** top.exp + 1e-9);
  const rest = n - hi * 10 ** top.exp;
  const lowerExp = i === 0 ? 0 : UNITS[i - 1].exp;
  const lo = Math.floor(rest / 10 ** lowerExp + 1e-9);
  if (i === 0) return lo > 0 ? `${hi}만 ${lo}` : `${hi}만`;
  return lo > 0 ? `${hi}${top.name} ${lo}${UNITS[i - 1].name}` : `${hi}${top.name}`;
}

export function formatSec(sec: number): string {
  if (!Number.isFinite(sec)) return '∞';
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}초`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분${sec % 60 ? ` ${sec % 60}초` : ''}`;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h < 24) return `${h}시간${m ? ` ${m}분` : ''}`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}
