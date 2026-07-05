#include <emscripten.h>
#include "Bridge/Input/Keyboard.h"
#include "Input/Keyboard.h"

// 键盘事件桥接：JS → C++ 输入模块
extern "C" {

EMSCRIPTEN_KEEPALIVE
void onKeyEvent(int keyCode, int down) {
    Game::Input::SetKeyState(keyCode, down != 0);
}

} // extern "C"
