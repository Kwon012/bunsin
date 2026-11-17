// 컴파일 검사 전용 가짜 선언(게임에 포함되지 않는다). 실제 타입은 com.unity.inputsystem 패키지에 있다.
namespace UnityEngine.InputSystem.UI
{
    public class InputSystemUIInputModule : UnityEngine.EventSystems.BaseInputModule
    {
        public override void Process() { }
    }
}
namespace UnityEngine.InputSystem
{
    namespace Controls { public class KeyControl { public bool wasPressedThisFrame { get { return false; } } } }
    public class Keyboard
    {
        public static Keyboard current { get { return null; } }
        public Controls.KeyControl escapeKey { get { return null; } }
    }
}
