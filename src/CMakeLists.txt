cmake_minimum_required(VERSION 3.10)
project(WorldOfWar LANGUAGES CXX)

# 生成 compile_commands.json，供 clangd 获取头文件搜索路径
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ============================================================================
# 产物输出到 src/（兼容 shell.html 中 "build/main.js" 的相对路径）
# ============================================================================
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}")

# ============================================================================
# 可执行目标：game.html / game.js / game.wasm
# ============================================================================
file(GLOB GAME_SOURCES
    "*.cpp"
    "*/private/*.cpp"
    "*/private/*/*.cpp"
)
add_executable(game ${GAME_SOURCES})

# 公开头文件搜索路径（每个模块的 public/ 目录）
target_include_directories(game PRIVATE
    Types
    Canvas/public
    Input/public
    ECS/public
    Bridge/public
)

# Emscripten 产物后缀（生成 .html + .js + .wasm）
set(CMAKE_EXECUTABLE_SUFFIX ".html")

# 发布构建优化级别
target_compile_options(game PRIVATE -O3)
target_link_options(game PRIVATE -O3
    "--shell-file" "${CMAKE_CURRENT_SOURCE_DIR}/shell.html"
    "-sWASM=1"
    "-sEXPORTED_RUNTIME_METHODS=cwrap,HEAPU8"
    "-sEXPORTED_FUNCTIONS=_renderFrame,_getPixels,_getWidth,_getHeight,_malloc,_free,_onKeyEvent,_onMouseClick,_onMouseMove,_onMouseButton"
)
