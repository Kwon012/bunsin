// 콘텐츠 CSV 로더(임시 열 구성: docs/content-csv.md)
import linesCsv from '../../data/content/lines.csv?raw';
import eventsCsv from '../../data/content/events.csv?raw';
import newsCsv from '../../data/content/news.csv?raw';
import uniquesCsv from '../../data/content/uniques.csv?raw';
import scenesCsv from '../../data/content/scenes.csv?raw';
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

export interface EventCard { id: string; type: 'tap' | 'choice'; text: string; choice_a: string; result_a: string; choice_b: string; result_b: string; series: string; next: string }
export const EVENTS: EventCard[] = parseCsvObjects(eventsCsv) as unknown as EventCard[];
export interface News { id: string; text: string }
export const NEWS: News[] = parseCsvObjects(newsCsv) as unknown as News[];
export interface UniqueDef { id: string; name: string; condition: string; hint1: string; hint2: string; passive: 'job' | 'tap' | 'payday'; value: string; prop: string }
export const UNIQUES: UniqueDef[] = parseCsvObjects(uniquesCsv) as unknown as UniqueDef[];
export interface HiddenScene { id: string; name: string; text: string }
export const SCENES: HiddenScene[] = parseCsvObjects(scenesCsv) as unknown as HiddenScene[];
