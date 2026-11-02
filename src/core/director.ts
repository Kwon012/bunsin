// 사건 카드·마을 뉴스 감독(순수 로직). 동적 등장: 무반응 event_idle_sec 후, 최소 간격(첫 3분 20초 / 이후 event_min_gap_sec)
import { A } from './assumptions';
import { city, cityJobs, eco, incomeBase, incomeNow, isUnlocked } from './econ';
import { earn, happening } from './ledger';
import { formatKR } from './format';
import { EVENTS, NEWS, type EventCard } from '../data/content';
import type { GameState } from './state';

export const eventGap = (s: GameState): number => (s.sessionTime < A.X_eventFirstWindowSec ? A.X_eventGapFirstSec : eco('event_min_gap_sec'));

export function shouldSpawnEvent(s: GameState, bubbleActive: boolean): boolean {
  const d = s.director;
  return !bubbleActive && d.sinceHappening >= eco('event_idle_sec') && d.sinceEvent >= eventGap(s);
}

const nextIds = new Set(EVENTS.map((e) => e.next).filter(Boolean));

export function pickEvent(s: GameState, rnd = Math.random): EventCard | null {
  const d = s.director;
  // 진행 중 연작의 다음 사건 우선
  for (const nid of Object.values(d.series)) {
    const e = EVENTS.find((x) => x.id === nid);
    if (e) return e;
  }
  const fresh = (e: EventCard) => d.seen[e.id] === undefined || s.playTime - d.seen[e.id] >= A.X_eventRepeatGapSec;
  const pool = EVENTS.filter((e) => !nextIds.has(e.id) && fresh(e) && !(e.series && d.series[e.series]));
  if (!pool.length) return null;
  return pool[Math.floor(rnd() * pool.length)];
}

export function markEventShown(s: GameState, id: string) {
  s.director.seen[id] = s.playTime;
  s.director.sinceEvent = 0;
  s.metrics.eventsShown++;
  happening(s);
}
export function missEvent(s: GameState) { s.metrics.eventsMissed++; }

/** 연작 진행 표시 '2/3' */
export function seriesProgress(e: EventCard): string {
  if (!e.series) return '';
  const chain = EVENTS.filter((x) => x.series === e.series);
  const first = chain.find((x) => !nextIds.has(x.id));
  let i = 1; let cur = first;
  while (cur && cur.id !== e.id) { cur = EVENTS.find((x) => x.id === cur!.next); i++; }
  return `${i}/${chain.length}`;
}

/** 사건 보상(A10: 초당 수입 × 30~120초, 손해 없음) */
export function eventReward(s: GameState, e: EventCard, choice: 'a' | 'b'): number {
  const sec = Math.min(A.A10_eventRewardMaxSec, Math.max(A.A10_eventRewardMinSec, Number(choice === 'a' ? e.result_a : e.result_b) || A.A10_eventRewardMinSec));
  const base = Math.max(incomeBase(s), A.X_eventRewardFloorTapBase ? city(s).tapBase : 0);
  return base * sec;
}
export function resolveEvent(s: GameState, e: EventCard, choice: 'a' | 'b'): number {
  const v = eventReward(s, e, choice);
  earn(s, 'event', v);
  if (e.series) { if (e.next) s.director.series[e.series] = e.next; else delete s.director.series[e.series]; }
  happening(s);
  return v;
}

// ---------- 마을 뉴스 ----------
export const shouldNews = (s: GameState): boolean => s.director.sinceNews >= eco('news_interval_sec');

/** 방금 일어난 일과 연동된 줄을 우선, 없으면 뉴스 표 순서대로 */
export function nextNews(s: GameState, rnd = Math.random): string {
  const d = s.director;
  d.sinceNews = 0;
  let text = d.recent.shift();
  if (!text) {
    const n = NEWS[d.newsIdx % NEWS.length];
    d.newsIdx++;
    const jobs = cityJobs(s).filter((j) => isUnlocked(s, j));
    text = n.text
      .replace('{n}', String(Math.max(1, Math.floor(rnd() * Math.max(1, s.totalHired)) + 1)))
      .replace('{city}', city(s).name)
      .replace('{job}', jobs[jobs.length - 1]?.name ?? '편의점 알바')
      .replace('{income}', formatKR(incomeNow(s)));
  }
  d.news.push(text);
  while (d.news.length > 10) d.news.shift();
  return text;
}
/** 상황 연동 뉴스 재료 */
export function pushRecent(s: GameState, text: string) {
  s.director.recent.push(text);
  while (s.director.recent.length > 5) s.director.recent.shift();
}
