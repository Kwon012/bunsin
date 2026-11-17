using System;
using System.Collections.Generic;
using Bunsin.Sim;
using UnityEngine;
using UnityEngine.EventSystems;
using UButton = UnityEngine.UI.Button;
using UImage = UnityEngine.UI.Image;
using UText = UnityEngine.UI.Text;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 게임 진입점. 씬에 아무것도 없어도 스스로 카메라·캔버스·화면을 만든다(에디터 YAML을 손으로 고칠 일이 없게).
    /// 규칙은 GameSim(순수 C#)이 갖고, 여기서는 시간 흐름·저장·연출·화면 전환만 맡는다.
    /// </summary>
    public sealed partial class Game : MonoBehaviour
    {
        public static Game I { get; private set; }

        public GameData Data;
        public GameSim Sim;
        public GameState S { get { return Sim.S; } }

        /// <summary>광고·결제 서비스. 출시 전 실제 SDK 구현으로 바꾼다.</summary>
        public IAdService Ads = new MockAdService();
        public IIapService Iap = new MockIapService();

        public RectTransform CanvasRt, Safe, ScreenHost, FxLayer, MomentLayer, BubbleLayer, TutorialLayer, PopupLayer, ToastLayer;
        public Fx Fx;
        public Popups Popups;
        Canvas _canvas;
        UnityEngine.UI.CanvasScaler _scaler;
        Camera _cam;

        ScreenBase[] _screens;
        public int CurrentTab { get; private set; }
        float _refreshT, _saveT;
        double _sessionStartEarned;
        bool _started, _paused;
        string _bootError;

        public const int TabHome = 0, TabVillage = 1, TabClones = 2, TabAssets = 3, TabShop = 4;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<Game>() != null) return;
            new GameObject("Game").AddComponent<Game>();
        }

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            Application.targetFrameRate = 60;
            Screen.orientation = ScreenOrientation.Portrait;
            Art.Load();
            Ui.Init();
            BuildRoot();
            Sfx.Init(transform);
            try
            {
                Data = GameData.Load(name =>
                {
                    var ta = Resources.Load<TextAsset>("Data/" + name);
                    if (ta == null) throw new Exception("Resources/Data/" + name + ".csv 없음");
                    return ta.text;
                });
            }
            catch (Exception e)
            {
                _bootError = e.Message;
                Debug.LogError("[Game] 데이터 불러오기 실패: " + e);
                ShowFatal("데이터를 불러오지 못했어요\n" + e.Message);
                return;
            }

            var state = SaveSystem.Load();
            if (state == null) state = GameSim.NewGame(Data, DateTime.UtcNow.Ticks);
            Sim = new GameSim(Data, state);
            Sim.LocalHour = DateTime.Now.Hour;
            Ui.TextScale = S.bigText ? 1.15f : 1f;
            Sfx.MusicVolume = S.musicVol;
            Sfx.SfxVolume = S.sfxVol;
        }

        void Start()
        {
            if (_bootError != null) return;
            BuildUi();
            Sfx.PlayMusic();
            if (!S.introDone) ShowIntro();
            else BeginSession(true);
            _started = true;
        }

        // ------------------------------------------------------------------ 뼈대

        void BuildRoot()
        {
            _cam = new GameObject("Camera").AddComponent<Camera>();
            _cam.transform.SetParent(transform, false);
            _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.backgroundColor = Palette.Paper;
            _cam.orthographic = true;
            _cam.cullingMask = 0; // UI는 오버레이 캔버스가 그린다. 카메라는 배경색만 칠한다

            var cgo = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(UnityEngine.UI.CanvasScaler), typeof(UnityEngine.UI.GraphicRaycaster));
            cgo.layer = 5;
            cgo.transform.SetParent(transform, false);
            _canvas = cgo.GetComponent<Canvas>();
            _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            _canvas.pixelPerfect = false;
            _scaler = cgo.GetComponent<UnityEngine.UI.CanvasScaler>();
            _scaler.uiScaleMode = UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;
            _scaler.referenceResolution = new Vector2(1080, 1920);
            _scaler.screenMatchMode = UnityEngine.UI.CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            UpdateScalerMatch();
            CanvasRt = (RectTransform)cgo.transform;

            if (FindAnyObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem));
                es.transform.SetParent(transform, false);
#if ENABLE_INPUT_SYSTEM && BUNSIN_INPUT_SYSTEM
                es.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
            }

            var bg = Ui.Box(CanvasRt, Palette.Paper, "Background");
            bg.Rt().Fill();
            Safe = Ui.Node("Safe", CanvasRt);
            Safe.Fill();
            Safe.gameObject.AddComponent<SafeArea>();
            ScreenHost = Ui.Node("Screens", Safe);
            ScreenHost.Fill(0, Layout.TabBarH, 0, Layout.HudH + Layout.GoalH + 24);
            BubbleLayer = Ui.Node("Bubbles", Safe); BubbleLayer.Fill();
            FxLayer = Ui.Node("Fx", CanvasRt); FxLayer.Fill();
            Fx = Fx.Create(FxLayer);
            MomentLayer = Ui.Node("Moments", CanvasRt); MomentLayer.Fill();
            PopupLayer = Ui.Node("Popups", CanvasRt); PopupLayer.Fill();
            TutorialLayer = Ui.Node("Tutorial", CanvasRt); TutorialLayer.Fill();
            ToastLayer = Ui.Node("Toasts", Safe); ToastLayer.Fill();
            Popups = Popups.Create(PopupLayer, ToastLayer);
        }

        void UpdateScalerMatch()
        {
            // 길쭉한 폰은 가로 기준(세로 공간이 늘어난다), 태블릿처럼 뭉툭한 화면은 세로 기준
            float aspect = Screen.width > 0 ? (float)Screen.height / Screen.width : 1.78f;
            _scaler.matchWidthOrHeight = aspect >= 1.7f ? 0f : 1f;
        }

        void BuildUi()
        {
            BuildHud();
            BuildTabBar();
            _screens = new ScreenBase[]
            {
                new HomeScreen(), new VillageScreen(), new ClonesScreen(), new AssetsScreen(), new ShopScreen(),
            };
            for (int i = 0; i < _screens.Length; i++)
            {
                _screens[i].Init(this, ScreenHost);
                _screens[i].Root.gameObject.SetActive(false);
            }
            BuildBubble();
            BuildTutorial();
            int tab = Mathf.Clamp(S.lastTab, 0, _screens.Length - 1);
            ShowTab(TabUnlocked(tab) ? tab : TabHome, false);
        }

        /// <summary>큰 글씨 설정처럼 글자 크기가 바뀌면 화면을 다시 만든다.</summary>
        public void RebuildAll()
        {
            Ui.TextScale = S.bigText ? 1.15f : 1f;
            foreach (var s in _screens) s.Destroy();
            Ui.Clear(_hudRoot); Destroy(_hudRoot.gameObject);
            Ui.Clear(_tabRoot); Destroy(_tabRoot.gameObject);
            Destroy(_bubbleRoot.gameObject);
            Destroy(_finger.gameObject);
            BuildUi();
        }

        void ShowFatal(string text)
        {
            var t = Ui.Label(CanvasRt, text, 40, Palette.Ink);
            t.Rt().Fill(60, 60, 60, 60);
        }

        // ------------------------------------------------------------------ 탭

        public bool TabUnlocked(int tab)
        {
            if (Sim == null) return tab == TabHome;
            switch (tab)
            {
                case TabHome: return true;
                case TabVillage: return Sim.Has(Layer.Village);
                case TabClones: return Sim.Has(Layer.Train) || Sim.Has(Layer.Village);
                case TabAssets: return Sim.Has(Layer.Deposit);
                case TabShop: return S.paydaysTotal >= 1;
            }
            return false;
        }

        public void ShowTab(int tab, bool sound = true)
        {
            if (!TabUnlocked(tab)) { Popups.Toast("아직 열리지 않았어요", "i_lock"); return; }
            if (_screens == null) return;
            for (int i = 0; i < _screens.Length; i++)
            {
                bool on = i == tab;
                if (_screens[i].Root.gameObject.activeSelf != on)
                {
                    _screens[i].Root.gameObject.SetActive(on);
                    if (on) _screens[i].OnShow();
                }
            }
            if (sound && CurrentTab != tab) Sfx.Play("click", 0.6f);
            CurrentTab = tab;
            S.lastTab = tab;
            var g = _screens[tab].Root.GetComponent<CanvasGroup>();
            if (g != null && sound) Tweens.Fade(g, 0.3f, 1, 0.18f);
            RefreshTabs();
        }

        public T GetScreen<T>() where T : ScreenBase
        {
            foreach (var s in _screens) if (s is T) return (T)s;
            return null;
        }

        // ------------------------------------------------------------------ 시간

        void Update()
        {
            if (_bootError != null || !_started) return;
            float dt = Mathf.Min(Time.unscaledDeltaTime, 1f);
            if (Screen.width > 0) UpdateScalerMatch();
            Sim.LocalHour = DateTime.Now.Hour;
            if (S.introDone) Sim.Tick(dt);
            ProcessEvents();
            UpdateHud(dt);
            GetScreen<HomeScreen>().Tick(dt);
            UpdateBubble();
            UpdateTutorial();

            _refreshT += dt;
            if (_refreshT >= 0.2f)
            {
                _refreshT = 0;
                _screens[CurrentTab].Refresh();
                RefreshTabs();
            }
            _saveT += dt;
            if (_saveT >= 15f) { _saveT = 0; Save(); }

            if (BackPressed()) OnBack();
        }

        static bool BackPressed()
        {
#if ENABLE_INPUT_SYSTEM && BUNSIN_INPUT_SYSTEM
            var kb = UnityEngine.InputSystem.Keyboard.current;
            return kb != null && kb.escapeKey.wasPressedThisFrame;
#else
            return Input.GetKeyDown(KeyCode.Escape);
#endif
        }

        void OnBack()
        {
            if (Popups.Back()) return;
            if (CurrentTab != TabHome) { ShowTab(TabHome); return; }
            Popups.Enqueue(f =>
            {
                f.Title("오늘은 여기까지?", "i_clock");
                f.Text("앱을 꺼도 분신들은 일합니다.\n다음 월급날까지 " + NumberFormat.Duration(S.paydayTimer));
                f.Button("계속하기", Palette.White, null);
                f.Button("종료", Palette.Yellow, () => { Save(); Application.Quit(); });
            });
        }

        public void Save()
        {
            if (Sim == null) return;
            S.musicVol = Sfx.MusicVolume;
            S.sfxVol = Sfx.SfxVolume;
            SaveSystem.Save(S);
        }

        void OnApplicationPause(bool pause)
        {
            if (Sim == null || !_started) return;
            if (pause)
            {
                _paused = true;
                Save();
            }
            else if (_paused)
            {
                _paused = false;
                BeginSession(false);
            }
        }

        void OnApplicationQuit() { Save(); }

        /// <summary>앱 시작·복귀: 오프라인 정산 → 정산서 → 출근 도장.</summary>
        void BeginSession(bool coldStart)
        {
            long now = SaveSystem.NowUnix();
            long away = S.lastSeenUnix > 0 ? now - S.lastSeenUnix : 0;
            if (away < 0) away = 0; // 기기 시각을 되돌린 경우: 정산 없음
            if (away > 0) Sim.ApplyOffline(away);
            Sim.StartSession();
            _sessionStartEarned = S.totalEarned;
            if (S.hasPendingOffline) GamePopups.Offline(this);
            if (Sim.TryStamp(SaveSystem.Today())) { }
            S.lastSeenUnix = now;
            if (coldStart && Sim.HasPendingPayday) GamePopups.Payday(this);
        }

        public double SessionEarned { get { return S.totalEarned - _sessionStartEarned; } }

        void ShowIntro()
        {
            GamePopups.ShowIntroCut(this, 0, () =>
            {
                S.introDone = true;
                S.tutorialStep = 0;
                BeginSession(true);
                Save();
            });
        }

        /// <summary>설정의 '처음부터': 저장을 지우고 새 게임을 시작한다.</summary>
        public void ResetGame()
        {
            SaveSystem.Delete();
            Sim = new GameSim(Data, GameSim.NewGame(Data, DateTime.UtcNow.Ticks));
            _maxSlotSeen = -1;
            _paydayQueued = false;
            RebuildAll();
            ShowIntro();
        }

        // ------------------------------------------------------------------ 공용 행동

        /// <summary>추천·목표 바·매니저 화면이 공통으로 쓰는 실행. 실패하면 이유를 알려 준다.</summary>
        public bool Do(SimAction a, Vector2? from = null)
        {
            if (!a.Valid) return false;
            if (a.Cost > S.money)
            {
                if (a.Cost <= S.money + S.deposit && Sim.Has(Layer.Deposit))
                {
                    Popups.Enqueue(f =>
                    {
                        f.Title("예금을 깨서 살까요?", "i_piggy");
                        f.Text(a.Label + "\n" + NumberFormat.Won(a.Cost));
                        f.Text("예금 " + NumberFormat.Won(S.deposit) + "을 전부 현금으로 바꿔요.", 30, Palette.InkSoft);
                        f.Button("그만두기", Palette.White, null);
                        f.Button("깨서 사기", Palette.Yellow, () => { Sim.WithdrawAll(); Sfx.Play("coin"); Do(a, from); });
                    }, true);
                    return false;
                }
                Sfx.Play("deny", 0.6f);
                Popups.Toast(NumberFormat.Duration(Sim.SecondsUntil(a.Cost)) + " 뒤에 살 수 있어요", "i_clock");
                return false;
            }
            bool ok = Sim.Execute(a);
            if (ok) Sfx.Play("buy", 0.8f, 0.04f);
            else Sfx.Play("deny", 0.6f);
            return ok;
        }

        public void Deny(string reason)
        {
            Sfx.Play("deny", 0.6f);
            Popups.Toast(reason, "i_alert");
        }

        public string JobLine(CloneState c)
        {
            return c.slot > 0 ? Sim.Job(c.slot).Name : "대기실";
        }
    }

    /// <summary>화면 배치 상수(기준 해상도 1080×1920).</summary>
    public static class Layout
    {
        public const float HudH = 214, GoalH = 112, TabBarH = 176;
    }
}
