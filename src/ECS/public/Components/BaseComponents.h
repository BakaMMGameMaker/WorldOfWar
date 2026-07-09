#pragma once
#include "Entity/Entity.h"
#include <cstdint>

/// 基础组件 — 几乎所有实体都需要的通用数据

namespace game {
namespace ecs {

// 空间位置与朝向
struct transform {
    float x_ = 0.0f;
    float y_ = 0.0f;
    float angle_ = 0.0f;  // 朝向（弧度），0 = 正右方
};

// 阵营归属
enum class eteam : std::uint8_t { blue, red, neutral };

struct team {
    eteam team_ = eteam::neutral;
    entity_t owner_ = get_invalid_entity();  // 所属要塞/控制者实体
};

// 生命值
struct health {
    float hp_ = 0.0f;
    float maxhp_ = 0.0f;
};

// 碰撞体积
struct collision {
    float radius_ = 0.0f;  // 碰撞半径
};

// 作战领域（地面/空中）
enum class edomain : uint8_t { ground, air };

struct domain {
    edomain domain_ = edomain::ground;
};

}  // namespace ecs
}  // namespace game
