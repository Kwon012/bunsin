// 최소 CSV 파서: UTF-8 BOM, CRLF/LF, 따옴표 안 쉼표·줄바꿈, "" 이스케이프 처리.
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* CRLF: \n에서 처리 */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** 헤더 행을 키로 쓰는 객체 배열 */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const [head, ...rest] = parseCsv(text);
  const keys = head.map((h) => h.trim());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** 숫자 변환: "1.260E+17" 등 지수 표기 허용. 실패 시 예외 */
export function num(v: string, ctx = ''): number {
  const n = Number(v);
  if (v === '' || !Number.isFinite(n)) throw new Error(`숫자 아님: "${v}" ${ctx}`);
  return n;
}
