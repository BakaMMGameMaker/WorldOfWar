#pragma once
#include <cstdint>
#include "Types/RGB.h"

// Canvas — 帧缓冲管理与基本绘图操作
// GFrameBuffer 在 Canvas/Canvas.cpp 匿名 namespace 中，外部不可直接访问

namespace Game {
namespace Canvas {

// 帧缓冲指针（JS 侧通过 HEAPU8 零拷贝读取）
uint8_t* GetPixels();

// 清空帧缓冲
void Clear(const Types::RGB Color = {0, 0, 0});

// 写入单个像素（RGBA 小端序，与 Canvas ImageData 一致）
void SetPixel(int X, int Y, const Types::RGB Color);

// 填充矩形
void FillRect(int X, int Y, int W, int H, const Types::RGB Color);

// 绘制矩形边框
void DrawRectBorder(int X, int Y, int W, int H, int Thickness,
                    const Types::RGB Color);

} // namespace Canvas
} // namespace Game
