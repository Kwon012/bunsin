// 저장: localStorage(try/catch). 막히면 메모리로 동작.
import { eco } from './econ';
import { clock } from './clock';
import { A } from './assumptions';
import { collectOffline, simulateOffline } from './offline';
import { newGame, SAVE_VERSION, type GameEvent, type GameState } from './state';

const KEY = 'bunsin_save_v1';
let memory: string | null = null;
export let storageOk = true;

export function serialize(s: GameState): string { return JSON.stringify(s); }

function merge<T>(def: T, v: unknown): T {
  if (v === undefined || v === null) return def;
  if (typeof def !== 'object' || def === null || Array.isArray(def)) return v as T;
  const o: Record<string, unknown> = { ...(def as Record<string, unknown>) };
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const dv = (def as Record<string, unknown>)[k];
    o[k] = dv !== undefined && typeof dv === 'object' && dv !== null && !Array.isArray(dv) && Object.keys(dv).length ? merge(dv, val) : val;
  }
  return o as T;
}
export function deserialize(str: string): GameState {
  const raw = JSON.parse(str);
  if (!raw || raw.v !== SAVE_VERSION) throw new Error('세이브 버전이 달라 새로 시작');
  return merge(newGame(eco('payday_first_sec')), raw);
}

export function saveState(s: GameState) {
  s.lastSeen = clock.now();
  const str = serialize(s);
  try { localStorage.setItem(KEY, str); storageOk = true; } catch { memory = str; storageOk = false; }
}
export function loadState(): GameState | null {
  let str: string | null = null;
  try { str = localStorage.getItem(KEY); } catch { storageOk = false; str = memory; }
  if (!str) return null;
  try { return deserialize(str); } catch { return null; }
}
export function clearSave() {
  memory = null;
  try { localStorage.removeItem(KEY); } catch { /* 메모리 모드 */ }
}

/** 복귀 처리: 부재 시간만큼 오프라인 정산. 짧으면 바로 합산, 길면 정산서(pendingOffline) */
export function resume(s: GameState, now = clock.now(), out: GameEvent[] = []): number {
  const sec = Math.max(0, (now - s.lastSeen) / 1000);
  s.lastSeen = now;
  if (sec < 1) return 0;
  const rep = simulateOffline(s, sec, out);
  if (sec < A.X_settlementMinSec && !s.pendingOffline) { collectOffline(s, rep, false); return sec; }
  if (s.pendingOffline) {
    // 아직 안 받은 정산서가 있으면 합친다
    const p = s.pendingOffline;
    p.sec += rep.sec; p.income += rep.income; p.paydays += rep.paydays; p.envelopes += rep.envelopes;
    p.dividendCash += rep.dividendCash; p.dividendReinvest += rep.dividendReinvest; p.heldDividend += rep.heldDividend;
    p.capped = p.capped || rep.capped;
    for (const [k, v] of Object.entries(rep.byJob)) p.byJob[k] = (p.byJob[k] ?? 0) + v;
  } else s.pendingOffline = rep;
  s.sessions++; s.sessionTime = 0;
  return sec;
}
