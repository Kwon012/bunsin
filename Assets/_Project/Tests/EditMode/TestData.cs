using System;
using System.IO;
using Bunsin.Sim;

namespace Bunsin.Sim.Tests
{
    /// <summary>테스트용 데이터 로더. Unity(프로젝트 루트)와 dotnet test(bin 폴더) 양쪽에서 CSV 폴더를 찾는다.</summary>
    public static class TestData
    {
        static GameData _cache;

        public static string DataDir()
        {
            var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
            while (dir != null)
            {
                string p = Path.Combine(dir.FullName, "Assets", "_Project", "Resources", "Data");
                if (Directory.Exists(p)) return p;
                dir = dir.Parent;
            }
            throw new DirectoryNotFoundException("Assets/_Project/Resources/Data 폴더를 찾지 못함");
        }

        public static GameData Load()
        {
            if (_cache != null) return _cache;
            string dir = DataDir();
            _cache = GameData.Load(name => File.ReadAllText(Path.Combine(dir, name + ".csv")));
            return _cache;
        }

        public static GameSim NewSim(long seed = 7)
        {
            var d = Load();
            return new GameSim(d, GameSim.NewGame(d, seed));
        }
    }
}
