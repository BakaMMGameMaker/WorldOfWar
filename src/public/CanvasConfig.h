#pragma once

// ============================================================================
// CanvasConfig — 画布配置常量（公开头文件）
// 使用方式：#include "CanvasConfig.h"，链接 CanvasConfig.cpp
// ============================================================================

namespace WorldOfWar {
namespace Canvas {

/// 画布宽度（像素）
int GetCanvasWidth();

/// 画布高度（像素）
int GetCanvasHeight();

/// 网格间距（像素）
int GetGridSize();

} // namespace Canvas
} // namespace WorldOfWar
