/**
 * WorldOfWar - C++ 核心渲染验证
 *
 * 编译：
 *   source src/env.sh
 *   emcc src/main.cpp -o src/game.html --shell-file src/shell.html \
 *     -s WASM=1 -O3 \
 *     -s EXPORTED_RUNTIME_METHODS='["cwrap","HEAPU8"]' \
 *     -s EXPORTED_FUNCTIONS='["_renderFrame","_getPixels","_getWidth","_getHeight","_malloc","_free"]'
 */

#include <emscripten.h>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <cmath>

// ============================================================================
// 画布配置
// ============================================================================
constexpr int W    = 1200;
constexpr int H    = 800;
constexpr int GRID = 80;   // 网格间距

// ============================================================================
// 帧缓冲（CPU 端 RGBA 像素数组，JS 侧通过 HEAPU8 零拷贝读取）
// ============================================================================
static uint32_t g_pixels[W * H];
static float    g_time = 0.0f;

// ============================================================================
// 像素写入（RGBA 小端序，与 Canvas ImageData 一致）
// ============================================================================
static inline void setPixel(int x, int y, uint8_t r, uint8_t g, uint8_t b) {
    if ((unsigned)x >= (unsigned)W || (unsigned)y >= (unsigned)H) return;
    g_pixels[y * W + x] = (255u << 24) | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
}

static void fillRect(int rx, int ry, int rw, int rh, uint8_t r, uint8_t g, uint8_t b) {
    int x0 = rx < 0 ? 0 : rx;
    int y0 = ry < 0 ? 0 : ry;
    int x1 = rx + rw > W ? W : rx + rw;
    int y1 = ry + rh > H ? H : ry + rh;
    if (x0 >= W || y0 >= H || x1 <= 0 || y1 <= 0) return;
    uint32_t c = (255u << 24) | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
    for (int y = y0; y < y1; y++)
        for (int x = x0; x < x1; x++)
            g_pixels[y * W + x] = c;
}

// ============================================================================
// 导出：JS 侧每帧调用 renderFrame()，再通过 getPixels() 读像素
// ============================================================================
extern "C" {

EMSCRIPTEN_KEEPALIVE
void renderFrame() {
    g_time += 0.016f;

    // 深色背景
    fillRect(0, 0, W, H, 12, 12, 26);

    // 网格线
    for (int x = 0; x <= W; x += GRID)
        for (int y = 0; y < H; y++) setPixel(x, y, 22, 22, 42);
    for (int y = 0; y <= H; y += GRID)
        for (int x = 0; x < W; x++) setPixel(x, y, 22, 22, 42);

    // 弹跳彩色方块（不同相位/速度）
    for (int i = 0; i < 8; i++) {
        float ph = (float)i * 0.7f;
        float sx = 120.0f + i * 25.0f;
        float sy = 90.0f  + i * 30.0f;
        int bx = (int)fabsf(fmodf(g_time * sx + ph * 80.0f, (W * 2.0f - 120.0f)) - (float)W + 60.0f) - 60;
        int by = (int)fabsf(fmodf(g_time * sy + ph * 60.0f, (H * 2.0f - 100.0f)) - (float)H + 50.0f) - 50;
        int sz = 28 + i * 5;
        fillRect(bx, by, sz, sz,
            (uint8_t)(180 + i * 9),
            (uint8_t)(40  + i * 10),
            (uint8_t)(10  + i * 8));
    }

    // 玩家方块（青色）圆周运动
    int px = (int)(W / 2 + cosf(g_time * 0.5f) * 250.0f - 25);
    int py = (int)(H / 2 + sinf(g_time * 0.7f) * 180.0f - 25);
    fillRect(px, py, 50, 50, 0, 200, 220);

    // FPS 条（绿色横条）
    static int tick = 0;
    tick++;
    fillRect(10, 8, (tick % 240) + 1, 6, 0, 255, 100);

    // 标题栏
    fillRect(0, 0, W, 28, 10, 10, 18);
    fillRect(0, 28, W, 1, 0, 180, 220);
}

EMSCRIPTEN_KEEPALIVE
uint8_t* getPixels() { return (uint8_t*)g_pixels; }

EMSCRIPTEN_KEEPALIVE
int getWidth()  { return W; }

EMSCRIPTEN_KEEPALIVE
int getHeight() { return H; }

} // extern "C"

// ============================================================================
int main() {
    printf("[C++] 帧缓冲: %dx%d (%zu 字节)\n", W, H, sizeof(g_pixels));
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
