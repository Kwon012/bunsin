using System;

namespace Bunsin.Sim
{
    /// <summary>
    /// 시드 고정 난수(xorshift64*). 상태를 저장에 넣어 재현 가능하게 한다.
    /// 확률 상품이 없으므로 난수는 '어떤 대사·사건을 고를지'에만 쓴다(보상 크기에는 쓰지 않는다).
    /// </summary>
    public static class Rng
    {
        public static ulong Next(ref long state)
        {
            ulong x = (ulong)state;
            if (x == 0) x = 0x9E3779B97F4A7C15UL;
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            state = (long)x;
            return x * 0x2545F4914F6CDD1DUL;
        }

        /// <summary>0 이상 max 미만 정수.</summary>
        public static int Range(ref long state, int max)
        {
            if (max <= 1) return 0;
            return (int)(Next(ref state) % (ulong)max);
        }

        public static double Unit(ref long state)
        {
            return (Next(ref state) >> 11) * (1.0 / 9007199254740992.0);
        }
    }
}
