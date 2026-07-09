#include <emscripten.h>
#include "Input/Keyboard.h"
#include "Keyboard.h"

// 键盘事件桥接：JS → C++ 输入模块
extern "C" {

EMSCRIPTEN_KEEPALIVE
void onKeyEvent(int keyCode, int down) {
    game::input::set_key_state(keyCode, down != 0);
}

} // extern "C"
