#pragma once

// Mouse — 鼠标状态管理
// GMouseX/Y、GMouseDown 在 Input/Mouse.cpp 匿名 namespace 中

namespace Game {
namespace Input {

// 光标位置
int GetMouseX();
int GetMouseY();

// 鼠标按键状态（button: 0=左 1=中 2=右）
bool IsMouseDown(int Button);

// 写入接口（JS 桥接调用）
void SetMousePos(int X, int Y);
void SetMouseButton(int Button, bool Down);

} // namespace Input
} // namespace Game
