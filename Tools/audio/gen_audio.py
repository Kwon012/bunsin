#!/usr/bin/env python3
"""효과음·배경음 합성(외부 에셋 없음). 실행: python3 Tools/audio/gen_audio.py
출력: Assets/_Project/Resources/Audio/*.wav (22.05kHz 모노 16bit)
모든 소리에 5ms 페이드를 넣어 끝이 '틱' 하지 않게 한다."""
import math, os, random, struct, wave

SR = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "Assets", "_Project", "Resources", "Audio")
random.seed(7)


def env(i, n, attack=0.005, release=0.03):
    t, T = i / SR, n / SR
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = min(1.0, (T - t) / release) if release > 0 else 1.0
    return max(0.0, min(a, r))


def tone(freq, dur, vol=0.5, decay=6.0, harm=(1.0, 0.3, 0.1), slide=0.0, vib=0.0):
    n = int(SR * dur)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = freq * (1 + slide * t / dur) * (1 + vib * math.sin(2 * math.pi * 6 * t))
        ph += 2 * math.pi * f / SR
        s = sum(a * math.sin(ph * (k + 1)) for k, a in enumerate(harm))
        out.append(s * vol * math.exp(-decay * t) * env(i, n))
    return out


def noise(dur, vol=0.3, decay=30.0, lp=0.5):
    n = int(SR * dur)
    out, y = [], 0.0
    for i in range(n):
        y += lp * (random.uniform(-1, 1) - y)
        out.append(y * vol * math.exp(-decay * i / SR) * env(i, n, 0.002, 0.01))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    return out


def at(track, sec):
    return [0.0] * int(SR * sec) + track


def save(name, samples, gain=1.0):
    peak = max(1e-6, max(abs(s) for s in samples))
    k = min(gain, 0.95 / peak)
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))
    print(f"{name}.wav  {len(samples) / SR:.2f}s")


def note(semi):  # A4 = 440 기준 반음
    return 440.0 * 2 ** (semi / 12)


def main():
    os.makedirs(OUT, exist_ok=True)
    # 탭: 짧고 통통한 '톡'
    save("tap", mix(tone(520, 0.07, 0.6, 40, (1, 0.2), slide=-0.3), noise(0.03, 0.15, 80)))
    # 동전: 높은 두 음
    save("coin", mix(tone(1320, 0.09, 0.4, 25), at(tone(1760, 0.14, 0.4, 18), 0.05)))
    # 뿅: 위로 미끄러지는 소리
    save("pop", tone(420, 0.16, 0.6, 10, (1, 0.25), slide=1.6))
    # UI 클릭
    save("click", mix(noise(0.02, 0.35, 120, 0.7), tone(900, 0.03, 0.2, 60)))
    # 구매·승인
    save("buy", mix(tone(note(3), 0.1, 0.4, 14), at(tone(note(7), 0.1, 0.4, 14), 0.07), at(tone(note(10), 0.2, 0.4, 10), 0.14)))
    # 불가
    save("deny", mix(tone(180, 0.12, 0.5, 14, (1, 0.5, 0.3)), at(tone(150, 0.16, 0.5, 12, (1, 0.5, 0.3)), 0.1)))
    # 레벨업
    save("levelup", mix(tone(note(0), 0.1, 0.35, 16), at(tone(note(4), 0.1, 0.35, 16), 0.06), at(tone(note(7), 0.22, 0.35, 9), 0.12)))
    # 승진 팡파르: 장3화음 상행 + 마지막 화음
    fan = mix(tone(note(-2), 0.14, 0.4, 9, (1, 0.5, 0.25)), at(tone(note(2), 0.14, 0.4, 9, (1, 0.5, 0.25)), 0.12),
              at(tone(note(5), 0.14, 0.4, 9, (1, 0.5, 0.25)), 0.24),
              at(mix(tone(note(10), 0.7, 0.35, 3.5, (1, 0.5, 0.25), vib=0.004), tone(note(5), 0.7, 0.25, 3.5), tone(note(2), 0.7, 0.25, 3.5)), 0.38))
    save("promo", fan)
    # 월급날 '띵' + 동전 쏟아짐
    pay = mix(tone(note(12), 0.9, 0.5, 3.0, (1, 0.4, 0.2, 0.1)), tone(note(19), 0.9, 0.25, 3.5))
    for k in range(10):
        pay = mix(pay, at(tone(1500 + random.uniform(-250, 450), 0.07, 0.16, 30), 0.15 + k * 0.055))
    save("payday", pay)
    # 피버 시작: 빠른 상행 아르페지오
    fev = []
    for k, s in enumerate((0, 4, 7, 12, 16, 19)):
        fev = mix(fev, at(tone(note(s), 0.16, 0.35, 10, (1, 0.6, 0.3)), k * 0.055)) if fev else tone(note(s), 0.16, 0.35, 10, (1, 0.6, 0.3))
    save("fever", fev)
    # 새 시스템 해금
    save("unlock", mix(tone(note(7), 0.12, 0.35, 10), at(tone(note(12), 0.12, 0.35, 10), 0.1), at(tone(note(16), 0.12, 0.35, 10), 0.2), at(tone(note(19), 0.5, 0.35, 4), 0.3)))
    # 사건 말풍선
    save("bubble", mix(tone(700, 0.08, 0.35, 20, slide=0.5), at(tone(1000, 0.1, 0.3, 18, slide=0.3), 0.08)))
    # 이사 트럭 경적
    save("truck", mix(tone(330, 0.18, 0.4, 3, (1, 0.6, 0.4)), tone(415, 0.18, 0.4, 3, (1, 0.6, 0.4)),
                      at(mix(tone(330, 0.35, 0.4, 2.5, (1, 0.6, 0.4)), tone(415, 0.35, 0.4, 2.5, (1, 0.6, 0.4))), 0.26)))
    # 카메라 셔터
    save("shutter", mix(noise(0.05, 0.5, 60, 0.9), at(noise(0.06, 0.4, 50, 0.6), 0.09)))

    # 배경음: 느긋한 마림바 풍 루프(96bpm, 8마디). 끝과 처음이 이어지게 꼬리를 앞에 접어 넣는다.
    beat = 60 / 96
    bars = 8
    total = int(SR * beat * 4 * bars)
    buf = [0.0] * (total + SR * 2)

    def put(track, sec, vol=1.0):
        start = int(SR * sec)
        for i, v in enumerate(track):
            buf[start + i] += v * vol

    chords = [(-9, -5, -2), (-4, 0, 3), (-7, -4, 0), (-2, 2, 5), (-9, -5, -2), (-4, 0, 3), (-7, -2, 2), (-2, 2, 5)]
    melody = [[3, None, 7, 10, None, 7, 5, None], [8, None, 7, 3, None, 0, 3, None],
              [5, None, 8, 12, None, 8, 7, None], [10, None, 7, 5, None, 2, 5, None],
              [3, None, 7, 10, None, 12, 15, None], [15, None, 12, 8, None, 7, 3, None],
              [5, None, 8, 12, None, 10, 8, None], [7, None, 5, 2, None, 5, 3, None]]
    for b in range(bars):
        t0 = b * 4 * beat
        root, third, fifth = chords[b]
        put(tone(note(root - 12), beat * 1.6, 0.30, 2.2, (1, 0.3)), t0)
        put(tone(note(root - 12), beat * 1.2, 0.24, 2.6, (1, 0.3)), t0 + 2.5 * beat)
        for k in range(4):
            for s in (third, fifth):
                put(tone(note(s), beat * 0.9, 0.07, 5.0, (1, 0.15)), t0 + k * beat + beat * 0.5)
        for k, s in enumerate(melody[b]):
            if s is not None:
                put(tone(note(s), beat * 1.1, 0.20, 5.5, (1, 0.35, 0.05)), t0 + k * beat * 0.5)
        for k in range(8):
            put(noise(0.03, 0.035 if k % 2 else 0.02, 90, 0.9), t0 + k * beat * 0.5)
    for i in range(total, len(buf)):   # 꼬리를 처음으로 접기
        buf[i - total] += buf[i]
    save("bgm", buf[:total], gain=0.8)


if __name__ == "__main__":
    main()
