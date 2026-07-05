/**
 * 输入管理器 —— 拦截键盘/鼠标事件并转发给 C++ 引擎。
 *
 * 设计原则：
 * - 游戏占用所有字母键 + 数字键（指挥官 CLI 输入指令操控单位）
 * - 拦截方向键、空格、回车等常用游戏键
 * - 阻止画布上的右键菜单
 * - 系统级快捷键（Alt+F4 等）由操作系统处理，页面无法拦截，无需关心
 */

import { WasmAPI } from './wasm-bridge.js';

// ---- 游戏拦截的按键（按 event.code 匹配） ----

const GAME_KEYS = new Set([
  // 字母键 A-Z
  'KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI',
  'KeyJ','KeyK','KeyL','KeyM','KeyN','KeyO','KeyP','KeyQ','KeyR',
  'KeyS','KeyT','KeyU','KeyV','KeyW','KeyX','KeyY','KeyZ',
  // 主键盘数字
  'Digit0','Digit1','Digit2','Digit3','Digit4',
  'Digit5','Digit6','Digit7','Digit8','Digit9',
  // 小键盘数字
  'Numpad0','Numpad1','Numpad2','Numpad3','Numpad4',
  'Numpad5','Numpad6','Numpad7','Numpad8','Numpad9',
  // 小键盘运算符
  'NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide',
  'NumpadDecimal','NumpadEnter',
  // 方向键
  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
  // 功能键
  'Space','Enter','Escape','Tab','Backspace','Delete',
  'Home','End','PageUp','PageDown',
  'ShiftLeft','ShiftRight','ControlLeft','ControlRight',
  'AltLeft','AltRight',
  // F1-F12
  'F1','F2','F3','F4','F5','F6',
  'F7','F8','F9','F10','F11','F12',
  // 符号键（用于 CLI 输入）
  'Backquote','Minus','Equal',
  'BracketLeft','BracketRight',
  'Backslash','Semicolon','Quote',
  'Comma','Period','Slash',
  'CapsLock','NumLock','ScrollLock',
  'Insert','Pause','PrintScreen',
]);

/**
 * 将浏览器键盘事件转换为 WASM 输入。
 * 监听 document 级别（游戏需要全局键盘焦点，不依赖特定元素）。
 */
export function initInput(wasm: WasmAPI, canvas: HTMLCanvasElement): void {
  // ---- 键盘 ----

  function handleKey(e: KeyboardEvent, down: number): void {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    e.stopPropagation();
    wasm.onKeyEvent(e.keyCode, down);
  }

  document.addEventListener('keydown', (e: KeyboardEvent) => handleKey(e, 1));
  document.addEventListener('keyup',   (e: KeyboardEvent) => handleKey(e, 0));

  // ---- 鼠标 ----

  /** 计算 canvas 坐标系中的坐标（考虑 CSS 缩放） */
  function canvasCoords(e: MouseEvent): { cx: number; cy: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      cx: Math.floor((e.clientX - rect.left) * scaleX),
      cy: Math.floor((e.clientY - rect.top)  * scaleY),
    };
  }

  // 光标移动（document 级别，支持边缘滚动检测）
  document.addEventListener('mousemove', (e: MouseEvent) => {
    const { cx, cy } = canvasCoords(e);
    wasm.onMouseMove(cx, cy);
  });

  // 鼠标按下（左/中/右键，用于框选开始、指令下发等）
  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    const { cx, cy } = canvasCoords(e);
    wasm.onMouseButton(cx, cy, e.button, 1);
  });

  // 鼠标松开
  canvas.addEventListener('mouseup', (e: MouseEvent) => {
    const { cx, cy } = canvasCoords(e);
    wasm.onMouseButton(cx, cy, e.button, 0);
  });

  // 左键点击（click = mousedown + mouseup 在同一点）
  canvas.addEventListener('click', (e: MouseEvent) => {
    const { cx, cy } = canvasCoords(e);
    wasm.onMouseClick(cx, cy);
  });

  // 阻止画布上的右键菜单（右键指令由 mousedown/mouseup 处理）
  canvas.addEventListener('contextmenu', (e: Event) => {
    e.preventDefault();
  });

  console.log('[TS] 输入管理就绪 (拦截 ' + GAME_KEYS.size + ' 种按键 + 完整鼠标事件)');
}
