// PoC 진입점. 게임 기획 확정 전까지는 터치/클릭 입력과 배포 확인용 placeholder 씬만 둔다.

const GAME_WIDTH = 720;
const GAME_HEIGHT = 1280; // 세로 모바일 기준

class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.3, 'PoC Ready', {
      fontFamily: 'sans-serif',
      fontSize: '72px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.38, '화면을 터치해 보세요', {
      fontFamily: 'sans-serif',
      fontSize: '36px',
      color: '#a0a4c0',
    }).setOrigin(0.5);

    // 배포 확인용 빌드 ID (GitHub Actions가 커밋 SHA로 치환)
    const build = window.BUILD_ID && !window.BUILD_ID.startsWith('__') ? window.BUILD_ID : 'local';
    this.add.text(width - 16, height - 16, `build ${build}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#5c6080',
    }).setOrigin(1, 1);

    this.tapCount = 0;
    this.counter = this.add.text(width / 2, height * 0.5, '0', {
      fontFamily: 'sans-serif',
      fontSize: '96px',
      color: '#ffd166',
    }).setOrigin(0.5);

    this.input.on('pointerdown', (pointer) => {
      this.tapCount += 1;
      this.counter.setText(String(this.tapCount));
      const ring = this.add.circle(pointer.x, pointer.y, 20, 0x06d6a0, 0.8);
      this.tweens.add({
        targets: ring,
        radius: 80,
        alpha: 0,
        duration: 400,
        onComplete: () => ring.destroy(),
      });
    });
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1f2b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: { activePointers: 3 },
  scene: [BootScene],
});
