/**
 * WASM 桥接层 —— 将 Emscripten Module 的原始 cwrap 调用封装为类型安全的 API。
 */

/** C++ 引擎暴露的接口 */
export interface WasmAPI {
  /** 渲染一帧到帧缓冲 */
  renderFrame(): void;
  /** 获取帧缓冲指针（HEAPU8 字节偏移量） */
  getPixels(): number;
  /** 画布宽度 */
  getWidth(): number;
  /** 画布高度 */
  getHeight(): number;
  /** 键盘事件：keyCode 为浏览器键码，down=1 按下 / 0 松开 */
  onKeyEvent(keyCode: number, down: number): void;
  /** 鼠标点击事件：x, y 为 canvas 坐标系中的点击位置 */
  onMouseClick(x: number, y: number): void;
  /** 鼠标移动事件：光标位置跟踪 */
  onMouseMove(x: number, y: number): void;
  /** 鼠标按键事件：button 0=左 1=中 2=右，down=1 按下 / 0 松开 */
  onMouseButton(x: number, y: number, button: number, down: number): void;
  /** HEAPU8 引用（零拷贝读取帧缓冲） */
  readonly heapU8: Uint8Array;
}

/**
 * 初始化 WASM 桥接。
 * 必须在 Module.onRuntimeInitialized 回调中调用。
 */
export function initWasm(mod: EmscriptenModule): WasmAPI {
  const renderFrame   = mod.cwrap('renderFrame',   null,   []);
  const getPixels     = mod.cwrap('getPixels',     'number', []);
  const getWidth      = mod.cwrap('getWidth',      'number', []);
  const getHeight     = mod.cwrap('getHeight',     'number', []);
  const onKeyEvent    = mod.cwrap('onKeyEvent',    null,   ['number', 'number']);
  const onMouseClick  = mod.cwrap('onMouseClick',  null,   ['number', 'number']);
  const onMouseMove   = mod.cwrap('onMouseMove',   null,   ['number', 'number']);
  const onMouseButton = mod.cwrap('onMouseButton', null,   ['number', 'number', 'number', 'number']);

  const w = getWidth();
  const h = getHeight();
  const ptr = getPixels();

  console.log(`[TS] 帧缓冲: ${w}x${h}, 指针: 0x${ptr.toString(16)}`);

  return {
    renderFrame,
    getPixels,
    getWidth,
    getHeight,
    onKeyEvent,
    onMouseClick,
    onMouseMove,
    onMouseButton,
    heapU8: mod.HEAPU8,
  };
}
