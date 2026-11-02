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

describe('economy v0.2 validation', () => {
  it('검증 오류 없음', () => expect(validateEconomy(ECON)).toEqual([]));
  it('도시 8, 직종 58, 칸 수 5·6·7·8·8·8·8·8', () => {
    expect(ECON.cities.length).toBe(8);
    expect(ECON.jobs.length).toBe(58);
    expect(ECON.cities.map((c) => c.slots)).toEqual([5, 6, 7, 8, 8, 8, 8, 8]);
  });
  it('도시마다 is_top 1개', () => {
    for (const c of ECON.cities) expect(ECON.jobs.filter((j) => j.city === c.city && j.isTop).length).toBe(1);
  });
  it('칸 해금 체인: 2~7칸 25명, 8칸 10명', () => {
    for (const j of ECON.jobs) {
      if (j.slot === 1) expect(j.unlockPrevCount).toBe(0);
      else expect(j.unlockPrevCount).toBe(j.slot === 8 ? 10 : 25);
    }
  });
  // v0.1 jobs.csv 원본이 없어 기획서 서술(도시 1 = v3.6 그대로: 기본가 10·×150, 수입 1·×9, 증가율 1.07~1.11)로 대조한다.
  it('도시 1 수치 = 기획서 v3.6 서술', () => {
    const c1 = ECON.jobs.filter((j) => j.city === 1);
    c1.forEach((j, i) => {
      expect(j.baseCost).toBeCloseTo(10 * 150 ** i, 6);
      expect(j.incomePerSec).toBeCloseTo(9 ** i, 6);
      expect(j.costGrowth).toBeCloseTo(1.07 + 0.01 * i, 9);
    });
  });
  it('도시 2~8: 1칸 = 이전 꼭대기 ×10, 칸 사이 ×12 (유효숫자 3자리 반올림 누적 오차 1.5% 허용)', () => {
    for (let c = 2; c <= 8; c++) {
      const prevTop = ECON.jobs.find((j) => j.city === c - 1 && j.isTop)!;
      const js = ECON.jobs.filter((j) => j.city === c);
      expect(Math.abs(js[0].baseCost / (prevTop.baseCost * 10) - 1)).toBeLessThan(0.015);
      for (let i = 1; i < js.length; i++) expect(Math.abs(js[i].baseCost / (js[i - 1].baseCost * 12) - 1)).toBeLessThan(0.015);
    }
  });
});
