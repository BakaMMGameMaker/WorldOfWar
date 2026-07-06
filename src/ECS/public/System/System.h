#pragma once

/// 系统基类
/// 每个 System 对应一种游戏逻辑（移动、战斗、渲染等）
/// 通过 World::AddSystem 注册后，每帧按注册顺序调用 Update

namespace Game {
namespace ECS {

class World;

class System {
   public:
    virtual ~System() = default;

    /// 系统首次注册时调用（可选重写，用于初始化）
    virtual void OnCreate(World& WorldRef) {}

    /// 每帧逻辑更新
    /// @param WorldRef 世界引用，用于查询/修改实体与组件
    /// @param DeltaTime 帧间隔（秒）
    virtual void Update(World& WorldRef, float DeltaTime) = 0;
};

}  // namespace ECS
}  // namespace Game
