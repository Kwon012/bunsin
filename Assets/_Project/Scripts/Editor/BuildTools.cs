using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Bunsin.EditorTools
{
    /// <summary>
    /// 빌드 진입점. 에디터 메뉴나 명령줄에서 같은 함수를 쓴다.
    ///   unity build . --target Android --execute-method Bunsin.EditorTools.BuildTools.BuildAndroid
    /// 결과: Builds/Android/bunsin.apk (또는 .aab)
    /// </summary>
    public static class BuildTools
    {
        [MenuItem("Bunsin/빌드/Android APK (개발)")]
        public static void BuildAndroid() { Build(false, true); }

        [MenuItem("Bunsin/빌드/Android AAB (스토어 제출)")]
        public static void BuildAndroidBundle() { Build(true, false); }

        static void Build(bool bundle, bool development)
        {
            ProjectSetup.Apply();
            EditorUserBuildSettings.buildAppBundle = bundle;
            string dir = Path.Combine("Builds", "Android");
            Directory.CreateDirectory(dir);
            string path = Path.Combine(dir, bundle ? "bunsin.aab" : "bunsin.apk");
            var opts = new BuildPlayerOptions
            {
                scenes = new[] { ProjectSetup.ScenePath },
                locationPathName = path,
                target = BuildTarget.Android,
                options = development ? BuildOptions.Development : BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(opts);
            var sum = report.summary;
            Debug.Log("[Bunsin] 빌드 " + sum.result + " · " + path + " · " + (sum.totalSize / 1024 / 1024) + "MB · " + sum.totalTime);
            if (Application.isBatchMode && sum.result != BuildResult.Succeeded) EditorApplication.Exit(1);
        }
    }
}
