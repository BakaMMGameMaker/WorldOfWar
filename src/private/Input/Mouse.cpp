#include "Input/Mouse.h"

namespace {

// 鼠标状态
int  GMouseX = 0, GMouseY = 0;     // 当前光标位置（canvas 坐标）
bool GMouseDown[3] = {};            // 按键状态：[0]=左 [1]=中 [2]=右

} // namespace

namespace Game {
namespace Input {

int GetMouseX() { return GMouseX; }
int GetMouseY() { return GMouseY; }

bool IsMouseDown(const int Button) {
    if ((unsigned)Button >= 3u) return false;
    return GMouseDown[Button];
}

void SetMousePos(const int X, const int Y) {
    GMouseX = X;
    GMouseY = Y;
}

void SetMouseButton(const int Button, const bool Down) {
    if ((unsigned)Button >= 3u) return;
    GMouseDown[Button] = Down;
}

} // namespace Input
} // namespace Game
