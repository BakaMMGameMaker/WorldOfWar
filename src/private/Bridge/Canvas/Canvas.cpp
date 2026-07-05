#include <emscripten.h>
#include <cstdint>
#include "Bridge/Canvas/Canvas.h"
#include "Canvas/Canvas.h"
#include "Canvas/CanvasConfig.h"
#include "Types/RGB.h"

// 渲染 + 帧缓冲桥接：JS → C++ Canvas 模块
extern "C" {

EMSCRIPTEN_KEEPALIVE
void renderFrame() {
    // 深色背景（待迁移 game.js 的渲染逻辑后丰富）
    Game::Canvas::Clear(Game::Types::RGB{12, 12, 26});
}

EMSCRIPTEN_KEEPALIVE
uint8_t* getPixels() { return Game::Canvas::GetPixels(); }

EMSCRIPTEN_KEEPALIVE
int getWidth()  { return Game::Canvas::GetCanvasWidth(); }

EMSCRIPTEN_KEEPALIVE
int getHeight() { return Game::Canvas::GetCanvasHeight(); }

} // extern "C"
