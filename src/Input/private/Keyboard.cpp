#include "Keyboard.h"

namespace {

// 按键状态表：按下为 true，松开为 false，索引为 keyCode
bool GKeyDown[256] = {};

} // namespace

namespace Game {
namespace Input {

bool IsKeyDown(const int KeyCode) {
    if ((unsigned)KeyCode >= 256u) return false;
    return GKeyDown[KeyCode];
}

void SetKeyState(const int KeyCode, const bool Down) {
    if ((unsigned)KeyCode >= 256u) return;
    GKeyDown[KeyCode] = Down;
}

} // namespace Input
} // namespace Game
