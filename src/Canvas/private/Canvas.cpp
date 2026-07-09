#include "Canvas.h"
#include "CanvasConfig.h"
#include <cstdint>

namespace game {
namespace canvas {

namespace {

// 帧缓冲（CPU 端 RGBA 像素数组，JS 侧通过 HEAPU8 零拷贝读取）
std::uint32_t g_frame[game::canvas::get_canvas_width() *
                      game::canvas::get_canvas_height()];

} // namespace

uint8_t* get_pixels() {
    return reinterpret_cast<uint8_t*>(g_frame);
}

void clear(color::rgb rgb) {
    constexpr int W = get_canvas_width();
    constexpr int H = get_canvas_height();
    std::uint32_t c = (255u << 24) | (static_cast<std::uint32_t>(rgb.b) << 16) | (static_cast<std::uint32_t>(rgb.g) << 8) | rgb.r;
    for (int i = 0; i < W * H; ++i)
    {
        g_frame[i] = c;
    }
}

void set_pixels(int x, int y, color::rgb rgb) {
    constexpr int W = get_canvas_width();
    constexpr int H = get_canvas_height();
    if (static_cast<unsigned>(x) >= static_cast<unsigned>(W) || static_cast<unsigned>(y) >= static_cast<unsigned>(H)) return;
    g_frame[y * W + x] = (255u << 24) | (static_cast<std::uint32_t>(rgb.b) << 16) | (static_cast<std::uint32_t>(rgb.g) << 8) | rgb.r;
}

void fill_rect(int x, int y, int w, int h, color::rgb rgb) {
    constexpr int CW = get_canvas_width();
    constexpr int CH = get_canvas_height();
    int x0 = x < 0 ? 0 : x;
    int y0 = y < 0 ? 0 : y;
    int x1 = x + w > CW ? CW : x + w;
    int y1 = y + h > CH ? CH : y + h;
    if (x0 >= CW || y0 >= CH || x1 <= 0 || y1 <= 0) return;
    std::uint32_t c = (255u << 24) | (static_cast<std::uint32_t>(rgb.b) << 16) | (static_cast<std::uint32_t>(rgb.g) << 8) | rgb.r;
    for (int iy = y0; iy < y1; ++iy)
    {
        for (int ix = x0; ix < x1; ++ix)
        {
            g_frame[iy * CW + ix] = c;
        }
    }
}

void draw_rect_border(int x, int y, int w, int h, int thickness,
                    color::rgb rgb) {
    fill_rect(x, y, w, thickness, rgb);                     // 上
    fill_rect(x, y + h - thickness, w, thickness, rgb);  // 下
    fill_rect(x, y, thickness, h, rgb);                     // 左
    fill_rect(x + w - thickness, y, thickness, h, rgb);  // 右
}

} // namespace canvas
} // namespace game
