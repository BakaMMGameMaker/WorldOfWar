#pragma once

// Keyboard — 按键状态管理
// GKeyDown 在 Input/Keyboard.cpp 匿名 namespace 中，外部不可直接访问

namespace Game {
namespace Input {

// 查询按键是否按下（keyCode 范围 0–255）
bool IsKeyDown(int KeyCode);

// 写入按键状态（JS 桥接调用）
void SetKeyState(int KeyCode, bool Down);

} // namespace Input
} // namespace Game
