#pragma once
#include <cstdint>

// Canvas — 帧缓冲管理与基本绘图操作
// GFrameBuffer 在 Canvas.cpp 匿名 namespace 中，外部不可直接访问

namespace WorldOfWar {
namespace Canvas {

// 帧缓冲指针（JS 侧通过 HEAPU8 零拷贝读取）
uint8_t* GetPixels();

// 清空帧缓冲
void Clear(uint8_t r = 0, uint8_t g = 0, uint8_t b = 0);

// 写入单个像素（RGBA 小端序，与 Canvas ImageData 一致）
void SetPixel(int x, int y, uint8_t r, uint8_t g, uint8_t b);

// 填充矩形
void FillRect(int x, int y, int w, int h, uint8_t r, uint8_t g, uint8_t b);

// 绘制矩形边框
void DrawRectBorder(int x, int y, int w, int h, int thickness,
                    uint8_t r, uint8_t g, uint8_t b);

} // namespace Canvas
} // namespace WorldOfWar
