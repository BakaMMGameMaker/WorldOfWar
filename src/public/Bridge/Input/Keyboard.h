#pragma once

// Bridge/Input/Keyboard — JS 桥接：键盘事件转发到 C++ 输入模块

extern "C" {

// keyCode: DOM KeyboardEvent.keyCode，down: 1=按下 0=松开
void onKeyEvent(int keyCode, int down);

} // extern "C"
