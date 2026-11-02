// 기기 시각. 디버그에서 오버라이드(밤 11시 숨은 조건 테스트 등)
let offsetMs = 0;
let hourOverride: number | null = null;
export const clock = {
  now: (): number => Date.now() + offsetMs,
  hour: (): number => (hourOverride ?? new Date(Date.now() + offsetMs).getHours()),
  dayKey: (): string => { const d = new Date(Date.now() + offsetMs); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
  setOffset(ms: number) { offsetMs = ms; },
  addOffset(ms: number) { offsetMs += ms; },
  setHour(h: number | null) { hourOverride = h; },
  get hourOverride() { return hourOverride; },
};
