#include <emscripten.h>
#include <cstdint>
#include "Canvas/Canvas.h"
#include "Canvas.h"
#include "CanvasConfig.h"

// 渲染 + 帧缓冲桥接：JS → C++ Canvas 模块
extern "C" {

EMSCRIPTEN_KEEPALIVE
void renderFrame() {
    // 深色背景（待迁移 game.js 的渲染逻辑后丰富）
    game::canvas::clear(game::color::rgb{12, 12, 26});
}

EMSCRIPTEN_KEEPALIVE
uint8_t* getPixels() { return game::canvas::get_pixels(); }

EMSCRIPTEN_KEEPALIVE
int getWidth()  { return game::canvas::get_canvas_width(); }

EMSCRIPTEN_KEEPALIVE
int getHeight() { return game::canvas::get_canvas_height(); }

} // extern "C"
