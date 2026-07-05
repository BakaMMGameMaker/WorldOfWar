/**
 * Emscripten Module 全局声明
 *
 * Module 由 shell.html 中的内联 <script> 创建，
 * {{{ SCRIPT }}} 扩展其方法，WASM 加载完成后调用 onRuntimeInitialized。
 */
declare var Module: EmscriptenModule;

interface EmscriptenModule {
  /** 画布元素 */
  canvas: HTMLCanvasElement;
  /** C++ print 输出回调 */
  print: (text: string) => void;
  /** C++ printErr 输出回调 */
  printErr: (text: string) => void;
  /** Emscripten 状态更新回调 */
  setStatus: (text: string) => void;
  /** WASM 堆内存视图（运行时由 Emscripten 填充） */
  HEAPU8: Uint8Array;
  /** cwrap：将 C 函数包装为 JS 可调用函数 */
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => (...args: any[]) => any;
  /** WASM 初始化完成回调 */
  onRuntimeInitialized?: () => void;
}
