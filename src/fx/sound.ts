// WebAudio 오실레이터 효과음 4종(탭, 뿅, 월급날 띵, 피버). 에셋 없음.
let ctx: AudioContext | null = null;
export const sound = { enabled: true };

function ac(): AudioContext | null {
  if (!sound.enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.15, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
let lastTap = 0;
export const sfx = {
  /** 탭: 콤보가 오를수록 음높이 상승(pitch 1~1.5) */
  tap(pitch = 1) { const n = performance.now(); if (n - lastTap < 45) return; lastTap = n; tone('square', 880 * pitch, 660 * pitch, 0.04, 0.05); tone('sine', 1760 * pitch, 1760 * pitch, 0.03, 0.03); },
  coin() { tone('triangle', 1975, 2637, 0.06, 0.04); },
  pop() { tone('sine', 300, 1000, 0.12, 0.18); },
  ding() { tone('triangle', 1318, 1318, 0.7, 0.2); tone('triangle', 1760, 1760, 0.9, 0.12, 0.08); },
  fever() { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.12, 0.07, i * 0.08)); },
};
