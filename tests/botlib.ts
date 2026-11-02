// 밸런스 봇(core만 사용). 페르소나·접속 패턴은 가정(ASSUMPTIONS X-38).
import { newGame, type GameEvent, type GameState } from '../src/core/state';
import { eco, cityJobs, incomeBase, city, D } from '../src/core/econ';
import { advance } from '../src/core/sim';
import { tap } from '../src/core/actions';
import { recommend, canMove, wallInfo } from '../src/core/recommend';
import { executePurchase } from '../src/core/purchase';
import { moveCity } from '../src/core/move';
import { simulateOffline, collectOffline } from '../src/core/offline';

export interface BotLog { t: number; what: string }
export interface BotResult { s: GameState; log: BotLog[]; wallSec: number; wallNewestSec: number; walls: { start: number; len: number; rec: string }[]; income: Record<string, number> }

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** dt 단위로 접속 플레이. tapsPerSec(t) = 누적 플레이 t초의 탭 속도 */
export function play(s: GameState, sec: number, tapsPerSec: (t: number) => number, res: BotResult, opts: { move?: boolean } = {}) {
  const dt = 0.25;
  let wallStart = -1, wallRec = '';
  for (let t = 0; t < sec; t += dt) {
    const out: GameEvent[] = [];
    if (rnd() < tapsPerSec(s.playTime) * dt) tap(s, out);
    for (let k = 0; k < 10; k++) {
      const r = recommend(s);
      if (!r || r.cost > s.money) break;
      if (!executePurchase(s, r, out)) break;
    }
    if (opts.move && canMove(s) && wallInfo(s).moveSuggest) moveCity(s, out);
    advance(s, dt, out);
    for (const e of out) {
      if (e.t === 'first_job') res.log.push({ t: s.playTime, what: `첫 ${e.jobId}` });
      if (e.t === 'payday' && e.slip.index <= 3) res.log.push({ t: s.playTime, what: `월급날#${e.slip.index} +${Math.round(e.slip.total / Math.max(1, incomeBase(s)))}초치` });
      if (e.t === 'asset' || e.t === 'house') res.log.push({ t: s.playTime, what: `${e.t} ${e.id}` });
      if (e.t === 'cap_full') res.log.push({ t: s.playTime, what: `정원 ${e.jobId}` });
      if (e.t === 'reveal') res.log.push({ t: s.playTime, what: '마을 공개' });
      if (e.t === 'move') res.log.push({ t: s.playTime, what: `이사 → ${D.cities[e.toCity].id} 명성+${e.fameGain}` });
    }
    const w = wallInfo(s);
    if (w.wall) {
      res.wallSec += dt;
      const newest = cityJobs(s).filter((j) => (s.owned[j.id] ?? 0) > 0 || j.slot === 1).pop();
      const lockedNext = cityJobs(s).find((j) => !(s.owned[j.id] ?? 0));
      const isNewest = !!w.rec && w.rec.kind === 'hire' && (w.rec.jobId === lockedNext?.id || w.rec.jobId === newest?.id);
      if (isNewest) res.wallNewestSec += dt;
      if (wallStart < 0) { wallStart = s.playTime; wallRec = w.rec ? `${w.rec.kind}:${w.rec.jobId}` : '-'; }
    } else if (wallStart >= 0) {
      if (s.playTime - wallStart >= 60) res.walls.push({ start: wallStart, len: s.playTime - wallStart, rec: wallRec });
      wallStart = -1;
    }
  }
}

export function newBot(): BotResult { seed = 7; return { s: newGame(eco('payday_first_sec'), 0), log: [], wallSec: 0, wallNewestSec: 0, walls: [], income: {} }; }
export function offline(s: GameState, sec: number) { const rep = simulateOffline(s, sec); collectOffline(s, rep); s.sessions++; s.sessionTime = 0; }
export const mm = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export { city };
