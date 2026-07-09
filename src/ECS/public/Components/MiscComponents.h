#pragma once
#include "Entity/Entity.h"
#include "RGB.h"
#include <cstdint>

/// 特殊组件 — 子弹、粒子、要塞、选中、计时器等

namespace game {
namespace ecs {

// 弹丸/子弹
struct projectile {
    entity_t owner_ = get_invalid_entity();  // 发射者
    float damage_ = 0.0f;
    float max_range_ = 0.0f;
    float start_x_ = 0.0f;           // 发射点 X（用于判断是否超出射程）
    float start_y_ = 0.0f;           // 发射点 Y
};

// 粒子特效
struct particle {
    float life_ = 0.0f;       // 剩余生命（秒）
    float max_life_ = 0.0f;    // 总生命（用于计算透明度）
    color::rgb rgb_ = {255, 255, 255};
    float size_ = 1.0f;
};

// ============================================================================
// FortressComponent — 要塞专属数据
// ============================================================================
enum class efortress_state : std::uint8_t {
    normal,       // 正常状态
    showCards,    // 显示兵种选择面板
    deploying,    // 放置单位中
    commanding    // 指挥已选中单位
};

struct fortress {
    float ap_ = 0.0f;              // 行动值
    float max_ap_ = 0.0f;
    bool is_ai_ = false;            // 是否由 AI 控制
    efortress_state fortress_state_ = efortress_state::normal;
    entity_t selected_unit_ = get_invalid_entity();  // 当前选中的己方单位
};

// 选中标记（玩家 UI）
struct selection {
    bool is_selected_ = false;
};

// 视觉计时器（闪烁效果等）
 struct timer {
    float reload_flash_ = 0.0f;  // 装填完成闪烁剩余时间
    float hit_flash_ = 0.0f;     // 受击闪烁剩余时间
};

}  // namespace ecs
}  // namespace game
