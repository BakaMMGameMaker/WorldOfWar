#pragma once
#include "Entity/Entity.h"
#include <cstdint>

/// 战斗相关组件 — 攻击属性、武器、炮塔、指令、状态机

namespace game {
namespace ecs {

// 战斗属性（配置）
struct combat {
    float damage_ = 0.0f;
    float attack_range_ = 0.0f;
    float reload_time_ = 0.0f;    // 装填时间（秒），0 = 无冷却（如自杀式无人机）
    float bullet_speed_ = 0.0f;   // 弹丸速度（像素/秒）
};

// 武器状态（运行时）
struct weapon {
    float last_fire_ = 0.0f;  // 上次开火的游戏时间（秒）
};

// 炮塔（载具专用）
struct turret {
    float angle_ = 0.0f;        // 炮塔朝向（弧度）
    float angle_vel_ = 0.0f;       // 炮塔角速度
    float max_speed_ = 0.0f;     // 最大旋转速度
    float accel_ = 0.0f;        // 旋转加速度
    float barrel_offset_ = 0.0f; // 后座力位移（视觉用）
};

// OrderComponent — 玩家/AI 指令
enum class eorder : std::uint8_t { move, attack, follow, none };

struct order {
    eorder order_ = eorder::none;
    entity_t target_ = get_invalid_entity();  // Attack/Follow 的目标实体
    float target_x_ = 0.0f;            // Move 的目标坐标 (move单独component)
    float target_y_ = 0.0f;
};

// 自动索敌
struct auto_scan {
    bool enabled_ = false;
    entity_t target_entity_ = get_invalid_entity();  // 当前自动锁定目标
};

// UnitStateComponent — 单位行为状态机
enum class eunit_state : uint8_t {
    deploying,       // 正在从要塞部署
    moving,          // 移动到坐标点
    approaching,     // 接近指令目标
    following,       // 跟随友方单位
    idle             // 待机
};

struct unitstate {
    eunit_state unit_state_ = eunit_state::idle;
};

}  // namespace ecs
}  // namespace game
