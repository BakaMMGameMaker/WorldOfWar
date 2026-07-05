/**
 * 入口 —— 等待 WASM 就绪后初始化所有子系统。
 *
 * 启动流程：
 *   shell.html 内联脚本 → 创建 Module → {{{ SCRIPT }}} 加载 WASM
 *   → 本模块设置 Module.onRuntimeInitialized
 *   → WASM 就绪 → initWasm → initInput → Renderer.start
 */

import { initWasm } from './wasm-bridge.js';
import { initInput } from './input.js';
import { Renderer }  from './renderer.js';

/** WASM 就绪后的总初始化 */
function boot(mod: EmscriptenModule): void {
  console.log('[TS] WASM 模块就绪，开始初始化...');

  // 桥接 WASM
  const wasm = initWasm(mod);

  // 画布元素
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('找不到 #canvas 元素');

  // 输入管理（键盘 + 鼠标）
  initInput(wasm, canvas);

  // 渲染循环
  const renderer = new Renderer(canvas, wasm);
  renderer.start();

  // 状态栏
  const status = document.getElementById('status');
  if (status) {
    status.textContent = '运行中';
    status.style.color = '#4a9';
  }
}

// ---- 挂载到 Emscripten 生命周期 ----

// 安全：如果 WASM 已在 TS 加载前初始化完毕（极端的缓存命中场景），直接启动
// 正常情况下 ES module（deferred）会比 WASM 网络请求先执行完毕
if (typeof Module !== 'undefined' && (Module as any)._wasmReady) {
  boot(Module);
} else {
  // 正常路径：设置回调，WASM 就绪后 Emscripten 调用
  Module.onRuntimeInitialized = () => {
    (Module as any)._wasmReady = true;
    boot(Module);
  };
}
