#pragma once

/// 运动相关组件 — 地面/空中移动的状态与参数

namespace game {
namespace ecs {

// 地面单位运动状态
// 沿 Transform.Angle 方向前进，物理: x += cos(angle)*vel*dt
struct ground_motion {
    float vel_ = 0.0f;     // 前进速率（像素/秒）
    float angle_vel_ = 0.0f;  // 旋转角速度（弧度/秒）
};

// 空中单位运动状态
// 自由矢量运动，物理: x += vx*dt, y += vy*dt
struct air_motion {
    float vx_ = 0.0f;
    float vy_ = 0.0f;
};

// 运动配置
// 地面单位使用 MaxSpeed/Accel/AngMaxSpeed/AngAccel
// 空中单位使用 MaxSpeed/Accel/TurnSensitivity
struct motion_config {
    float max_speed_ = 0.0f;
    float accel_ = 0.0f;

    // 地面单位专用
    float max_angle_vel_ = 0.0f;
    float angle_accel_ = 0.0f;

    // 空中单位专用
    float turn_sensitivity_ = 0.0f;
};

}  // namespace ecs
}  // namespace game
