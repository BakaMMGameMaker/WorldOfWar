#pragma once
#include <cassert>
#include <cstddef>
#include <unordered_map>
#include <vector>
#include "Entity/Entity.h"

/// 通用组件池 — 稀疏集合实现
/// - Add/Get/Has 均为 O(1)
/// - 迭代时数据在连续内存中
/// - IComponentPool 提供类型擦除接口，供 World 统一管理

namespace game {
namespace ecs {

class IComponentPool {
public:
    virtual ~IComponentPool() = default;
    virtual void remove_component_for(entity_t e) = 0;
    virtual bool has_component(entity_t e) const = 0;
    virtual size_t size() const = 0;
    virtual entity_t owner_at(size_t index) const = 0;
};

// 具体组件池模板
template <typename ComponentType>
class component_pool : public IComponentPool {
public:
    /// 添加组件（实体已有该类型组件时会覆盖）
    ComponentType& add_component_for(entity_t e, const ComponentType& component = {}) {

        // 返回 entity 已持有的该组件
        auto it = entity_to_component_index_.find(e);
        if (it != entity_to_component_index_.end()) {
            components_[it->second] = component;
            return components_[it->second];
        }

        // entity 无该组件，为 entity 添加该组件
        size_t index = components_.size();
        components_.push_back(component);
        component_index_to_entity_.push_back(e);
        entity_to_component_index_[e] = index;
        return components_[index];
    }

    /// 移除实体上的该组件
    void remove_component_for(entity_t e) override {
        auto it = entity_to_component_index_.find(e);
        if (it == entity_to_component_index_.end()) return;

        size_t removed_component_index = it->second;
        size_t last_component_index = components_.size() - 1;

        // swap-and-pop
        if (removed_component_index != last_component_index) {
            components_[removed_component_index] = std::move(components_[last_component_index]);
            component_index_to_entity_[removed_component_index] = component_index_to_entity_[last_component_index];
            entity_to_component_index_[component_index_to_entity_[removed_component_index]] = removed_component_index;
        }

        components_.pop_back();
        component_index_to_entity_.pop_back();
        entity_to_component_index_.erase(it);
    }

    /// 获取组件指针（不存在时返回 nullptr）
    ComponentType* get_component_of(entity_t e) {
        auto it = entity_to_component_index_.find(e);
        if (it == entity_to_component_index_.end()) return nullptr;
        return &components_[it->second];
    }

    /// 获取组件指针（const 版本）
    const ComponentType* get_component_of(entity_t e) const {
        auto it = entity_to_component_index_.find(e);
        if (it == entity_to_component_index_.end()) return nullptr;
        return &components_[it->second];
    }

    /// 查询实体是否拥有该组件
    bool has_component(entity_t e) const override {
        return entity_to_component_index_.find(e) != entity_to_component_index_.end();
    }

    /// 池中组件数量
    size_t size() const override { return components_.size(); }

    /// 获取第 index 个组件的实体
    entity_t owner_at(size_t index) const override {
        assert(index < component_index_to_entity_.size());
        return component_index_to_entity_[index];
    }

    /// 迭代
    ComponentType* begin() { return components_.data(); }
    ComponentType* end() { return components_.data() + components_.size(); }
    const ComponentType* begin() const { return components_.data(); }
    const ComponentType* end() const { return components_.data() + components_.size(); }

    /// 同时遍历实体与组件
    const std::vector<entity_t>& owners() const { return component_index_to_entity_; }
    const std::vector<ComponentType>& data() const { return components_; }

   private:
    std::vector<ComponentType> components_;                      // 组件密集存储
    std::vector<entity_t> component_index_to_entity_;               // components_[i] 对应的实体
    std::unordered_map<entity_t, size_t> entity_to_component_index_;  // 实体 → 数组索引 todo: 改 sparse
};

}  // namespace ecs
}  // namespace game
