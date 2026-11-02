// 집(가구 레벨업 → 더 좋은 집 구매)과 자산(직종별 일터 1개). 둘 다 명성·수입과 연결된다. 판매 없음.
import { D, assetOf, city, isUnlocked, job, ownsAsset } from './econ';
import { firstAt, happening } from './ledger';
import type { GameEvent, GameState } from './state';
import type { Furniture, House } from '../data/economy';

export const cityHouses = (s: GameState): House[] => D.houses.filter((h) => h.city === city(s).city).sort((a, b) => a.tier - b.tier);
export const currentHouse = (s: GameState): House => D.houses.find((h) => h.id === s.home.houseId) ?? cityHouses(s)[0];
export const houseFurniture = (houseId: string): Furniture[] => D.furniture.filter((f) => f.houseId === houseId);
export const furnLevel = (s: GameState, id: string): number => s.home.levels[id] ?? 0;
export const furnCost = (f: Furniture, lv: number): number => f.baseCost * f.levelGrowth ** lv;
export const nextHouse = (s: GameState): House | undefined => cityHouses(s).find((h) => h.tier === currentHouse(s).tier + 1);
export const furnitureDone = (s: GameState): boolean => houseFurniture(currentHouse(s).id).every((f) => furnLevel(s, f.id) >= f.maxLevel);

export function upgradeFurniture(s: GameState, id: string, out: GameEvent[] = []): boolean {
  const f = D.furniture.find((x) => x.id === id);
  if (!f || f.houseId !== currentHouse(s).id) return false;
  const lv = furnLevel(s, id);
  if (lv >= f.maxLevel) return false;
  const cost = furnCost(f, lv);
  if (cost > s.money * (1 + 1e-12)) return false;
  s.money = Math.max(0, s.money - cost);
  s.home.levels[id] = lv + 1;
  s.home.fame += f.famePerLevel;
  firstAt(s, 'first_furniture');
  happening(s);
  out.push({ t: 'furniture', id, level: lv + 1 });
  return true;
}

export function buyHouse(s: GameState, out: GameEvent[] = []): boolean {
  const h = nextHouse(s);
  if (!h || !furnitureDone(s) || h.price > s.money * (1 + 1e-12)) return false;
  s.money = Math.max(0, s.money - h.price);
  s.home.houseId = h.id;
  s.home.bought.push(h.id);
  s.home.fame += h.fame;
  firstAt(s, 'first_house');
  happening(s);
  out.push({ t: 'house', id: h.id });
  return true;
}

/** 이사: 새 도시의 시작 집으로(이전 집은 총자산에 남는다) */
export function homeOnMove(s: GameState) { s.home.houseId = cityHouses(s)[0].id; }

export function canBuyAsset(s: GameState, jobId: string): boolean {
  const a = assetOf(jobId);
  return !!a && !ownsAsset(s, a.id) && isUnlocked(s, job(jobId));
}
export function buyAsset(s: GameState, jobId: string, out: GameEvent[] = []): boolean {
  const a = assetOf(jobId);
  if (!a || !canBuyAsset(s, jobId) || a.price > s.money * (1 + 1e-12)) return false;
  s.money = Math.max(0, s.money - a.price);
  s.assets.push(a.id);
  firstAt(s, 'first_asset');
  happening(s);
  out.push({ t: 'asset', id: a.id });
  return true;
}

/** 보유 자산 = 자산(매입가) + 산 집(매입가). 판매가 없으므로 줄지 않는다(현금·통장은 따로 표시) */
export function netWorth(s: GameState): { cash: number; account: number; assets: number; houses: number; total: number } {
  const account = (s.account.current?.balance ?? 0) + s.account.held.reduce((a, h) => a + h.balance, 0);
  const assets = s.assets.reduce((a, id) => a + (D.assets.find((x) => x.id === id)?.price ?? 0), 0);
  const houses = s.home.bought.reduce((a, id) => a + (D.houses.find((x) => x.id === id)?.price ?? 0), 0);
  return { cash: s.money, account, assets, houses, total: assets + houses };
}
