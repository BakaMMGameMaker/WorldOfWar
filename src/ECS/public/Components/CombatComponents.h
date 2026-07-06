#pragma once
#include "Entity/Entity.h"

/// 战斗相关组件 — 攻击属性、武器、炮塔、指令、状态机

namespace Game {
namespace ECS {

// ============================================================================
// CombatComponent — 战斗属性（配置）
// ============================================================================
struct CombatComponent {
    float Damage = 0.0f;
    float AttackRange = 0.0f;
    float ReloadTime = 0.0f;    // 装填时间（秒），0 = 无冷却（如自杀式无人机）
    float BulletSpeed = 0.0f;   // 弹丸速度（像素/秒）
};

// ============================================================================
// WeaponComponent — 武器状态（运行时）
// ============================================================================
struct WeaponComponent {
    float LastFireTime = 0.0f;  // 上次开火的游戏时间（秒）
};

// ============================================================================
// TurretComponent — 炮塔（载具专用）
// ============================================================================
struct TurretComponent {
    float Angle = 0.0f;        // 炮塔朝向（弧度）
    float AngVel = 0.0f;       // 炮塔角速度
    float MaxSpeed = 0.0f;     // 最大旋转速度
    float Accel = 0.0f;        // 旋转加速度
    float BarrelOffset = 0.0f; // 后座力位移（视觉用）
};

// ============================================================================
// OrderComponent — 玩家/AI 指令
// ============================================================================
enum class OrderType : uint8_t { None, Move, Attack, Follow };

struct OrderComponent {
    OrderType Type = OrderType::None;
    Entity Target = GetInvalidEntity();  // Attack/Follow 的目标实体
    float TargetX = 0.0f;            // Move 的目标坐标
    float TargetY = 0.0f;
};

// ============================================================================
// AutoScanComponent — 自动索敌
// ============================================================================
struct AutoScanComponent {
    bool Enabled = false;
    Entity AutoTarget = GetInvalidEntity();  // 当前自动锁定目标
};

// ============================================================================
// UnitStateComponent — 单位行为状态机
// ============================================================================
enum class UnitState : uint8_t {
    Deploying,       // 正在从要塞部署
    Moving,          // 移动到坐标点
    Approaching,     // 接近指令目标
    Following,       // 跟随友方单位
    Idle             // 待机
};

struct UnitStateComponent {
    UnitState State = UnitState::Idle;
};

}  // namespace ECS
}  // namespace Game
