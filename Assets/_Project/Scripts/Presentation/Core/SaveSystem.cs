using System;
using System.IO;
using Bunsin.Sim;
using UnityEngine;

namespace Bunsin.Presentation
{
    /// <summary>
    /// 로컬 저장. persistentDataPath/save.json에 쓰고, 쓰기 전 파일을 save.bak으로 남긴다(깨진 저장 대비).
    /// 클라우드 백업은 아직 없다(계정·서버가 필요한 작업이라 출시 준비 단계에서 붙인다).
    /// </summary>
    public static class SaveSystem
    {
        static string Dir { get { return Application.persistentDataPath; } }
        static string MainPath { get { return Path.Combine(Dir, "save.json"); } }
        static string BackupPath { get { return Path.Combine(Dir, "save.bak"); } }

        public static long NowUnix() { return DateTimeOffset.UtcNow.ToUnixTimeSeconds(); }
        public static string Today() { return DateTime.Now.ToString("yyyy-MM-dd"); }

        public static GameState Load()
        {
            var s = TryRead(MainPath);
            if (s == null) s = TryRead(BackupPath);
            return s;
        }

        static GameState TryRead(string path)
        {
            try
            {
                if (!File.Exists(path)) return null;
                string json = File.ReadAllText(path);
                if (string.IsNullOrEmpty(json)) return null;
                var s = JsonUtility.FromJson<GameState>(json);
                return s != null && s.version > 0 ? s : null;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[Save] 읽기 실패 " + path + ": " + e.Message);
                return null;
            }
        }

        public static bool Save(GameState s)
        {
            try
            {
                s.lastSeenUnix = NowUnix();
                string json = JsonUtility.ToJson(s);
                string tmp = MainPath + ".tmp";
                File.WriteAllText(tmp, json);
                if (File.Exists(MainPath)) File.Copy(MainPath, BackupPath, true);
                if (File.Exists(MainPath)) File.Delete(MainPath);
                File.Move(tmp, MainPath);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[Save] 쓰기 실패: " + e.Message);
                return false;
            }
        }

        public static void Delete()
        {
            try
            {
                if (File.Exists(MainPath)) File.Delete(MainPath);
                if (File.Exists(BackupPath)) File.Delete(BackupPath);
            }
            catch (Exception e) { Debug.LogWarning("[Save] 삭제 실패: " + e.Message); }
        }
    }
}
