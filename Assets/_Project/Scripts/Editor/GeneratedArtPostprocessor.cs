using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Bunsin.EditorTools
{
    /// <summary>
    /// Blender가 만든 에셋(Assets/_Project/Art/Generated/) 가져오기 규칙.
    /// 색상표 텍스처는 Point·밉맵 없음·무압축, FBX는 1 unit = 1 m · 애니메이션/카메라/조명 없음.
    /// 가져온 뒤에는 GeneratedArtSetup.Apply()로 공용 재질 M_Palette를 연결한다.
    /// </summary>
    public class GeneratedArtPostprocessor : AssetPostprocessor
    {
        internal const string GeneratedFolder = "Assets/_Project/Art/Generated";

        static bool applyQueued;

        // 규칙을 바꾸면 숫자를 올린다 → 해당 에셋이 다시 가져와짐.
        public override uint GetVersion() => 1;

        internal static bool IsGenerated(string path) =>
            path.Replace('\\', '/').StartsWith(GeneratedFolder + "/");

        internal static bool IsPalette(string path) =>
            IsGenerated(path) && System.IO.Path.GetFileName(path).StartsWith("T_Palette");

        void OnPreprocessTexture()
        {
            if (!IsPalette(assetPath)) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Default;
            ti.sRGBTexture = true;
            ti.mipmapEnabled = false;                 // 칸 경계 번짐 방지
            ti.filterMode = FilterMode.Point;
            ti.wrapMode = TextureWrapMode.Clamp;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.alphaSource = TextureImporterAlphaSource.None;
            ti.textureCompression = TextureImporterCompression.Uncompressed;  // 256px라 용량 영향 작음
        }

        void OnPreprocessModel()
        {
            if (!IsGenerated(assetPath)) return;
            var mi = (ModelImporter)assetImporter;
            mi.globalScale = 1f;
            mi.useFileScale = true;
            mi.bakeAxisConversion = true;
            mi.importCameras = false;
            mi.importLights = false;
            mi.importVisibility = false;
            mi.importBlendShapes = false;
            mi.importAnimation = false;
            mi.animationType = ModelImporterAnimationType.None;
            mi.isReadable = false;
            mi.meshCompression = ModelImporterMeshCompression.Off;
            mi.importNormals = ModelImporterNormals.Import;   // Blender의 평면 셰이딩 유지
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            mi.materialLocation = ModelImporterMaterialLocation.InPrefab;
        }

        static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
        {
            if (applyQueued || Application.isBatchMode) return;
            bool touched = imported.Any(p => IsGenerated(p) &&
                (p.EndsWith(".fbx", System.StringComparison.OrdinalIgnoreCase) || IsPalette(p)));
            if (!touched) return;
            applyQueued = true;
            // 가져오기 도중에는 에셋을 만들지 않는다. 가져오기가 끝난 뒤 실행.
            EditorApplication.delayCall += () =>
            {
                applyQueued = false;
                GeneratedArtSetup.Apply();
            };
        }
    }
}
