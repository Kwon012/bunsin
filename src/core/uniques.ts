// 개성 분신: 비확률, 행동 기반 숨은 조건. 건물당 1칸 배치, 자동 추천 배치, 작은 패시브, 이름 변경.
import { UNIQUES, type UniqueDef } from '../data/content';
import { cityJobs, isUnlocked, jobIncomeBase, setUniquePassiveLookup, totalClones } from './econ';
import { clock } from './clock';
import { happening } from './ledger';
import type { GameEvent, GameState } from './state';

setUniquePassiveLookup((id) => {
  const d = UNIQUES.find((u) => u.id === id);
  return d ? { kind: d.passive, value: Number(d.value) || 0 } : undefined;
});

export const CONDITIONS: Record<string, (s: GameState) => boolean> = {
  night_23: () => clock.hour() === 23,
  fever_streak: (s) => s.feverStreak >= 2,
  first_payday: (s) => s.metrics.firstAt.first_payday !== undefined,
  team_25: (s) => !!s.flags.team25,
  clones_100: (s) => totalClones(s) >= 100,
  first_cert: (s) => s.metrics.firstAt.first_cert !== undefined,
  account_open: (s) => s.account.open,
  stamp_3: (s) => s.stamp.days >= 3,
};

export const hasUnique = (s: GameState, id: string) => s.uniques.some((u) => u.id === id);

export function checkUniques(s: GameState, out: GameEvent[] = []) {
  for (const d of UNIQUES) {
    if (hasUnique(s, d.id)) continue;
    const f = CONDITIONS[d.condition];
    if (f && f(s)) grantUnique(s, d, out);
  }
}

export function grantUnique(s: GameState, d: UniqueDef, out: GameEvent[] = []) {
  s.uniques.push({ id: d.id, name: d.name, placedJob: null, gotAt: clock.now(), cityIdx: s.cityIdx });
  autoPlace(s);
  happening(s);
  out.push({ t: 'unique', id: d.id });
}

/** 빈 건물에 자동 추천 배치: job 패시브는 수입이 큰 건물부터, 나머지는 빈 칸 아무 곳 */
export function autoPlace(s: GameState) {
  const valid = new Set(cityJobs(s).filter((j) => isUnlocked(s, j)).map((j) => j.id));
  for (const u of s.uniques) if (u.placedJob && !valid.has(u.placedJob)) u.placedJob = null;
  for (const u of s.uniques) {
    if (u.placedJob) continue;
    const used = new Set(s.uniques.map((x) => x.placedJob).filter(Boolean));
    const free = cityJobs(s).filter((j) => valid.has(j.id) && !used.has(j.id));
    if (!free.length) return;
    const def = UNIQUES.find((d) => d.id === u.id);
    free.sort((a, b) => (def?.passive === 'job' ? jobIncomeBase(s, b) - jobIncomeBase(s, a) : a.slot - b.slot));
    u.placedJob = free[0].id;
  }
}

/** 수동 배치(그 건물에 다른 개성 분신이 있으면 자리를 맞바꿈) */
export function placeUnique(s: GameState, uid: string, jobId: string | null) {
  const u = s.uniques.find((x) => x.id === uid);
  if (!u) return;
  const other = jobId ? s.uniques.find((x) => x.placedJob === jobId && x !== u) : undefined;
  if (other) other.placedJob = u.placedJob;
  u.placedJob = jobId;
}
export function renameUnique(s: GameState, uid: string, name: string) {
  const u = s.uniques.find((x) => x.id === uid);
  const n = name.trim().slice(0, 12);
  if (u && n) u.name = n;
}

/** 도감 힌트 단계: 처음 본 뒤 하루가 지나거나 그 뒤 다른 개성 분신을 얻으면 2단계 */
export function hintLevel(s: GameState, id: string, now = clock.now()): 1 | 2 {
  if (s.uniqueHintAt[id] === undefined) s.uniqueHintAt[id] = now;
  const seen = s.uniqueHintAt[id];
  if (now - seen >= 86400e3) return 2;
  return s.uniques.some((u) => u.gotAt > seen) ? 2 : 1;
}

// ---------- 숨은 장면 ----------
export function discoverScene(s: GameState, cityId: string, sceneId: string): boolean {
  const list = (s.scenesFound[cityId] ??= []);
  if (list.includes(sceneId)) return false;
  list.push(sceneId);
  happening(s);
  return true;
}
