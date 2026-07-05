/**
 * 渲染器 —— 驱动 requestAnimationFrame 循环，将 WASM 帧缓冲输出到 Canvas。
 */

import { WasmAPI } from './wasm-bridge.js';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private buf8: Uint8Array;
  private wasm: WasmAPI;
  private w: number;
  private h: number;

  // FPS 统计
  private frameCount = 0;
  private timeAccum  = 0;
  private timeLast   = 0;

  constructor(canvas: HTMLCanvasElement, wasm: WasmAPI) {
    this.wasm   = wasm;
    this.w      = wasm.getWidth();
    this.h      = wasm.getHeight();

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');
    this.ctx     = ctx;
    this.imgData = ctx.createImageData(this.w, this.h);
    this.buf8    = new Uint8Array(this.imgData.data.buffer);
  }

  /** 启动渲染循环 */
  start(): void {
    console.log(`[TS] 渲染循环启动 (${this.w}x${this.h})`);
    requestAnimationFrame((ts: number) => this.loop(ts));
  }

  // ---- 内部 ----

  private loop(now: number): void {
    // 1. C++ 渲染
    this.wasm.renderFrame();

    // 2. 零拷贝读像素 → Canvas
    const ptr = this.wasm.getPixels();
    const src = new Uint8Array(this.wasm.heapU8.buffer, ptr, this.w * this.h * 4);
    this.buf8.set(src);
    this.ctx.putImageData(this.imgData, 0, 0);

    // 3. FPS 统计
    this.frameCount++;
    this.timeAccum += (now - (this.timeLast || now)) / 1000;
    this.timeLast = now;
    if (this.timeAccum >= 1.0) {
      const fps = Math.round(this.frameCount / this.timeAccum);
      const el = document.getElementById('fps');
      if (el) el.textContent = `FPS: ${fps}  |  ${this.w}x${this.h}`;
      this.frameCount = 0;
      this.timeAccum  = 0;
    }

    requestAnimationFrame((ts: number) => this.loop(ts));
  }
}
