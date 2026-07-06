#!/bin/bash
# C++ → WASM 构建脚本
# 用法: bash src/build.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 加载 Emscripten 环境
source "$SCRIPT_DIR/env.sh"

# CMake 配置
cd "$SCRIPT_DIR"
emcmake cmake -B build

# 编译
cmake --build build

echo "[build] 完成"
