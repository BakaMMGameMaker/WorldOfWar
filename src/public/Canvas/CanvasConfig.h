#pragma once

// CanvasConfig — 画布配置常量
// constexpr getter 编译期求值

namespace {

inline constexpr int kCanvasWidth  = 1200;
inline constexpr int kCanvasHeight = 800;
inline constexpr int kGridSize     = 100;

} // namespace

namespace WorldOfWar {
namespace Canvas {

// getter（constexpr，编译期可求值）
constexpr int GetCanvasWidth()  { return kCanvasWidth; }
constexpr int GetCanvasHeight() { return kCanvasHeight; }
constexpr int GetGridSize()     { return kGridSize; }

} // namespace Canvas
} // namespace WorldOfWar
