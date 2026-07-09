#pragma once
#include "RGB.h"
#include <cstdint>

// Canvas — 帧缓冲管理与基本绘图操作
// g_frame 在 Canvas/Canvas.cpp 匿名 namespace 中，外部不可直接访问

namespace game {
namespace canvas {

// 帧缓冲指针（JS 侧通过 HEAPU8 零拷贝读取）
uint8_t* get_pixels();

// 清空帧缓冲
void clear(color::rgb rgb = {0, 0, 0});

// 写入单个像素（RGBA 小端序，与 Canvas ImageData 一致）
void set_pixels(int x, int y, color::rgb rgb);

// 填充矩形
void fill_rect(int x, int y, int w, int h, color::rgb rgb);

// 绘制矩形边框
void draw_rect_border(int x, int y, int w, int h, int thickness,
                    const color::rgb rgb);

} // namespace canvas
} // namespace game
