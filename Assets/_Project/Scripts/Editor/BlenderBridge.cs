using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Bunsin.EditorTools
{
    /// <summary>
    /// Unity → Blender 연결. Blender를 백그라운드(-b)로 실행해 Tools/Blender/build_poc.py를 돌리고,
    /// 끝나면 에셋을 새로 고쳐 공용 재질을 연결한다.
    /// 메뉴: Bunsin/Art/…  ·  배치/CLI: BlenderBridge.BuildSync(false), BlenderBridge.BuildBatch
    /// </summary>
    public static class BlenderBridge
    {
        const string PrefKey = "Bunsin.BlenderPath";
        const string ScriptRelPath = "Tools/Blender/build_poc.py";

        static Process running;
        static int progressId = -1;
        static DateTime startedAt;
        static readonly ConcurrentQueue<string> pending = new ConcurrentQueue<string>();
        static readonly Queue<string> tail = new Queue<string>();

        static string ProjectRoot => Path.GetDirectoryName(Application.dataPath);

        [MenuItem("Bunsin/Art/Blender로 에셋 다시 생성")]
        static void BuildMenu() => StartAsync(render: false);

        [MenuItem("Bunsin/Art/Blender로 에셋 생성 + 미리보기 렌더 (수 분)")]
        static void BuildRenderMenu() => StartAsync(render: true);

        [MenuItem("Bunsin/Art/Blender 경로 설정…")]
        static void SetPathMenu() => PromptForBlender(out _);

        [MenuItem("Bunsin/Art/Blender 경로 확인")]
        static void ShowPathMenu() =>
            Debug.Log($"[Blender] 사용할 경로: {ResolveBlenderPath() ?? "(없음 — 'Blender 경로 설정…'에서 지정)"}");

        // ------------------------------------------------------------ 경로

        /// <summary>EditorPrefs → 환경 변수 BLENDER → OS 기본 설치 위치 순으로 찾는다.</summary>
        public static string ResolveBlenderPath()
        {
            var p = EditorPrefs.GetString(PrefKey, "");
            if (File.Exists(p)) return p;

            p = Environment.GetEnvironmentVariable("BLENDER");
            if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;

            switch (Application.platform)
            {
                case RuntimePlatform.WindowsEditor:
                    foreach (var root in new[]
                             {
                                 Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                                 @"C:\Program Files",
                             }.Distinct())
                    {
                        var foundation = Path.Combine(root, "Blender Foundation");
                        if (!Directory.Exists(foundation)) continue;
                        var exe = Directory.GetDirectories(foundation)
                            .Select(d => Path.Combine(d, "blender.exe"))
                            .Where(File.Exists)
                            .OrderByDescending(x => x, StringComparer.OrdinalIgnoreCase)
                            .FirstOrDefault();
                        if (exe != null) return exe;
                    }
                    break;
                case RuntimePlatform.OSXEditor:
                    const string mac = "/Applications/Blender.app/Contents/MacOS/Blender";
                    if (File.Exists(mac)) return mac;
                    break;
                default:
                    foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
                    {
                        var exe = Path.Combine(dir, "blender");
                        if (File.Exists(exe)) return exe;
                    }
                    break;
            }
            return null;
        }

        static bool PromptForBlender(out string path)
        {
            var ext = Application.platform == RuntimePlatform.WindowsEditor ? "exe" : "";
            path = EditorUtility.OpenFilePanel("Blender 실행 파일 선택", "", ext);
            if (string.IsNullOrEmpty(path)) return false;
            if (Application.platform == RuntimePlatform.OSXEditor && path.EndsWith(".app"))
                path = Path.Combine(path, "Contents/MacOS/Blender");
            EditorPrefs.SetString(PrefKey, path);
            Debug.Log($"[Blender] 경로 저장: {path}");
            return true;
        }

        static ProcessStartInfo MakeStartInfo(string blender, bool render)
        {
            var script = Path.Combine(ProjectRoot, ScriptRelPath);
            var extra = render ? "" : " --no-render";
            // --python-exit-code 1: 파이썬 오류 시 0이 아닌 종료 코드 (기본은 0으로 끝남)
            return new ProcessStartInfo(blender,
                $"-b --factory-startup --python-exit-code 1 -P \"{script}\" --{extra}")
            {
                WorkingDirectory = ProjectRoot,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
        }

        static bool Prepare(out string blender)
        {
            blender = ResolveBlenderPath();
            if (blender == null && !Application.isBatchMode && !PromptForBlender(out blender)) return false;
            if (blender == null)
            {
                Debug.LogError("[Blender] 실행 파일을 찾지 못했습니다. 환경 변수 BLENDER를 지정하세요.");
                return false;
            }
            if (!File.Exists(Path.Combine(ProjectRoot, ScriptRelPath)))
            {
                Debug.LogError($"[Blender] 스크립트가 없습니다: {ScriptRelPath}");
                return false;
            }
            return true;
        }

        // ------------------------------------------------------------ 비동기 (메뉴)

        static void StartAsync(bool render)
        {
            if (running != null && !running.HasExited)
            {
                Debug.LogWarning("[Blender] 이미 실행 중입니다.");
                return;
            }
            if (!Prepare(out var blender)) return;

            var p = new Process { StartInfo = MakeStartInfo(blender, render), EnableRaisingEvents = true };
            p.OutputDataReceived += (_, e) => { if (e.Data != null) pending.Enqueue(e.Data); };
            p.ErrorDataReceived += (_, e) => { if (e.Data != null) pending.Enqueue("ERR " + e.Data); };
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();

            running = p;
            startedAt = DateTime.Now;
            tail.Clear();
            progressId = Progress.Start("Blender", render ? "에셋 생성 + 미리보기 렌더" : "에셋 생성",
                Progress.Options.Indefinite);
            Progress.RegisterCancelCallback(progressId, () =>
            {
                try { if (running != null && !running.HasExited) running.Kill(); } catch (InvalidOperationException) { }
                return true;
            });
            EditorApplication.update += Poll;
            Debug.Log($"[Blender] 시작: {blender}");
        }

        static void Drain()
        {
            while (pending.TryDequeue(out var line))
            {
                tail.Enqueue(line);
                if (tail.Count > 60) tail.Dequeue();
                if (line.StartsWith("[model]") || line.StartsWith("[render]")) Debug.Log("[Blender] " + line);
            }
        }

        // 스크립트 재컴파일(도메인 리로드)이 일어나면 이 감시는 끊긴다. 그때는 끝난 뒤 'Assets > Refresh'.
        static void Poll()
        {
            Drain();
            if (running == null || !running.HasExited) return;

            running.WaitForExit();   // 비동기 출력까지 모두 받기
            Drain();
            int code = running.ExitCode;
            running.Dispose();
            running = null;
            EditorApplication.update -= Poll;

            var secs = (DateTime.Now - startedAt).TotalSeconds;
            if (code == 0)
            {
                AssetDatabase.Refresh();
                int n = GeneratedArtSetup.Apply();
                if (Progress.Exists(progressId)) Progress.Finish(progressId, Progress.Status.Succeeded);
                Debug.Log($"[Blender] 완료 {secs:F1}s · 재질 연결 {n}개 갱신");
            }
            else
            {
                if (Progress.Exists(progressId)) Progress.Finish(progressId, Progress.Status.Failed);
                Debug.LogError($"[Blender] 실패 (exit {code}, {secs:F1}s)\n" + string.Join("\n", tail));
            }
        }

        // ------------------------------------------------------------ 동기 (CLI·배치)

        /// <summary>Blender를 실행하고 끝날 때까지 기다린다. 종료 코드를 돌려준다.
        /// 예: unity command script eval 'Bunsin.EditorTools.BlenderBridge.BuildSync(false)'</summary>
        public static int BuildSync(bool render)
        {
            if (!Prepare(out var blender)) return 4;
            using (var p = Process.Start(MakeStartInfo(blender, render)))
            {
                var errTask = p.StandardError.ReadToEndAsync();
                var output = p.StandardOutput.ReadToEnd();
                p.WaitForExit();
                foreach (var line in output.Split('\n').Where(l => l.StartsWith("[model]") || l.StartsWith("[render]")))
                    Debug.Log("[Blender] " + line.TrimEnd());
                if (p.ExitCode != 0)
                {
                    Debug.LogError($"[Blender] 실패 (exit {p.ExitCode})\n{errTask.Result}\n{LastLines(output, 40)}");
                    return p.ExitCode;
                }
            }
            AssetDatabase.Refresh();
            GeneratedArtSetup.Apply();
            return 0;
        }

        /// <summary>-executeMethod Bunsin.EditorTools.BlenderBridge.BuildBatch (에디터가 닫혀 있을 때)</summary>
        public static void BuildBatch()
        {
            int code = BuildSync(render: Environment.GetCommandLineArgs().Contains("--render"));
            if (Application.isBatchMode) EditorApplication.Exit(code);
        }

        static string LastLines(string text, int n) =>
            string.Join("\n", text.Split('\n').Reverse().Take(n).Reverse());
    }
}
