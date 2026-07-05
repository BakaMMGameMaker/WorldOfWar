#include <emscripten.h>
#include <cstdio>
#include "Canvas/Canvas.h"
#include "Canvas/CanvasConfig.h"
#include "Input/Keyboard.h"
#include "Input/Mouse.h"

// 导出函数：玩家输入接口（JS 侧调用）
extern "C" {

EMSCRIPTEN_KEEPALIVE
void onKeyEvent(int keyCode, int down) {
    Game::Input::SetKeyState(keyCode, down != 0);
}

EMSCRIPTEN_KEEPALIVE
void onMouseClick(int x, int y) {
    // 点击事件已转发到 C++，具体交互逻辑待迁移 game.js 后实现
    (void)x; (void)y;
}

EMSCRIPTEN_KEEPALIVE
void onMouseMove(int x, int y) {
    Game::Input::SetMousePos(x, y);
}

EMSCRIPTEN_KEEPALIVE
void onMouseButton(int x, int y, int button, int down) {
    Game::Input::SetMouseButton(button, down != 0);
    Game::Input::SetMousePos(x, y);
}

// 渲染：JS 侧每帧调用 renderFrame()
EMSCRIPTEN_KEEPALIVE
void renderFrame() {
    // 深色背景（待迁移 game.js 的渲染逻辑后丰富）
    Game::Canvas::Clear(Game::Types::RGB{12, 12, 26});
}

// JS 桥接：帧缓冲指针 + 画布尺寸
EMSCRIPTEN_KEEPALIVE
uint8_t* getPixels() { return Game::Canvas::GetPixels(); }

EMSCRIPTEN_KEEPALIVE
int getWidth()  { return Game::Canvas::GetCanvasWidth(); }

EMSCRIPTEN_KEEPALIVE
int getHeight() { return Game::Canvas::GetCanvasHeight(); }

} // extern "C"

// ============================================================================
int main() {
    printf("[C++] 帧缓冲: %dx%d\n",
           Game::Canvas::GetCanvasWidth(),
           Game::Canvas::GetCanvasHeight());
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
