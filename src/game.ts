// 게임 컨트롤러: 상태 보관, 시간 진행, 이벤트 버스, 저장/복귀. 경제 계산은 core에 위임한다.
import Phaser from 'phaser';
import { newGame, type GameEvent, type GameState } from './core/state';
import { eco } from './core/econ';
import { advance } from './core/sim';
import { loadState, saveState, resume, clearSave } from './core/save';
import { clock } from './core/clock';
import { sound } from './fx/sound';
import { ui } from './ui/kit';

class Controller {
  s: GameState = newGame(eco('payday_first_sec'));
  bus = new Phaser.Events.EventEmitter();
  speed = 1;
  isNew = true;
  private saveTimer = 0;

  boot() {
    const loaded = loadState();
    if (loaded) {
      this.s = loaded; this.isNew = false;
      resume(this.s, clock.now());
    } else {
      this.s = newGame(eco('payday_first_sec'), clock.now());
    }
    this.applySettings();
    const onHide = () => saveState(this.s);
    const onShow = () => {
      const out: GameEvent[] = [];
      const sec = resume(this.s, clock.now(), out);
      this.dispatch(out);
      if (sec > 0) this.bus.emit('resumed', sec);
    };
    document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
    window.addEventListener('pagehide', onHide);
  }

  applySettings() {
    sound.enabled = this.s.settings.sound;
    ui.fontScale = this.s.settings.bigText ? 1.15 : 1;
  }

  update(dtMs: number) {
    if (document.hidden) return;
    const dt = Math.min(dtMs / 1000, 0.25) * this.speed;
    const out: GameEvent[] = [];
    advance(this.s, dt, out);
    this.dispatch(out);
    this.saveTimer += dtMs;
    if (this.saveTimer > 5000) { this.saveTimer = 0; saveState(this.s); }
  }

  /** 액션 실행 → 생긴 이벤트를 화면에 전달 */
  act<T>(fn: (out: GameEvent[]) => T): T {
    const out: GameEvent[] = [];
    const r = fn(out);
    this.dispatch(out);
    return r;
  }

  dispatch(out: GameEvent[]) {
    for (const e of out) { this.bus.emit(e.t, e); this.bus.emit('any', e); }
  }

  save() { saveState(this.s); }
  reset() {
    clearSave();
    try { localStorage.removeItem('bunsin_album_v1'); } catch { /* 무시 */ }
    location.reload();
  }
}

export const G = new Controller();
