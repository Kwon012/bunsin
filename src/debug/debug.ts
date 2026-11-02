// 검증용 디버그 도구(?debug=1 또는 왼쪽 위 숨은 영역 3탭). 게임 로직은 바꾸지 않고 core API만 호출.
import Phaser from 'phaser';
import { G } from '../game';
import { clock } from '../core/clock';
import { openAccount } from '../core/account';
import { firstAt } from '../core/ledger';
import { resume } from '../core/save';
import { metricsSummary } from '../core/metrics';
import { formatSec } from '../core/format';
import { button, txt, W, C } from '../ui/kit';
import type { GameEvent } from '../core/state';

export const debugExtra: { label: string; fn: () => void }[] = [];

export class DebugPanel {
  root: Phaser.GameObjects.Container;
  private info: Phaser.GameObjects.Text;
  private open = false;
  private dbgBtn?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(3000).setVisible(false);
    this.root.add(scene.add.rectangle(W / 2, 330, W, 560, 0x000000, 0.88).setInteractive());
    this.info = txt(scene, 8, 360, '', 10, '#9effa0', { wordWrap: { width: W - 16 } });
    this.root.add(this.info);
    if (new URLSearchParams(location.search).get('debug') === '1') {
      this.dbgBtn = button(scene, W - 106, 88, 40, 22, 'DBG', () => this.toggle(), 0xef476f, 10).setDepth(2999);
    }
  }

  toggle() {
    this.open = !this.open;
    if (this.open) this.build();
    this.root.setVisible(this.open);
  }

  private act(fn: (out: GameEvent[]) => void) { G.act(fn); this.build(); }

  build() {
    this.root.list.slice(2).forEach((o) => o.destroy());
    const sc = this.scene; const s = G.s;
    const items: [string, () => void][] = [
      ['×1', () => (G.speed = 1)], ['×10', () => (G.speed = 10)], ['×60', () => (G.speed = 60)], ['×600', () => (G.speed = 600)],
      ['오프 1h', () => this.offline(1)], ['오프 8h', () => this.offline(8)], ['오프 30일', () => this.offline(720)], ['돈 ×10', () => (s.money = Math.max(s.money, 100) * 10)],
      ['돈 ×1000', () => (s.money = Math.max(s.money, 100) * 1000)], ['월급날 즉시', () => (s.paydayIn = 0.01)],
      ['매니저 해금', () => this.act((o) => { if (!s.managerUnlocked) { s.managerUnlocked = true; firstAt(s, 'manager'); o.push({ t: 'manager' }); } })],
      ['통장 해금', () => this.act((o) => { s.managerUnlocked = true; if (!s.account.open) openAccount(s, o); })],
      [`시각 ${clock.hourOverride === null ? '실제' : clock.hourOverride + '시'}`, () => { clock.setHour(clock.hourOverride === null ? 23 : clock.hourOverride === 23 ? 9 : null); }],
      ['하루 지남', () => { clock.addOffset(86400e3); }],
      ['지표 JSON', () => this.exportJson()], ['세이브 초기화', () => { if (confirm('세이브를 지울까요?')) G.reset(); }],
      ...debugExtra.map((d) => [d.label, d.fn] as [string, () => void]),
      ['닫기', () => this.toggle()],
    ];
    items.forEach(([label, fn], i) => {
      const x = 46 + (i % 4) * 89, y = 72 + Math.floor(i / 4) * 34;
      const b = button(sc, x, y, 84, 28, label, () => { fn(); this.build(); }, label.startsWith('×') && G.speed === Number(label.slice(1)) ? 0x06a77d : 0x3a3f5c, 10);
      this.root.add(b);
    });
    this.info.setY(80 + Math.ceil(items.length / 4) * 34);
    this.refresh();
  }

  private offline(h: number) {
    G.s.lastSeen = clock.now() - h * 3600e3;
    const out: GameEvent[] = [];
    const sec = resume(G.s, clock.now(), out);
    G.dispatch(out);
    G.bus.emit('resumed', sec);
    this.toggle();
  }

  private exportJson() {
    const blob = new Blob([JSON.stringify(metricsSummary(G.s), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bunsin-metrics.json'; a.click();
  }

  refresh() {
    if (!this.open) return;
    const m = metricsSummary(G.s);
    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const pace = Object.entries(m.pacing).map(([k, v]) => `${k} ${formatSec(v)}`).join(' · ');
    this.info.setText([
      `배속 ×${G.speed} · 누적 플레이 ${formatSec(m.playTimeSec)} · 시각 ${clock.hour()}시`,
      `무반응 ${pct(m.idleRatio)} · 벽 노출 ${pct(m.wallExposure)} · 막다른 벽 ${pct(m.deadWallRatio)} (최장 ${formatSec(m.longestDeadWallSec)})`,
      `사건 ${m.eventsShown}회 · 놓침 ${pct(m.eventMissRatio)} · 마무리 카드 ${m.closingCards} · 배당 비중 ${pct(m.dividendShare)}`,
      `페이싱: ${pace || '-'}`,
      `직종별 수입 비중: ${Object.entries(m.jobShare).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}${Object.values(m.jobShare).some((v) => v >= 0.9) ? ' ⚠️90%↑' : ''}`,
    ].join('\n'));
  }
}
void C;
