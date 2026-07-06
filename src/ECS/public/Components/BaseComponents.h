#pragma once
#include <cstdint>
#include "Entity/Entity.h"

/// 基础组件 — 几乎所有实体都需要的通用数据

namespace Game {
namespace ECS {

// ============================================================================
// TransformComponent — 空间位置与朝向
// ============================================================================
struct TransformComponent {
    float X = 0.0f;
    float Y = 0.0f;
    float Angle = 0.0f;  // 朝向（弧度），0 = 正右方
};

// ============================================================================
// TeamComponent — 阵营归属
// ============================================================================
enum class Side : uint8_t { Blue, Red, Neutral };

struct TeamComponent {
    Side Team = Side::Neutral;
    Entity Owner = GetInvalidEntity();  // 所属要塞/控制者实体
};

// ============================================================================
// HealthComponent — 生命值
// ============================================================================
struct HealthComponent {
    float HP = 0.0f;
    float MaxHP = 0.0f;
};

// ============================================================================
// CollisionComponent — 碰撞体积
// ============================================================================
struct CollisionComponent {
    float Radius = 0.0f;  // 碰撞半径
};

// ============================================================================
// DomainComponent — 作战领域（地面/空中）
// ============================================================================
enum class DomainType : uint8_t { Ground, Air };

struct DomainComponent {
    DomainType Type = DomainType::Ground;
};

}  // namespace ECS
}  // namespace Game
