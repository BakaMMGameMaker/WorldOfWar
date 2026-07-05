#pragma once

// Bridge/Input/Mouse — JS 桥接：鼠标事件转发到 C++ 输入模块

extern "C" {

// 鼠标移动
void onMouseMove(int x, int y);

// 鼠标按键（button: 0=左 1=中 2=右，down: 1=按下 0=松开）
void onMouseButton(int x, int y, int button, int down);

// 鼠标点击（已由 mousedown/up 处理，预留）
void onMouseClick(int x, int y);

} // extern "C"
