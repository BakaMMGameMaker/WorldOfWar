#pragma once
#include <cstdint>
#include <memory>
#include <typeindex>
#include <unordered_map>
#include <vector>

#include "Components/ComponentPool.h"
#include "Entity/Entity.h"
#include "System/System.h"

/// ECS 世界
///
/// 职责：
/// - 实体生命周期管理（创建/销毁）
/// - 组件增删查（类型安全的模板接口）
/// - 多组件联合查询 View<Ts...>()
/// - 系统注册与按序调度 Update()

namespace game {
namespace ecs {

class world {
public:
    world();
    ~world();

    // 实体管理

    /// 创建新实体，返回实体句柄
    entity_t create_entity();

    /// 销毁实体，同时移除其所有组件
    void destroy_entity(entity_t entity);

    /// 检查实体是否存活
    bool is_alive(entity_t entity) const;

    /// 当前存活实体数量
    entity_count_t get_alive_entity_count() const;

    // 组件操作

    /// 为实体添加组件（已有同类型则覆盖），返回组件引用
    template <typename ComponentType>
    ComponentType& add_component(entity_t entity, const ComponentType& component = ComponentType{});

    /// 移除实体上的指定类型组件
    template <typename ComponentType>
    void remove_component(entity_t entity);

    /// 获取实体上的组件指针（不存在返回 nullptr）
    template <typename ComponentType>
    ComponentType* get_component(entity_t entity);

    /// const 版本
    template <typename ComponentType>
    const ComponentType* get_component(entity_t entity) const;

    /// 检查实体是否拥有指定类型组件
    template <typename ComponentType>
    bool has_component(entity_t entity) const;

    // 多组件查询

    /// 返回拥有所有指定组件的实体列表
    /// 示例: auto entities = w.view<transform, health>();
    template <typename... ComponentTypes>
    std::vector<entity_t> view();

    // 系统管理

    /// 注册系统（World 持有所有权）
    void add_system(std::unique_ptr<system> sys);

    /// 按注册顺序执行所有系统的 Update
    void update(float delta_time);

    // 组件池访问（内部使用）
    template <typename T>
    component_pool<T>& get_component_pool();

private:
    /// 将系统首次注册时的 OnCreate 延迟到此处执行
    void flush_pending_systems();

    // —— 实体管理 ——
    struct entity_record {
    public:
        void set_alive(bool alive) { alive_ = alive; }
        bool is_alive() const { return alive_; }
        void increase_version() { version_++; }
        entity_version_t get_version() const { return version_; }
    private:
        bool alive_ = false;
        entity_version_t version_ = 0;
    };

    using entity_records_t = std::vector<entity_record>;
    entity_records_t entity_records_;            // 索引 → 实体记录

    using free_entity_indices_t = std::vector<entity_index_t>;
    free_entity_indices_t free_entity_indices_;  // 空闲索引列表

    entity_count_t alive_entity_count_ = 0;      // 存活实体数量

    // —— 组件存储 ——
    // 每个组件类型一个池，按 type_index 索引
    std::unordered_map<std::type_index, std::unique_ptr<IComponentPool>> component_pools_;

    // —— 系统调度 ——
    std::vector<std::unique_ptr<system>> pending_systems_;
    std::vector<system*> active_systems_;             // on_create 已调用的系统
    bool has_pending_systems_ = false;           // 是否有待初始化系统
};

// 模板实现
template <typename ComponentType>
component_pool<ComponentType>& world::get_component_pool() {
    auto key = std::type_index(typeid(ComponentType));
    auto it = component_pools_.find(key);
    if (it == component_pools_.end()) {
        auto new_pool = std::make_unique<component_pool<ComponentType>>();
        auto* ptr = new_pool.get();
        component_pools_[key] = std::move(new_pool);
        return *ptr;
    }
    return static_cast<component_pool<ComponentType>&>(*it->second);
}

template <typename ComponentType>
ComponentType& world::add_component(entity_t entity, const ComponentType& component) {
    return get_component_pool<ComponentType>().add_component_for(entity, component);
}

template <typename ComponentType>
void world::remove_component(entity_t entity) {
    get_component_pool<ComponentType>().remove_component_for(entity);
}

template <typename ComponentType>
ComponentType* world::get_component(entity_t entity) {
    return get_component_pool<ComponentType>().get_component_of(entity);
}

template <typename ComponentType>
const ComponentType* world::get_component(entity_t entity) const {
    // const 版本只查询已存在的池
    auto key = std::type_index(typeid(ComponentType));
    auto it = component_pools_.find(key);
    if (it == component_pools_.end()) return nullptr;
    return static_cast<const component_pool<ComponentType>*>(it->second.get())->get_component_of(entity);
}

template <typename ComponentType>
bool world::has_component(entity_t entity) const {
    auto key = std::type_index(typeid(ComponentType));
    auto it = component_pools_.find(key);
    if (it == component_pools_.end()) return false;
    return it->second->has_component(entity);
}

template <typename... ComponentTypes>
std::vector<entity_t> world::view() {
    std::vector<entity_t> result;

    // 找到最小的池以减少检查次数
    const IComponentPool* smallest = nullptr;
    size_t smallest_size = ~size_t(0);

    auto consider = [&](const IComponentPool* pool) {
        if (pool && pool->size() < smallest_size) {
            smallest = pool;
            smallest_size = pool->size();
        }
    };
    (consider(&get_component_pool<ComponentTypes>()), ...);

    if (!smallest || smallest_size == 0) return result;

    // 遍历最小池中的实体，检查是否拥有所有其他组件
    for (size_t i = 0; i < smallest->size(); ++i) {
        entity_t e = smallest->owner_at(i);
        if ((get_component_pool<ComponentTypes>().has_component(e) && ...)) {
            result.push_back(e);
        }
    }
    return result;
}

}  // namespace ecs
}  // namespace game
