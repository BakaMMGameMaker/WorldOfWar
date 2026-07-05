#include "ECS/Core/World.h"

namespace Game {
namespace ECS {

World::World() {
    // 保留索引 0 为 INVALID_ENTITY
    _entities.emplace_back();  // EntityRecord{false, 0}
}

World::~World() = default;

Entity World::CreateEntity() {
    uint32_t index;

    if (!_freeIndices.empty()) {
        // 复用已释放的索引
        index = _freeIndices.back();
        _freeIndices.pop_back();
        _entities[index].version++;              // 递增版本号，使旧引用失效
    } else {
        // 分配新索引
        index = static_cast<uint32_t>(_entities.size());
        if (index >= MAX_ENTITIES) return INVALID_ENTITY;  // 超出上限
        _entities.emplace_back();                // alive=false, version=0
    }

    auto& record = _entities[index];
    record.alive = true;
    _aliveCount++;

    return MakeEntity(index, record.version);
}

void World::DestroyEntity(Entity e) {
    if (!IsAlive(e)) return;

    uint32_t index = GetEntityIndex(e);
    _entities[index].alive = false;
    _aliveCount--;
    _freeIndices.push_back(index);

    // 从所有组件池中移除该实体
    for (auto& [type, pool] : _pools) {
        pool->Remove(e);
    }
}

bool World::IsAlive(Entity e) const {
    if (e == INVALID_ENTITY) return false;
    uint32_t index = GetEntityIndex(e);
    if (index >= _entities.size()) return false;
    const auto& record = _entities[index];
    return record.alive && (GetEntityVersion(e) == record.version);
}

size_t World::EntityCount() const {
    return _aliveCount;
}

void World::AddSystem(std::unique_ptr<System> sys) {
    if (!sys) return;
    _systems.push_back(std::move(sys));
    _systemsDirty = true;
}

void World::FlushPendingSystems() {
    if (!_systemsDirty) return;
    for (auto& sys : _systems) {
        sys->OnCreate(*this);
        _activeSystems.push_back(sys.get());
    }
    _systems.clear();
    _systemsDirty = false;
}

void World::Update(float dt) {
    FlushPendingSystems();
    for (auto* sys : _activeSystems) {
        sys->Update(*this, dt);
    }
}

}  // namespace ECS
}  // namespace Game
