#include "World/World.h"
#include "Entity/Entity.h"

namespace game {
namespace ecs {

world::world() {
    // 保留索引 0 为无效实体
    entity_records_.emplace_back();
}

world::~world() = default;

entity_t world::create_entity() {
    entity_index_t entity_index;

    if (!free_entity_indices_.empty()) {
        // 复用已释放的索引
        entity_index = free_entity_indices_.back();
        free_entity_indices_.pop_back();
        entity_records_[entity_index].increase_version();  // 递增版本号，使旧引用失效
    } else {
        // 分配新索引
        entity_index = static_cast<entity_index_t>(entity_records_.size());
        if (entity_index >= get_max_entities()) return get_invalid_entity();  // 超出上限
        entity_records_.emplace_back();  // alive=false, version=0
    }

    entity_record& record = entity_records_[entity_index];
    record.set_alive(true);
    alive_entity_count_++;

    return make_entity_with(entity_index, record.get_version());
}

void world::destroy_entity(entity_t entity) {
    if (!is_alive(entity)) return;

    entity_index_t idx = get_entity_index(entity);
    entity_records_[idx].set_alive(false);
    alive_entity_count_--;
    free_entity_indices_.push_back(idx);

    // 从所有组件池中移除该实体
    for (auto& [type, pool] : component_pools_) {
        pool->remove_component_for(entity);
    }
}

bool world::is_alive(entity_t entity) const {
    if (is_invalid_entity(entity)) return false;
    entity_index_t idx = get_entity_index(entity);
    if (idx >= entity_records_.size()) return false;
    const auto& record = entity_records_[idx];
    return record.is_alive() && (get_entity_version(entity) == record.get_version());
}

entity_count_t world::get_alive_entity_count() const {
    return alive_entity_count_;
}

void world::add_system(std::unique_ptr<system> sys) {
    if (!sys) return;
    pending_systems_.push_back(std::move(sys));
    has_pending_systems_ = true;
}

void world::flush_pending_systems() {
    if (!has_pending_systems_) return;
    for (auto& sys : pending_systems_) {
        sys->on_create(*this);
        active_systems_.push_back(sys.get());
    }
    pending_systems_.clear();
    has_pending_systems_ = false;
}

void world::update(float dt) {
    flush_pending_systems();
    for (auto* sys : active_systems_) {
        sys->update(*this, dt);
    }
}

}  // namespace ecs
}  // namespace game
