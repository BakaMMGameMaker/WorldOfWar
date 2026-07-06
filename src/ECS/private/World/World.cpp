#include "World/World.h"
#include "Entity/Entity.h"

namespace Game {
namespace ECS {

World::World() {
    // 保留索引 0 为无效实体
    _EntityRecords.emplace_back();  // EntityRecord{false, 0}
}

World::~World() = default;

FEntity World::CreateEntity() {
    uint32_t index;

    if (!_FreeIndices.empty()) {
        // 复用已释放的索引
        index = _FreeIndices.back();
        _FreeIndices.pop_back();
        _EntityRecords[index].Version++;              // 递增版本号，使旧引用失效
    } else {
        // 分配新索引
        index = static_cast<uint32_t>(_EntityRecords.size());
        if (index >= GetMaxEntities()) return GetInvalidEntity();  // 超出上限
        _EntityRecords.emplace_back();                // Alive=false, Version=0
    }

    auto& record = _EntityRecords[index];
    record.Alive = true;
    _AliveEntityCount++;

    return MakeEntity(index, record.Version);
}

void World::DestroyEntity(FEntity e) {
    if (!IsAlive(e)) return;

    FEntityIndex Index = GetEntityIndex(e);
    _EntityRecords[Index].Alive = false;
    _AliveEntityCount--;
    _FreeIndices.push_back(Index);

    // 从所有组件池中移除该实体
    for (auto& [type, pool] : _pools) {
        pool->Remove(e);
    }
}

bool World::IsAlive(FEntity e) const {
    if (IsInvalidEntity(e)) return false;
    FEntityIndex Index = GetEntityIndex(e);
    if (Index >= _EntityRecords.size()) return false;
    const auto& Record = _EntityRecords[Index];
    return Record.Alive && (GetEntityVersion(e) == Record.Version);
}

size_t World::AliveEntityCount() const {
    return _AliveEntityCount;
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
