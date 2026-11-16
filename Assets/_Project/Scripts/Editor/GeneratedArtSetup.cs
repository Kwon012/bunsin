using System.IO;
using UnityEditor;
using UnityEngine;

namespace Bunsin.EditorTools
{
    /// <summary>
    /// 공용 재질 M_Palette(색상표 아틀라스 1장)를 만들고, Generated 폴더의 모든 FBX에 연결한다.
    /// 기획서 §16: 색상표 아틀라스 1장 + SRP Batcher + GPU 인스턴싱.
    /// </summary>
    public static class GeneratedArtSetup
    {
        public const string MaterialPath = "Assets/_Project/Art/Materials/M_Palette.mat";
        const string SourceMaterialName = "M_Palette";   // Blender 쪽 재질 이름

        [MenuItem("Bunsin/Art/생성 에셋에 공용 재질 적용")]
        public static void ApplyMenu() => Debug.Log($"[Art] 재질 연결 {Apply()}개 갱신");

        /// <returns>재질 연결을 새로 바꾼 FBX 수</returns>
        public static int Apply()
        {
            if (!AssetDatabase.IsValidFolder(GeneratedArtPostprocessor.GeneratedFolder)) return 0;
            var mat = EnsureMaterial();
            if (mat == null) return 0;

            var id = new AssetImporter.SourceAssetIdentifier(typeof(Material), SourceMaterialName);
            int changed = 0;
            AssetDatabase.StartAssetEditing();
            try
            {
                foreach (var guid in AssetDatabase.FindAssets("t:Model", new[] { GeneratedArtPostprocessor.GeneratedFolder }))
                {
                    var path = AssetDatabase.GUIDToAssetPath(guid);
                    if (!(AssetImporter.GetAtPath(path) is ModelImporter mi)) continue;
                    if (mi.GetExternalObjectMap().TryGetValue(id, out var cur) && cur == mat) continue;
                    mi.AddRemap(id, mat);
                    mi.SaveAndReimport();
                    changed++;
                }
            }
            finally
            {
                AssetDatabase.StopAssetEditing();
            }
            return changed;
        }

        static Texture2D FindPalette()
        {
            foreach (var guid in AssetDatabase.FindAssets("T_Palette t:Texture2D", new[] { GeneratedArtPostprocessor.GeneratedFolder }))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (GeneratedArtPostprocessor.IsPalette(path)) return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            }
            return null;
        }

        static Material EnsureMaterial()
        {
            var tex = FindPalette();
            if (tex == null)
            {
                Debug.LogWarning("[Art] Generated 폴더에서 T_Palette를 찾지 못했습니다. Blender 생성부터 실행하세요.");
                return null;
            }
            var mat = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (mat == null)
            {
                var shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null)
                {
                    shader = Shader.Find("Standard");
                    Debug.LogWarning("[Art] URP가 없어 Standard 셰이더로 만듭니다. URP 설치 후 M_Palette를 지우고 다시 실행하세요.");
                }
                EnsureFolder(Path.GetDirectoryName(MaterialPath).Replace('\\', '/'));
                mat = new Material(shader) { name = "M_Palette", enableInstancing = true };
                AssetDatabase.CreateAsset(mat, MaterialPath);
            }
            if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", tex);
            if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", tex);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", 0.15f);
            if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", 0.15f);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", 0f);
            EditorUtility.SetDirty(mat);
            AssetDatabase.SaveAssets();
            return mat;
        }

        static void EnsureFolder(string folder)
        {
            if (AssetDatabase.IsValidFolder(folder)) return;
            var parent = Path.GetDirectoryName(folder).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(folder));
        }
    }
}
