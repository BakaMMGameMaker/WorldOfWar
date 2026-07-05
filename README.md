# World of War

即时战略游戏。部署单位、下达指令、摧毁敌方要塞。

## 快速游玩（JS 版）

当前可玩版本是纯 JavaScript 实现，无需任何工具：

1. 克隆仓库
2. 用浏览器打开 `index.html`

支持两个关卡，WASD 或方向键移动视角，鼠标点击操作单位。

## C++ 核心（预览）

正在用 C++ + WebAssembly 重写核心引擎，在 Canvas 上以 160+ FPS 运行。

### 构建

需要 [Emscripten](https://emscripten.org/docs/getting_started/downloads.html)（`emcc` 命令可用）：

```bash
# 1. 设置环境
source src/env.sh          # 或手动 export 你的 emsdk 路径

# 2. 编译
emcc src/main.cpp -o src/game.html \
  --shell-file src/shell.html \
  -s WASM=1 -O3 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","HEAPU8"]' \
  -s EXPORTED_FUNCTIONS='["_renderFrame","_getPixels","_getWidth","_getHeight","_malloc","_free"]'

# 3. 启动本地服务器
cd src && python -m http.server 8080

# 4. 浏览器打开 http://localhost:8080/game.html
```

### 技术栈

| 层 | 技术 |
|----|------|
| 游戏逻辑 | C++ → WebAssembly |
| 渲染 | CPU 像素缓冲 → Canvas `putImageData` |
| 帧驱动 | JS `requestAnimationFrame` 调用 C++ 每帧函数 |
| 数据交换 | WASM 线性内存零拷贝（`HEAPU8`） |

当前为概念验证阶段：C++ 写入 1200×800 RGBA 像素数组，JS 侧通过共享内存直接读取并提交到 Canvas。
