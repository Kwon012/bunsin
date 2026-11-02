// 추천 구매 실행(고용·자격증·자산·가구·집) — 매니저와 화면이 같은 경로를 쓴다
import { hire, buyCert } from './actions';
import { buyAsset, upgradeFurniture, buyHouse } from './home';
import type { Purchase } from './recommend';
import type { GameEvent, GameState } from './state';

export function executePurchase(s: GameState, p: Purchase, out: GameEvent[] = [], hireAmount: number | 'max' = 1): boolean {
  switch (p.kind) {
    case 'hire': return hire(s, p.jobId, hireAmount, out);
    case 'cert': return buyCert(s, p.jobId, out);
    case 'asset': return buyAsset(s, p.jobId, out);
    case 'furniture': return upgradeFurniture(s, p.jobId, out);
    case 'house': return buyHouse(s, out);
  }
}
