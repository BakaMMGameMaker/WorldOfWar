#include <emscripten.h>
#include "Input/Mouse.h"
#include "Mouse.h"

// 鼠标事件桥接：JS → C++ 输入模块
extern "C" {

EMSCRIPTEN_KEEPALIVE
void onMouseMove(int x, int y) {
    Game::Input::SetMousePos(x, y);
}

EMSCRIPTEN_KEEPALIVE
void onMouseButton(int x, int y, int button, int down) {
    Game::Input::SetMouseButton(button, down != 0);
    Game::Input::SetMousePos(x, y);
}

EMSCRIPTEN_KEEPALIVE
void onMouseClick(int x, int y) {
    // 预留：点击交互逻辑待迁移 game.js 后实现
    (void)x; (void)y;
}

} // extern "C"
