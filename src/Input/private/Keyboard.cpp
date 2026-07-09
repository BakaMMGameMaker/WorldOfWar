#include "Keyboard.h"

namespace {

// 按键状态表：按下为 true，松开为 false，索引为 key_code
bool g_key_down[256] = {};

} // namespace

namespace game {
namespace input {

bool is_key_down(int key_code) {
    if (static_cast<unsigned>(key_code) >= 256u) return false;
    return g_key_down[key_code];
}

void set_key_state(int key_code, bool down) {
    if (static_cast<unsigned>(key_code) >= 256u) return;
    g_key_down[key_code] = down;
}

} // namespace input
} // namespace game
