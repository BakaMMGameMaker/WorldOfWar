#pragma once

// CanvasConfig — 画布配置常量
// constexpr getter 编译期求值

namespace {

constexpr int k_canvas_width  = 1200;
constexpr int k_canvas_height = 800;
constexpr int k_grid_size     = 100;

} // namespace

namespace game {
namespace canvas {

// getter
inline constexpr int get_canvas_width()  { return k_canvas_width; }
inline constexpr int get_canvas_height() { return k_canvas_height; }
inline constexpr int get_grid_size()     { return k_grid_size; }

} // namespace canvas
} // namespace game
