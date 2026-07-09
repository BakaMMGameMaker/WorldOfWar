#include "Mouse.h"

namespace {

// 鼠标状态
int  g_mouse_x = 0, g_mouse_y = 0;     // 当前光标位置（canvas 坐标）
bool g_mouse_down[3] = {};            // 按键状态：[0]=左 [1]=中 [2]=右

} // namespace

namespace game {
namespace input {

int get_mouse_x() { return g_mouse_x; }
int get_mouse_y() { return g_mouse_y; }

bool is_mouse_down(int button) {
    if (static_cast<unsigned>(button) >= 3u) return false;
    return g_mouse_down[button];
}

void set_mouse_pos(int x, int y) {
    g_mouse_x = x;
    g_mouse_y = y;
}

void set_mouse_button(int button, bool down) {
    if (static_cast<unsigned>(button) >= 3u) return;
    g_mouse_down[button] = down;
}

} // namespace input
} // namespace game
