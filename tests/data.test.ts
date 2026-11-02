import { describe, it, expect } from 'vitest';
import { parseCsv } from '../src/data/csv';
import { ECON, validateEconomy } from '../src/data/economy';

describe('csv parser', () => {
  it('BOM, CRLF, 따옴표 안 쉼표, 지수 표기', () => {
    const rows = parseCsv('﻿a,b,c\r\n1,"x, y",1.260E+17\r\n2,"he said ""hi""",3\r\n');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', 'x, y', '1.260E+17'], ['2', 'he said "hi"', '3']]);
    expect(Number(rows[1][2])).toBe(1.26e17);
  });
});

describe('economy v0.3 validation', () => {
  it('검증 오류 없음', () => expect(validateEconomy(ECON)).toEqual([]));
  it('도시 8, 직종 58, 칸 수 5·6·7·8·8·8·8·8', () => {
    expect(ECON.cities.length).toBe(8);
    expect(ECON.jobs.length).toBe(58);
    expect(ECON.cities.map((c) => c.slots)).toEqual([5, 6, 7, 8, 8, 8, 8, 8]);
  });
  it('도시마다 is_top 1개', () => {
    for (const c of ECON.cities) expect(ECON.jobs.filter((j) => j.city === c.city && j.isTop).length).toBe(1);
  });
  it('칸 해금 체인: 2~7칸 = 이전 칸 정원의 40%, 8칸 = 10명(R-006)', () => {
    for (const j of ECON.jobs) {
      if (j.slot === 1) expect(j.unlockPrevCount).toBe(0);
      else if (j.slot === 8) expect(j.unlockPrevCount).toBe(10);
      else expect(j.unlockPrevCount).toBe(Math.round(j.maxCount * 0.4));
    }
  });
  it('v0.3: 직종마다 정원·자산 1개, 도시마다 집 3단계(시작 집 무료)·가구', () => {
    for (const j of ECON.jobs) { expect(j.maxCount).toBeGreaterThan(0); expect(ECON.assets.filter((a) => a.jobId === j.id).length).toBe(1); }
    for (const c of ECON.cities) {
      const hs = ECON.houses.filter((h) => h.city === c.city);
      expect(hs.length).toBe(3); expect(hs[0].price).toBe(0);
    }
    expect(ECON.cities[0].firstIncome).toBe(10320); // 2026 최저시급
  });
  it('도시가 넘어갈수록 정원이 커져 오래 걸림', () => {
    const caps = ECON.cities.map((c) => ECON.jobs.find((j) => j.city === c.city)!.maxCount);
    for (let i = 1; i < caps.length; i++) expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1]);
  });
});
