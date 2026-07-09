#pragma once

// Mouse — 鼠标状态管理
// g_mouse_x/y、g_mouse_down 在 Input/Mouse.cpp 匿名 namespace 中

namespace game {
namespace input {

// 光标位置
int get_mouse_x();
int get_mouse_y();

// 鼠标按键状态（button: 0=左 1=中 2=右）
bool is_mouse_down(int button);

// 写入接口（JS 桥接调用）
void set_mouse_pos(int x, int y);
void set_mouse_button(int button, bool down);

} // namespace input
} // namespace game
