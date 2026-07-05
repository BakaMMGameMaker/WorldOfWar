#include <cstdio>
#include "Canvas/CanvasConfig.h"

int main() {
    printf("[C++] 帧缓冲: %dx%d\n",
           Game::Canvas::GetCanvasWidth(),
           Game::Canvas::GetCanvasHeight());
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
