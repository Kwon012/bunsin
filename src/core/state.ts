// 게임 상태(직렬화 대상). Phaser 의존 없음.
import type { Tier } from '../data/economy';

export interface StockHolding { stockId: string; cityIdx: number; balance: number }
export interface UniqueOwned { id: string; name: string; placedJob: string | null; gotAt: number; cityIdx: number }
export interface Goal { kind: 'hire' | 'team' | 'unlock' | 'reveal' | 'top' | 'cert'; jobId: string; target: number; start: number; label: string }
export interface Metrics {
  firstAt: Record<string, number>;   // 페이싱: 이름 → 누적 플레이 시간(초)
  idleSec: number;                   // 무반응 시간(새 일 없이 15초 초과분)
  wallSec: number;                   // 벽(막다른+출구) 노출 시간
  deadWallSec: number;               // 막다른 벽 시간
  longestDeadWall: number;
  curDeadWall: number;
  eventsShown: number; eventsMissed: number;
  closingCards: number;
  income: Record<string, number>;    // 출처별 수입: income, tap, payday, offline, dividend, event, settle, open
}
export interface PaydayLine { label: string; amount: number; tier?: Tier }
export interface PaydaySlip {
  online: boolean; index: number; lines: PaydayLine[]; floorApplied: boolean; bonus: number;
  dividendReinvest: number; dividendCash: number; heldDividend: number; total: number;
  accountOpened: boolean; openBonus: number; managerUnlocked: boolean;
}
export interface OfflineReport {
  sec: number; capped: boolean; byJob: Record<string, number>; income: number;
  paydays: number; envelopes: number; dividendCash: number; dividendReinvest: number; heldDividend: number;
  accountOpened: boolean; managerUnlocked: boolean;
}

export interface GameState {
  v: number;
  money: number;
  cityIdx: number;
  owned: Record<string, number>;
  certs: Record<string, number>;
  fameByCity: number[];
  cityEarned: number;
  totalEarned: number;
  playTime: number;
  sessionTime: number;
  sessions: number;
  // 탭·피버
  feverGauge: number;
  feverLeft: number;
  feverCount: number;
  feverStreak: number;
  lastFeverEndAt: number;
  sinceTap: number;
  taps: number;
  feverCombo: number;
  bestCombo: number;
  // 월급날
  paydayIn: number;
  paydayCount: number;
  onlinePaydays: number;
  sinceJob: Record<string, number>;
  envelopes: number;
  // 매니저
  managerUnlocked: boolean;
  managerOn: boolean;
  managerTimer: number;
  // 통장
  account: { open: boolean; autoSave: boolean; current: StockHolding | null; held: StockHolding[] };
  // 개성 분신
  uniques: UniqueOwned[];
  uniqueHintAt: Record<string, number>;
  // 진행
  goal: Goal | null;
  flags: Record<string, number>;
  teamSeen: Record<string, number>;
  maxUnitSeen: number;
  totalHired: number;
  stamp: { lastDay: string; days: number };
  scenesFound: Record<string, string[]>;
  cityHistory: { cityIdx: number; clones: number; earned: number; fame: number }[];
  pendingOffline: OfflineReport | null;
  // 사건·뉴스 연출 상태
  director: { sinceHappening: number; sinceEvent: number; sinceNews: number; seen: Record<string, number>; series: Record<string, string>; newsIdx: number; lastLines: string[] };
  lastSeen: number;
  metrics: Metrics;
  settings: { sound: boolean; bigText: boolean };
}

export const SAVE_VERSION = 1;

export function newMetrics(): Metrics {
  return { firstAt: {}, idleSec: 0, wallSec: 0, deadWallSec: 0, longestDeadWall: 0, curDeadWall: 0,
    eventsShown: 0, eventsMissed: 0, closingCards: 0, income: {} };
}

export function newGame(paydayFirstSec: number, now = Date.now()): GameState {
  return {
    v: SAVE_VERSION, money: 0, cityIdx: 0, owned: {}, certs: {}, fameByCity: [], cityEarned: 0, totalEarned: 0,
    playTime: 0, sessionTime: 0, sessions: 1,
    feverGauge: 0, feverLeft: 0, feverCount: 0, feverStreak: 0, lastFeverEndAt: -1e9, sinceTap: 1e9, taps: 0, feverCombo: 0, bestCombo: 0,
    paydayIn: paydayFirstSec, paydayCount: 0, onlinePaydays: 0, sinceJob: {}, envelopes: 0,
    managerUnlocked: false, managerOn: true, managerTimer: 1,
    account: { open: false, autoSave: true, current: null, held: [] },
    uniques: [], uniqueHintAt: {},
    goal: null, flags: {}, teamSeen: {}, maxUnitSeen: -1, totalHired: 0,
    stamp: { lastDay: '', days: 0 }, scenesFound: {}, cityHistory: [], pendingOffline: null,
    director: { sinceHappening: 0, sinceEvent: 0, sinceNews: 0, seen: {}, series: {}, newsIdx: 0, lastLines: [] },
    lastSeen: now, metrics: newMetrics(), settings: { sound: true, bigText: false },
  };
}

/** 이벤트(연출 트리거). core가 만들고 화면이 소비한다. */
export type GameEvent =
  | { t: 'hire'; jobId: string; n: number }
  | { t: 'team'; jobId: string; count: number }
  | { t: 'unlock'; jobId: string }
  | { t: 'crown'; total: number }
  | { t: 'cert'; jobId: string; level: number }
  | { t: 'reveal' }
  | { t: 'tap'; amount: number; auto: boolean }
  | { t: 'fever_start' }
  | { t: 'fever_end'; combo: number }
  | { t: 'payday'; slip: PaydaySlip }
  | { t: 'manager' }
  | { t: 'account_open'; bonus: number }
  | { t: 'unique'; id: string }
  | { t: 'top_hired'; jobId: string }
  | { t: 'unit'; index: number }
  | { t: 'move'; fromCity: number; toCity: number; fameGain: number; settle: number }
  | { t: 'event_card'; id: string }
  | { t: 'news'; text: string }
  | { t: 'closing' };
