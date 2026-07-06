#pragma once
#include <cstdint>

// Bridge/Canvas — JS 桥接：渲染控制与帧缓冲访问

extern "C" {

// 渲染一帧（深色背景，待迁移游戏逻辑后丰富）
void renderFrame();

// 帧缓冲指针（JS 通过 HEAPU8 零拷贝读取像素）
uint8_t* getPixels();

// 画布尺寸（像素）
int getWidth();
int getHeight();

} // extern "C"
