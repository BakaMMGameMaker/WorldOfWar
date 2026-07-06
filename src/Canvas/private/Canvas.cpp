#include "Canvas.h"
#include "CanvasConfig.h"

namespace {

// 帧缓冲（CPU 端 RGBA 像素数组，JS 侧通过 HEAPU8 零拷贝读取）
uint32_t GFrameBuffer[Game::Canvas::GetCanvasWidth() *
                      Game::Canvas::GetCanvasHeight()];

} // namespace

namespace Game {
namespace Canvas {

uint8_t* GetPixels() {
    return reinterpret_cast<uint8_t*>(GFrameBuffer);
}

void Clear(const Types::RGB Color) {
    constexpr int W = GetCanvasWidth();
    constexpr int H = GetCanvasHeight();
    uint32_t c = (255u << 24) | ((uint32_t)Color.b << 16) | ((uint32_t)Color.g << 8) | Color.r;
    for (int i = 0; i < W * H; ++i)
        GFrameBuffer[i] = c;
}

void SetPixel(const int X, const int Y, const Types::RGB Color) {
    constexpr int W = GetCanvasWidth();
    constexpr int H = GetCanvasHeight();
    if ((unsigned)X >= (unsigned)W || (unsigned)Y >= (unsigned)H) return;
    GFrameBuffer[Y * W + X] = (255u << 24) | ((uint32_t)Color.b << 16) | ((uint32_t)Color.g << 8) | Color.r;
}

void FillRect(const int X, const int Y, const int W, const int H, const Types::RGB Color) {
    constexpr int CW = GetCanvasWidth();
    constexpr int CH = GetCanvasHeight();
    int x0 = X < 0 ? 0 : X;
    int y0 = Y < 0 ? 0 : Y;
    int x1 = X + W > CW ? CW : X + W;
    int y1 = Y + H > CH ? CH : Y + H;
    if (x0 >= CW || y0 >= CH || x1 <= 0 || y1 <= 0) return;
    uint32_t c = (255u << 24) | ((uint32_t)Color.b << 16) | ((uint32_t)Color.g << 8) | Color.r;
    for (int iy = y0; iy < y1; ++iy)
        for (int ix = x0; ix < x1; ++ix)
            GFrameBuffer[iy * CW + ix] = c;
}

void DrawRectBorder(const int X, const int Y, const int W, const int H, const int Thickness,
                    const Types::RGB Color) {
    FillRect(X, Y, W, Thickness, Color);                     // 上
    FillRect(X, Y + H - Thickness, W, Thickness, Color);    // 下
    FillRect(X, Y, Thickness, H, Color);                     // 左
    FillRect(X + W - Thickness, Y, Thickness, H, Color);    // 右
}

} // namespace Canvas
} // namespace Game
