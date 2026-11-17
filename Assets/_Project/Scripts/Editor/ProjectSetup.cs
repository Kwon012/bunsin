using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Bunsin.EditorTools
{
    /// <summary>
    /// 프로젝트를 처음 열면 한 번 자동으로: 메인 씬 생성, 빌드 목록 등록, 세로 화면·안드로이드 설정.
    /// 다시 하려면 메뉴 Bunsin/프로젝트 설정 적용. 씬 YAML을 손으로 만들지 않는다.
    /// </summary>
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        public const string ScenePath = "Assets/_Project/Scenes/Main.unity";
        const string DoneKey = "Bunsin.ProjectSetup.v1";

        static ProjectSetup()
        {
            EditorApplication.delayCall += () =>
            {
                if (Application.isBatchMode) return;
                if (File.Exists(ScenePath) && SessionState.GetBool(DoneKey, false)) return;
                if (!File.Exists(ScenePath)) Apply();
                SessionState.SetBool(DoneKey, true);
            };
        }

        [MenuItem("Bunsin/프로젝트 설정 적용")]
        public static void Apply()
        {
            EnsureScene();
            ApplyPlayerSettings();
            AssetDatabase.SaveAssets();
            Debug.Log("[Bunsin] 프로젝트 설정 적용 완료: " + ScenePath + " · 세로 화면 · Android(IL2CPP, ARM64)");
        }

        static void EnsureScene()
        {
            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                // 게임은 실행 시 Game이 스스로 카메라·캔버스를 만든다. 씬에는 진입점 하나만 둔다.
                var go = new GameObject("Game");
                go.AddComponent<Bunsin.Presentation.Game>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }

        static void ApplyPlayerSettings()
        {
            PlayerSettings.companyName = "Bunsin";
            PlayerSettings.productName = "분신 키우기";
            if (string.IsNullOrEmpty(PlayerSettings.bundleVersion) || PlayerSettings.bundleVersion == "0.1") PlayerSettings.bundleVersion = "0.2.0";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.runInBackground = false;
            PlayerSettings.SplashScreen.showUnityLogo = false; // Pro 이상에서만 적용, Personal은 무시된다
            PlayerSettings.colorSpace = ColorSpace.Gamma; // 2D 플랫 UI: 팔레트 색 그대로

            var android = NamedBuildTarget.Android;
            // 패키지 이름은 출시 전에 실제 값으로 바꾼다(스토어 등록 후에는 바꿀 수 없다)
            if (PlayerSettings.GetApplicationIdentifier(android).StartsWith("com.DefaultCompany") || string.IsNullOrEmpty(PlayerSettings.GetApplicationIdentifier(android)))
                PlayerSettings.SetApplicationIdentifier(android, "com.bunsin.idle");
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            EditorUserBuildSettings.buildAppBundle = false; // 개발 중에는 APK. 스토어 제출은 AAB로(BuildTools.BuildAndroidBundle)
        }
    }

    /// <summary>
    /// 생성물 가져오기 규칙: 아틀라스는 밉맵 없이 선명하게, 효과음은 메모리에 바로, 배경음은 스트리밍.
    /// </summary>
    public sealed class GeneratedAssetRules : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.Replace('\\', '/').Contains("/Resources/Art/")) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Default;
            ti.alphaIsTransparency = true;
            ti.mipmapEnabled = false;
            ti.wrapMode = TextureWrapMode.Clamp;
            ti.filterMode = FilterMode.Bilinear;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.maxTextureSize = 2048;
            ti.textureCompression = TextureImporterCompression.CompressedHQ;
        }

        void OnPreprocessAudio()
        {
            if (!assetPath.Replace('\\', '/').Contains("/Resources/Audio/")) return;
            var ai = (AudioImporter)assetImporter;
            ai.forceToMono = true;
            var s = ai.defaultSampleSettings;
            bool music = Path.GetFileNameWithoutExtension(assetPath) == "bgm";
            s.loadType = music ? AudioClipLoadType.Streaming : AudioClipLoadType.DecompressOnLoad;
            s.compressionFormat = music ? AudioCompressionFormat.Vorbis : AudioCompressionFormat.ADPCM;
            s.quality = 0.6f;
            ai.defaultSampleSettings = s;
        }
    }
}
