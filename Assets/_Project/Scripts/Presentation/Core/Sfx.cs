using System.Collections.Generic;
using UnityEngine;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 소리. Resources/Audio의 합성 효과음을 재생한다.
    /// 오디오 믹서는 에디터에서만 만들 수 있어, 음량은 Music/Sfx 두 값으로 직접 곱한다(설정 슬라이더가 여기에 묶인다).
    /// </summary>
    public sealed class Sfx : MonoBehaviour
    {
        static Sfx _inst;
        readonly Dictionary<string, AudioClip> _clips = new Dictionary<string, AudioClip>();
        readonly Dictionary<string, float> _lastAt = new Dictionary<string, float>();
        AudioSource[] _voices;
        AudioSource _music;
        int _next;
        float _musicVol = 0.6f, _sfxVol = 1f;

        public static float MusicVolume
        {
            get { return _inst != null ? _inst._musicVol : 0.6f; }
            set { if (_inst != null) { _inst._musicVol = Mathf.Clamp01(value); _inst._music.volume = _inst._musicVol * 0.45f; } }
        }

        public static float SfxVolume
        {
            get { return _inst != null ? _inst._sfxVol : 1f; }
            set { if (_inst != null) _inst._sfxVol = Mathf.Clamp01(value); }
        }

        public static void Init(Transform parent)
        {
            if (_inst != null) return;
            var go = new GameObject("Sfx");
            go.transform.SetParent(parent, false);
            _inst = go.AddComponent<Sfx>();
            _inst._voices = new AudioSource[8];
            for (int i = 0; i < _inst._voices.Length; i++)
            {
                var a = go.AddComponent<AudioSource>();
                a.playOnAwake = false; a.spatialBlend = 0;
                _inst._voices[i] = a;
            }
            _inst._music = go.AddComponent<AudioSource>();
            _inst._music.playOnAwake = false; _inst._music.loop = true; _inst._music.spatialBlend = 0;
            foreach (var clip in Resources.LoadAll<AudioClip>("Audio")) _inst._clips[clip.name] = clip;
        }

        /// <param name="pitchJitter">반복해 들리는 소리(탭·동전)는 음높이를 조금씩 흔들어 거슬리지 않게 한다.</param>
        public static void Play(string name, float volume = 1f, float pitchJitter = 0f, float minGap = 0.03f)
        {
            if (_inst == null || _inst._sfxVol <= 0.001f) return;
            AudioClip clip;
            if (!_inst._clips.TryGetValue(name, out clip)) return;
            float now = Time.unscaledTime, last;
            if (_inst._lastAt.TryGetValue(name, out last) && now - last < minGap) return;
            _inst._lastAt[name] = now;
            var v = _inst._voices[_inst._next];
            _inst._next = (_inst._next + 1) % _inst._voices.Length;
            v.pitch = 1f + (pitchJitter > 0 ? Random.Range(-pitchJitter, pitchJitter) : 0);
            v.PlayOneShot(clip, volume * _inst._sfxVol);
        }

        public static void PlayMusic()
        {
            if (_inst == null || _inst._music.isPlaying) return;
            AudioClip clip;
            if (!_inst._clips.TryGetValue("bgm", out clip)) return;
            _inst._music.clip = clip;
            _inst._music.volume = _inst._musicVol * 0.45f;
            _inst._music.Play();
        }

        /// <summary>약한 진동(지원 기기). 설정에서 끌 수 있다.</summary>
        public static void Haptic(bool enabled)
        {
#if (UNITY_ANDROID || UNITY_IOS) && !UNITY_EDITOR
            if (enabled) Handheld.Vibrate();
#endif
        }
    }
}
