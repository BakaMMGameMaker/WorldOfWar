#pragma once
#include <memory>
#include <typeindex>
#include <unordered_map>
#include <vector>

#include "Components/ComponentPool.h"
#include "Entity/Entity.h"
#include "System/System.h"

/// ECS 世界管理器 — 整个 ECS 框架的中央调度器
///
/// 职责：
/// - 实体生命周期管理（创建/销毁）
/// - 组件增删查（类型安全的模板接口）
/// - 多组件联合查询 View<Ts...>()
/// - 系统注册与按序调度 Update()

namespace Game {
namespace ECS {

class World {
public:
    World();
    ~World();

    // 实体管理

    /// 创建新实体，返回实体句柄
    FEntity CreateEntity();

    /// 销毁实体，同时移除其所有组件
    void DestroyEntity(FEntity E);

    /// 检查实体是否存活
    bool IsAlive(FEntity E) const;

    /// 当前存活实体数量
    size_t AliveEntityCount() const;

    // 组件操作

    /// 为实体添加组件（已有同类型则覆盖），返回组件引用
    template <typename T>
    T& AddComponent(FEntity E, const T& Component = T{});

    /// 移除实体上的指定类型组件
    template <typename T>
    void RemoveComponent(FEntity E);

    /// 获取实体上的组件指针（不存在返回 nullptr）
    template <typename T>
    T* GetComponent(FEntity E);

    /// const 版本
    template <typename T>
    const T* GetComponent(FEntity E) const;

    /// 检查实体是否拥有指定类型组件
    template <typename T>
    bool HasComponent(FEntity E) const;

    // 多组件查询

    /// 返回拥有所有指定组件的实体列表
    /// 示例: auto entities = world.View<TransformComponent, HealthComponent>();
    template <typename... Ts>
    std::vector<FEntity> View();

    // 系统管理

    /// 注册系统（World 持有所有权）
    void AddSystem(std::unique_ptr<System> Sys);

    /// 按注册顺序执行所有系统的 Update
    void Update(float DeltaTime);

    // 组件池访问（内部使用）
    template <typename T>
    ComponentPool<T>& GetPool();

private:
    /// 将系统首次注册时的 OnCreate 延迟到此处执行
    void FlushPendingSystems();

    // —— 实体管理 ——
    struct EntityRecord {
        bool Alive = false;
        FEntityVersion Version = 0;
    };

    std::vector<EntityRecord> _EntityRecords;  // 索引 → 实体记录
    std::vector<uint32_t> _FreeIndices;        // 空闲索引列表
    size_t _AliveEntityCount = 0;              // 存活实体数量

    // —— 组件存储 ——
    // 每个组件类型一个池，按 type_index 索引
    std::unordered_map<std::type_index, std::unique_ptr<IComponentPool>> _pools;

    // —— 系统调度 ——
    std::vector<std::unique_ptr<System>> _systems;
    std::vector<System*> _activeSystems;   // OnCreate 已调用的系统
    bool _systemsDirty = false;            // 是否有待初始化系统
};

// 模板实现
template <typename T>
ComponentPool<T>& World::GetPool() {
    auto key = std::type_index(typeid(T));
    auto it = _pools.find(key);
    if (it == _pools.end()) {
        auto pool = std::make_unique<ComponentPool<T>>();
        auto* ptr = pool.get();
        _pools[key] = std::move(pool);
        return *ptr;
    }
    return static_cast<ComponentPool<T>&>(*it->second);
}

template <typename T>
T& World::AddComponent(FEntity E, const T& Component) {
    return GetPool<T>().Add(E, Component);
}

template <typename T>
void World::RemoveComponent(FEntity E) {
    GetPool<T>().Remove(E);
}

template <typename T>
T* World::GetComponent(FEntity E) {
    return GetPool<T>().Get(E);
}

template <typename T>
const T* World::GetComponent(FEntity E) const {
    // const 版本需要 const_cast 来延迟创建池（只在已存在时查询）
    auto key = std::type_index(typeid(T));
    auto it = _pools.find(key);
    if (it == _pools.end()) return nullptr;
    return static_cast<const ComponentPool<T>*>(it->second.get())->Get(E);
}

template <typename T>
bool World::HasComponent(FEntity E) const {
    auto key = std::type_index(typeid(T));
    auto it = _pools.find(key);
    if (it == _pools.end()) return false;
    return it->second->Has(E);
}

template <typename... Ts>
std::vector<FEntity> World::View() {
    std::vector<FEntity> result;

    // 找到最小的池以减少检查次数
    const IComponentPool* smallest = nullptr;
    size_t smallestSize = ~size_t(0);

    auto consider = [&](const IComponentPool* pool) {
        if (pool && pool->Size() < smallestSize) {
            smallest = pool;
            smallestSize = pool->Size();
        }
    };
    (consider(&GetPool<Ts>()), ...);

    if (!smallest || smallestSize == 0) return result;

    // 遍历最小池中的实体，检查是否拥有所有其他组件
    for (size_t i = 0; i < smallest->Size(); ++i) {
        FEntity e = smallest->OwnerAt(i);
        if ((GetPool<Ts>().Has(e) && ...)) {
            result.push_back(e);
        }
    }
    return result;
}

}  // namespace ECS
}  // namespace Game
