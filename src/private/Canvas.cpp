#include "../public/Canvas.h"
#include "../public/CanvasConfig.h"

namespace {

// 帧缓冲（CPU 端 RGBA 像素数组，JS 侧通过 HEAPU8 零拷贝读取）
static uint32_t GFrameBuffer[WorldOfWar::Canvas::GetCanvasWidth() *
                             WorldOfWar::Canvas::GetCanvasHeight()];

} // namespace

namespace WorldOfWar {
namespace Canvas {

uint8_t* GetPixels() {
    return reinterpret_cast<uint8_t*>(GFrameBuffer);
}

void Clear(uint8_t r, uint8_t g, uint8_t b) {
    constexpr int W = GetCanvasWidth();
    constexpr int H = GetCanvasHeight();
    uint32_t c = (255u << 24) | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
    for (int i = 0; i < W * H; ++i)
        GFrameBuffer[i] = c;
}

void SetPixel(int x, int y, uint8_t r, uint8_t g, uint8_t b) {
    constexpr int W = GetCanvasWidth();
    constexpr int H = GetCanvasHeight();
    if ((unsigned)x >= (unsigned)W || (unsigned)y >= (unsigned)H) return;
    GFrameBuffer[y * W + x] = (255u << 24) | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
}

void FillRect(int x, int y, int w, int h, uint8_t r, uint8_t g, uint8_t b) {
    constexpr int W = GetCanvasWidth();
    constexpr int H = GetCanvasHeight();
    int x0 = x < 0 ? 0 : x;
    int y0 = y < 0 ? 0 : y;
    int x1 = x + w > W ? W : x + w;
    int y1 = y + h > H ? H : y + h;
    if (x0 >= W || y0 >= H || x1 <= 0 || y1 <= 0) return;
    uint32_t c = (255u << 24) | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
    for (int iy = y0; iy < y1; ++iy)
        for (int ix = x0; ix < x1; ++ix)
            GFrameBuffer[iy * W + ix] = c;
}

void DrawRectBorder(int x, int y, int w, int h, int thickness,
                    uint8_t r, uint8_t g, uint8_t b) {
    FillRect(x, y, w, thickness, r, g, b);                     // 上
    FillRect(x, y + h - thickness, w, thickness, r, g, b);    // 下
    FillRect(x, y, thickness, h, r, g, b);                     // 左
    FillRect(x + w - thickness, y, thickness, h, r, g, b);    // 右
}

} // namespace Canvas
} // namespace WorldOfWar
