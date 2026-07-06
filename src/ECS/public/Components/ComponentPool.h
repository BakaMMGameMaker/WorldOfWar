#pragma once
#include <cassert>
#include <unordered_map>
#include <vector>
#include "Entity/Entity.h"

/// 通用组件池 — 稀疏集合实现
/// - Add/Get/Has 均为 O(1)
/// - 迭代时数据在连续内存中（缓存友好）
/// - IComponentPool 提供类型擦除接口，供 World 统一管理

namespace Game {
namespace ECS {

// ============================================================================
// 类型擦除基类 — World 通过此接口管理不同类型的组件池
// ============================================================================
class IComponentPool {
   public:
    virtual ~IComponentPool() = default;
    virtual void Remove(Entity E) = 0;
    virtual bool Has(Entity E) const = 0;
    virtual size_t Size() const = 0;
    virtual Entity OwnerAt(size_t Index) const = 0;
};

// ============================================================================
// 具体组件池模板
// ============================================================================
template <typename T>
class ComponentPool : public IComponentPool {
   public:
    /// 添加组件（实体已有该类型组件时会覆盖）
    T& Add(Entity E, const T& Component = T{}) {
        auto it = _entityToIndex.find(E);
        if (it != _entityToIndex.end()) {
            _data[it->second] = Component;
            return _data[it->second];
        }
        size_t idx = _data.size();
        _data.push_back(Component);
        _owners.push_back(E);
        _entityToIndex[E] = idx;
        return _data[idx];
    }

    /// 移除实体上的该组件
    void Remove(Entity E) override {
        auto it = _entityToIndex.find(E);
        if (it == _entityToIndex.end()) return;

        size_t idx = it->second;
        size_t last = _data.size() - 1;

        // swap-and-pop：保持数组紧密
        if (idx != last) {
            _data[idx] = std::move(_data[last]);
            _owners[idx] = _owners[last];
            _entityToIndex[_owners[idx]] = idx;
        }
        _data.pop_back();
        _owners.pop_back();
        _entityToIndex.erase(it);
    }

    /// 获取组件指针（不存在时返回 nullptr）
    T* Get(Entity E) {
        auto it = _entityToIndex.find(E);
        if (it == _entityToIndex.end()) return nullptr;
        return &_data[it->second];
    }

    /// 获取组件指针（const 版本）
    const T* Get(Entity E) const {
        auto it = _entityToIndex.find(E);
        if (it == _entityToIndex.end()) return nullptr;
        return &_data[it->second];
    }

    /// 查询实体是否拥有该组件
    bool Has(Entity E) const override {
        return _entityToIndex.find(E) != _entityToIndex.end();
    }

    /// 池中组件数量
    size_t Size() const override { return _data.size(); }

    /// 获取第 Index 个组件的实体 ID
    Entity OwnerAt(size_t Index) const override {
        assert(Index < _owners.size());
        return _owners[Index];
    }

    /// 迭代支持（直接遍历组件数组）
    T* begin() { return _data.data(); }
    T* end() { return _data.data() + _data.size(); }
    const T* begin() const { return _data.data(); }
    const T* end() const { return _data.data() + _data.size(); }

    /// 同时遍历实体与组件
    const std::vector<Entity>& Owners() const { return _owners; }
    const std::vector<T>& Data() const { return _data; }

   private:
    std::vector<T> _data;                      // 组件密集存储
    std::vector<Entity> _owners;               // _data[i] 对应的实体
    std::unordered_map<Entity, size_t> _entityToIndex;  // 实体 → 数组索引
};

}  // namespace ECS
}  // namespace Game
