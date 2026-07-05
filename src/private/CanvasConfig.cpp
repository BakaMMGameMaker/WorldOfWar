#include "../public/CanvasConfig.h"

// ============================================================================
// 画布配置定义（与 game.js CONFIG 保持一致）
// ============================================================================

namespace {

constexpr int kCanvasWidth  = 1200;
constexpr int kCanvasHeight = 800;
constexpr int kGridSize     = 100;

} // namespace

namespace WorldOfWar {
namespace Canvas {

int GetCanvasWidth()  { return kCanvasWidth; }
int GetCanvasHeight() { return kCanvasHeight; }
int GetGridSize()     { return kGridSize; }

} // namespace Canvas
} // namespace WorldOfWar
