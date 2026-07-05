#include <emscripten.h>
#include <cstdio>
#include "Canvas/Canvas.h"
#include "Canvas/CanvasConfig.h"

namespace C = WorldOfWar::Canvas;
namespace T = WorldOfWar::Types;

// ============================================================================
// 输入状态
// ============================================================================

// 按键状态表：按下为 true，松开为 false，索引为 keyCode
static bool g_keyDown[256] = {};

// 鼠标状态
static int  g_mouseX = 0, g_mouseY = 0;          // 当前光标位置（canvas 坐标）
static bool g_mouseDown[3] = {};                  // 按键状态：[0]=左 [1]=中 [2]=右

// ============================================================================
// 导出函数：玩家输入接口（JS 侧调用）
// ============================================================================
extern "C" {

EMSCRIPTEN_KEEPALIVE
void onKeyEvent(int keyCode, int down) {
    if ((unsigned)keyCode >= 256u) return;
    g_keyDown[keyCode] = (down != 0);
}

EMSCRIPTEN_KEEPALIVE
void onMouseClick(int x, int y) {
    // 点击事件已转发到 C++，具体交互逻辑待迁移 game.js 后实现
    (void)x; (void)y;
}

EMSCRIPTEN_KEEPALIVE
void onMouseMove(int x, int y) {
    g_mouseX = x;
    g_mouseY = y;
}

EMSCRIPTEN_KEEPALIVE
void onMouseButton(int x, int y, int button, int down) {
    if ((unsigned)button >= 3u) return;
    g_mouseDown[button] = (down != 0);
    g_mouseX = x;
    g_mouseY = y;
}

// ============================================================================
// 渲染：JS 侧每帧调用 renderFrame()
// ============================================================================
EMSCRIPTEN_KEEPALIVE
void renderFrame() {
    // 深色背景（待迁移 game.js 的渲染逻辑后丰富）
    C::Clear(T::RGB{12, 12, 26});
}

// ============================================================================
// JS 桥接：帧缓冲指针 + 画布尺寸
// ============================================================================
EMSCRIPTEN_KEEPALIVE
uint8_t* getPixels() { return C::GetPixels(); }

EMSCRIPTEN_KEEPALIVE
int getWidth()  { return C::GetCanvasWidth(); }

EMSCRIPTEN_KEEPALIVE
int getHeight() { return C::GetCanvasHeight(); }

} // extern "C"

// ============================================================================
int main() {
    printf("[C++] 帧缓冲: %dx%d\n", C::GetCanvasWidth(), C::GetCanvasHeight());
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
