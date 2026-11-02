import { describe, it, expect, afterEach } from 'vitest';
import { newGame, type GameEvent } from '../src/core/state';
import { eco, incomeBase, jobIncomeBase, job } from '../src/core/econ';
import { advance } from '../src/core/sim';
import { hire, buyCert, startFever } from '../src/core/actions';
import { shouldSpawnEvent, pickEvent, markEventShown, resolveEvent, eventReward, nextNews, seriesProgress } from '../src/core/director';
import { checkUniques, placeUnique, renameUnique, hintLevel, discoverScene, hasUnique } from '../src/core/uniques';
import { openAccount } from '../src/core/account';
import { clock } from '../src/core/clock';
import { EVENTS } from '../src/data/content';

const fresh = () => newGame(eco('payday_first_sec'), 0);
afterEach(() => { clock.setHour(null); });

describe('사건 카드', () => {
  it('무반응 12초 후 등장, 첫 3분 간격 20초 → 이후 30초', () => {
    const s = fresh(); s.paydayIn = 1e9;
    advance(s, 11.9); expect(shouldSpawnEvent(s, false)).toBe(false);
    advance(s, 8.2); expect(shouldSpawnEvent(s, false)).toBe(true);
    expect(shouldSpawnEvent(s, true)).toBe(false); // 이미 떠 있으면 안 겹침
    markEventShown(s, 'ev_tip');
    advance(s, 19.9); expect(shouldSpawnEvent(s, false)).toBe(false);
    advance(s, 0.2); expect(shouldSpawnEvent(s, false)).toBe(true);
    s.sessionTime = 500; s.director.sinceEvent = 25; expect(shouldSpawnEvent(s, false)).toBe(false);
    s.director.sinceEvent = 30; expect(shouldSpawnEvent(s, false)).toBe(true);
  });
  it('8장, 절반 한 번 탭·절반 2지선다', () => {
    expect(EVENTS.length).toBe(8);
    expect(EVENTS.filter((e) => e.type === 'tap').length).toBe(4);
  });
  it('같은 사건은 재등장 간격 안에 다시 안 나옴', () => {
    const s = fresh();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) { const e = pickEvent(s)!; expect(seen.has(e.id)).toBe(false); seen.add(e.id); markEventShown(s, e.id); if (e.series) resolveEvent(s, e, 'a'); }
  });
  it('연작: 선택하면 다음 사건으로 이어짐(1/3 → 2/3 → 3/3)', () => {
    const s = fresh();
    const e1 = EVENTS.find((e) => e.id === 'ev_s1')!;
    expect(seriesProgress(e1)).toBe('1/3');
    resolveEvent(s, e1, 'b');
    expect(pickEvent(s)!.id).toBe('ev_s2');
    resolveEvent(s, EVENTS.find((e) => e.id === 'ev_s2')!, 'a');
    expect(pickEvent(s)!.id).toBe('ev_s3');
    resolveEvent(s, EVENTS.find((e) => e.id === 'ev_s3')!, 'a');
    expect(s.director.series.s_dream).toBeUndefined();
  });
  it('보상 = 초당 수입 × 30~120초, 손해 없음', () => {
    const s = fresh(); s.owned.home_1 = 50;
    for (const e of EVENTS) for (const c of ['a', 'b'] as const) {
      const v = eventReward(s, e, c);
      expect(v).toBeGreaterThanOrEqual(incomeBase(s) * 30 - 1e-9);
      expect(v).toBeLessThanOrEqual(incomeBase(s) * 120 + 1e-9);
    }
  });
});

describe('뉴스', () => {
  it('60초 주기 + 방금 일어난 일 연동', () => {
    const s = fresh(); s.money = 1e9; s.paydayIn = 1e9;
    hire(s, 'home_1', 25);
    expect(nextNews(s)).toContain('승진');
    expect(nextNews(s).length).toBeGreaterThan(5);
    expect(s.director.news.length).toBe(2);
  });
});

describe('개성 분신(숨은 조건, 비확률)', () => {
  it('밤 11시 접속 → 야근왕 (시각 오버라이드)', () => {
    const s = fresh(); checkUniques(s); expect(hasUnique(s, 'u_night')).toBe(false);
    clock.setHour(23); checkUniques(s); expect(hasUnique(s, 'u_night')).toBe(true);
  });
  it('피버 연속 → 확성기 분신', () => {
    const s = fresh(); s.owned.home_1 = 1; s.paydayIn = 1e9;
    startFever(s); advance(s, 16); startFever(s); checkUniques(s);
    expect(hasUnique(s, 'u_mega')).toBe(true);
  });
  it('첫 월급날 → 첫 월급 분신', () => {
    const s = fresh(); s.owned.home_1 = 1; advance(s, 241);
    expect(hasUnique(s, 'u_payday')).toBe(true);
  });
  it('팀 보너스 25명 → 단체사진 분신, 분신 100명 → 백 번째 분신', () => {
    const s = fresh(); s.money = 1e12; s.paydayIn = 1e9;
    hire(s, 'home_1', 25); checkUniques(s); expect(hasUnique(s, 'u_team')).toBe(true);
    hire(s, 'home_2', 75); checkUniques(s); expect(hasUnique(s, 'u_hundred')).toBe(true);
  });
  it('첫 자격증 / 통장 개설 / 출근 도장 3일', () => {
    const s = fresh(); s.money = 1e12; s.paydayIn = 1e9;
    hire(s, 'home_1', 25); buyCert(s, 'home_1'); checkUniques(s); expect(hasUnique(s, 'u_cert')).toBe(true);
    s.managerUnlocked = true; openAccount(s); checkUniques(s); expect(hasUnique(s, 'u_piggy')).toBe(true);
    s.stamp.days = 3; checkUniques(s); expect(hasUnique(s, 'u_stamp')).toBe(true);
  });
  it('자동 배치(건물당 1칸) + 패시브 + 맞바꾸기 + 이름 변경', () => {
    const s = fresh(); s.money = 1e12; s.paydayIn = 1e9;
    hire(s, 'home_1', 30); hire(s, 'home_2', 5);
    const before = jobIncomeBase(s, job('home_1'));
    clock.setHour(23); checkUniques(s);
    const u = s.uniques.find((x) => x.id === 'u_night')!;
    expect(u.placedJob).not.toBeNull();
    placeUnique(s, 'u_night', 'home_1');
    expect(jobIncomeBase(s, job('home_1'))).toBeCloseTo(before * 1.1, 6);
    checkUniques(s); // 단체사진 분신도 얻음 → 다른 건물에 자동 배치
    const placed = s.uniques.map((x) => x.placedJob);
    expect(new Set(placed).size).toBe(placed.length);
    renameUnique(s, 'u_night', '  김야근  ');
    expect(u.name).toBe('김야근');
  });
  it('힌트 2단계: 하루 지나거나 다른 개성 분신 획득', () => {
    const s = fresh();
    expect(hintLevel(s, 'u_mega', 1000)).toBe(1);
    expect(hintLevel(s, 'u_mega', 1000 + 86400e3)).toBe(2);
  });
});

describe('숨은 장면', () => {
  it('도시별 발견 기록, 중복 없음', () => {
    const s = fresh();
    expect(discoverScene(s, 'home', 'sc_cat')).toBe(true);
    expect(discoverScene(s, 'home', 'sc_cat')).toBe(false);
    expect(s.scenesFound.home.length).toBe(1);
  });
});
