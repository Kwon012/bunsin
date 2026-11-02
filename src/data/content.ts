// 콘텐츠 CSV 로더(임시 열 구성: docs/content-csv.md)
import linesCsv from '../../data/content/lines.csv?raw';
import { parseCsvObjects } from './csv';

export interface Line { id: string; kind: string; key: string; text: string }
export const LINES: Line[] = parseCsvObjects(linesCsv) as unknown as Line[];
export const linesOf = (kind: string, key?: string): Line[] => LINES.filter((l) => l.kind === kind && (key === undefined || l.key === key));
export const lineText = (kind: string, key?: string): string | undefined => linesOf(kind, key)[0]?.text;
/** 최근에 나온 대사를 피해서 랜덤 */
export function pickLine(kind: string, recent: string[], key?: string): string {
  const pool = linesOf(kind, key);
  if (!pool.length) return '';
  const fresh = pool.filter((l) => !recent.includes(l.id));
  const l = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
  recent.push(l.id);
  while (recent.length > Math.max(1, Math.floor(pool.length / 2))) recent.shift();
  return l.text;
}
