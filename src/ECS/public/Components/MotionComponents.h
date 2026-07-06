#pragma once

/// 运动相关组件 — 地面/空中移动的状态与参数

namespace Game {
namespace ECS {

// ============================================================================
// GroundMotionComponent — 地面单位运动状态
// 沿 Transform.Angle 方向前进，物理: x += cos(angle)*vel*dt
// ============================================================================
struct GroundMotionComponent {
    float Vel = 0.0f;     // 前进速率（像素/秒）
    float AngVel = 0.0f;  // 旋转角速度（弧度/秒）
};

// ============================================================================
// AirMotionComponent — 空中单位运动状态
// 自由矢量运动，物理: x += vx*dt, y += vy*dt
// ============================================================================
struct AirMotionComponent {
    float VX = 0.0f;
    float VY = 0.0f;
};

// ============================================================================
// MotionParamsComponent — 运动参数（配置，一般不随运行变化）
// 地面单位使用 MaxSpeed/Accel/AngMaxSpeed/AngAccel
// 空中单位使用 MaxSpeed/Accel/TurnSensitivity
// ============================================================================
struct MotionParamsComponent {
    float MaxSpeed = 0.0f;
    float Accel = 0.0f;

    // 地面单位专用
    float AngMaxSpeed = 0.0f;
    float AngAccel = 0.0f;

    // 空中单位专用
    float TurnSensitivity = 0.0f;
};

}  // namespace ECS
}  // namespace Game
