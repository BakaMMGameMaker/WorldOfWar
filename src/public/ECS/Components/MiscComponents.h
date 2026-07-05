#pragma once
#include <cstdint>
#include "ECS/Core/Entity.h"

/// 特殊组件 — 子弹、粒子、要塞、选中、计时器等

namespace Game {
namespace ECS {

// ============================================================================
// ProjectileComponent — 弹丸/子弹
// ============================================================================
struct ProjectileComponent {
    Entity Owner = INVALID_ENTITY;  // 发射者
    float Damage = 0.0f;
    float MaxRange = 0.0f;
    float StartX = 0.0f;           // 发射点 X（用于判断是否超出射程）
    float StartY = 0.0f;           // 发射点 Y
};

// ============================================================================
// ParticleComponent — 粒子特效
// ============================================================================
struct ParticleComponent {
    float Life = 0.0f;       // 剩余生命（秒）
    float MaxLife = 0.0f;    // 总生命（用于计算透明度）
    uint8_t R = 255;
    uint8_t G = 255;
    uint8_t B = 255;
    float Size = 1.0f;
};

// ============================================================================
// FortressComponent — 要塞专属数据
// ============================================================================
enum class FortressState : uint8_t {
    Normal,       // 正常状态
    ShowCards,    // 显示兵种选择面板
    Deploying,    // 放置单位中
    Commanding    // 指挥已选中单位
};

struct FortressComponent {
    float AP = 0.0f;              // 行动值
    float MaxAP = 0.0f;
    bool IsAI = false;            // 是否由 AI 控制
    FortressState State = FortressState::Normal;
    Entity SelectedUnit = INVALID_ENTITY;  // 当前选中的己方单位
};

// ============================================================================
// SelectionComponent — 选中标记（玩家 UI）
// ============================================================================
struct SelectionComponent {
    bool IsSelected = false;
};

// ============================================================================
// TimerComponent — 视觉计时器（闪烁效果等）
// ============================================================================
struct TimerComponent {
    float ReloadFlash = 0.0f;  // 装填完成闪烁剩余时间
    float HitFlash = 0.0f;     // 受击闪烁剩余时间
};

}  // namespace ECS
}  // namespace Game
