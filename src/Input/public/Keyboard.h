#pragma once

// Keyboard — 按键状态管理
// g_key_down 在 Input/Keyboard.cpp 匿名 namespace 中

namespace game {
namespace input {

// 查询按键是否按下（keyCode 范围 0–255）
bool is_key_down(int key_code);

// 写入按键状态（JS 桥接调用）
void set_key_state(int key_code, bool down);

} // namespace input
} // namespace game
