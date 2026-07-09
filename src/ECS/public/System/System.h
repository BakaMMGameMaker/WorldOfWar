#pragma once

/// 系统基类
/// 每个 system 对应一种游戏逻辑（移动、战斗、渲染等）
/// 通过 world::add_system 注册后，每帧按注册顺序调用 Update

namespace game {
namespace ecs {

class world;

class system {
   public:
    virtual ~system() = default;

    /// 系统首次注册时调用（可选重写，用于初始化）
    virtual void on_create(world& w) {}

    /// 每帧逻辑更新
    /// @param w 世界引用，用于查询/修改实体与组件
    /// @param dt 帧间隔（秒）
    virtual void update(world& w, float dt) = 0;
};

}  // namespace ecs
}  // namespace game
