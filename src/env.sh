#!/bin/bash
# Emscripten 环境设置脚本
# 用法: source src/env.sh
# 所有路径相对于项目根目录

EMSDK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deps/emsdk"
DEPS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deps"

export EMSDK_PYTHON="${EMSDK_ROOT}/python/3.13.3_64bit/python.exe"
export PATH="${EMSDK_ROOT}/upstream/emscripten:${EMSDK_ROOT}/node/22.16.0_64bit/bin:${EMSDK_ROOT}/upstream/bin:${DEPS_ROOT}/python:${PATH}"

echo "[env] emcc $(emcc --version 2>&1 | head -1 | cut -d' ' -f5- | tr -d '\n')"
echo "[env] ready"
