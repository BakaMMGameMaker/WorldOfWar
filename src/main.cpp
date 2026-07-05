#include <emscripten.h>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <cmath>
#include "CanvasConfig.h"

// ============================================================================
// 帧缓冲（CPU 端 RGBA 像素数组，JS 侧通过 HEAPU8 零拷贝读取）
// ============================================================================
static uint32_t g_pixels[WorldOfWar::Canvas::GetCanvasWidth() *
                         WorldOfWar::Canvas::GetCanvasHeight()];
static float    g_time = 0.0f;

// ============================================================================
// 玩家状态
// ============================================================================
static float g_playerX     = WorldOfWar::Canvas::GetCanvasWidth()  / 2.0f - 25.0f;
static float g_playerY     = WorldOfWar::Canvas::GetCanvasHeight() / 2.0f - 25.0f;
static int   g_playerSize  = 50;                  // 玩家方块尺寸（宽高相等）
static float g_playerSpeed = 300.0f;              // 移动速度（像素/秒）

// 按键状态表：按下为 true，松开为 false，索引为 keyCode
static bool g_keyDown[256] = {};

// 鼠标状态
static int  g_mouseX = 0, g_mouseY = 0;          // 当前光标位置（canvas 坐标）
static bool g_mouseDown[3] = {};                  // 按键状态：[0]=左 [1]=中 [2]=右

// 颜色方案（点击切换）
static const struct { uint8_t r, g, b; const char* name; } g_colorSchemes[] = {
    {  0, 200, 230, "青色"  },
    { 230,  80,  80, "红色"  },
    { 80, 230,  80, "绿色"  },
    { 230, 200,  40, "金色"  },
};
static constexpr int g_colorSchemeCount = sizeof(g_colorSchemes) / sizeof(g_colorSchemes[0]);
static int g_playerColorIdx = 0;  // 当前颜色索引

// ============================================================================
// 像素写入（RGBA 小端序，与 Canvas ImageData 一致）
// ============================================================================
static inline void setPixel(int x, int y, uint8_t r, uint8_t g, uint8_t b) {
    constexpr int W = WorldOfWar::Canvas::GetCanvasWidth();
    constexpr int H = WorldOfWar::Canvas::GetCanvasHeight();
    if ((unsigned)x >= (unsigned)W || (unsigned)y >= (unsigned)H) return;
    g_pixels[y * W + x] = (255u << 24) | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
}

static void fillRect(int rx, int ry, int rw, int rh, uint8_t r, uint8_t g, uint8_t b) {
    constexpr int W = WorldOfWar::Canvas::GetCanvasWidth();
    constexpr int H = WorldOfWar::Canvas::GetCanvasHeight();
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

// 绘制空心矩形边框
static void drawRectBorder(int rx, int ry, int rw, int rh, int thickness,
                           uint8_t r, uint8_t g, uint8_t b) {
    fillRect(rx, ry, rw, thickness, r, g, b);                     // 上
    fillRect(rx, ry + rh - thickness, rw, thickness, r, g, b);    // 下
    fillRect(rx, ry, thickness, rh, r, g, b);                     // 左
    fillRect(rx + rw - thickness, ry, thickness, rh, r, g, b);    // 右
}

// ============================================================================
// 导出函数：玩家输入接口（JS 侧调用）
// ============================================================================
extern "C" {

// 按键事件：keyCode 为浏览器键码，down=1 表示按下，0 表示松开
EMSCRIPTEN_KEEPALIVE
void onKeyEvent(int keyCode, int down) {
    if ((unsigned)keyCode >= 256u) return;
    g_keyDown[keyCode] = (down != 0);
}

// 鼠标点击事件：x, y 为 canvas 坐标系中的点击位置
EMSCRIPTEN_KEEPALIVE
void onMouseClick(int x, int y) {
    // 检测点击是否命中玩家方块
    if (x >= (int)g_playerX && x < (int)g_playerX + g_playerSize &&
        y >= (int)g_playerY && y < (int)g_playerY + g_playerSize) {
        g_playerColorIdx = (g_playerColorIdx + 1) % g_colorSchemeCount;
        printf("[C++] 玩家被点击！切换颜色: %s (索引 %d)\n",
               g_colorSchemes[g_playerColorIdx].name, g_playerColorIdx);
    }
}

// 鼠标移动事件：跟踪光标位置（用于悬停高亮、框选等）
EMSCRIPTEN_KEEPALIVE
void onMouseMove(int x, int y) {
    g_mouseX = x;
    g_mouseY = y;
}

// 鼠标按键事件：button 0=左键 1=中键 2=右键，down=1 按下 / 0 松开
EMSCRIPTEN_KEEPALIVE
void onMouseButton(int x, int y, int button, int down) {
    if ((unsigned)button >= 3u) return;
    g_mouseDown[button] = (down != 0);
    // 同时更新光标位置（按键事件也携带坐标）
    g_mouseX = x;
    g_mouseY = y;
}

// ============================================================================
// 渲染：JS 侧每帧调用 renderFrame()
// ============================================================================
EMSCRIPTEN_KEEPALIVE
void renderFrame() {
    constexpr int W    = WorldOfWar::Canvas::GetCanvasWidth();
    constexpr int H    = WorldOfWar::Canvas::GetCanvasHeight();
    constexpr int GRID = WorldOfWar::Canvas::GetGridSize();

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

    // ----- 玩家方块：根据按键状态更新位置 -----
    float dt = 0.016f;  // 固定帧间隔
    float move = g_playerSpeed * dt;

    if (g_keyDown[87] || g_keyDown[38]) g_playerY -= move;  // W / 上箭头
    if (g_keyDown[83] || g_keyDown[40]) g_playerY += move;  // S / 下箭头
    if (g_keyDown[65] || g_keyDown[37]) g_playerX -= move;  // A / 左箭头
    if (g_keyDown[68] || g_keyDown[39]) g_playerX += move;  // D / 右箭头

    // 边界限制
    if (g_playerX < 0) g_playerX = 0;
    if (g_playerY < 0) g_playerY = 0;
    if (g_playerX > W - g_playerSize) g_playerX = W - g_playerSize;
    if (g_playerY > H - g_playerSize) g_playerY = H - g_playerSize;

    // 绘制玩家方块（当前颜色方案）
    auto& c = g_colorSchemes[g_playerColorIdx];
    fillRect((int)g_playerX, (int)g_playerY, g_playerSize, g_playerSize, c.r, c.g, c.b);

    // 玩家方块边框（白色，方便识别）
    drawRectBorder((int)g_playerX, (int)g_playerY, g_playerSize, g_playerSize, 1, 255, 255, 255);

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
int getWidth()  { return WorldOfWar::Canvas::GetCanvasWidth(); }

EMSCRIPTEN_KEEPALIVE
int getHeight() { return WorldOfWar::Canvas::GetCanvasHeight(); }

} // extern "C"

// ============================================================================
int main() {
    constexpr int W = WorldOfWar::Canvas::GetCanvasWidth();
    constexpr int H = WorldOfWar::Canvas::GetCanvasHeight();

    printf("[C++] 帧缓冲: %dx%d (%zu 字节)\n", W, H, sizeof(g_pixels));
    printf("[C++] 玩家输入: WASD 移动 / 点击切换颜色\n");
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
