#include "Entity/Entity.h"

namespace game {
namespace ecs {

namespace {
    constexpr entity_t INDEX_MASK     = get_max_entities() - 1;
    constexpr uint32_t VERSION_SHIFT  = 24;
    constexpr uint32_t VERSION_MASK   = 0xFF;
} // namespace

entity_t make_entity_with(entity_index_t index, entity_version_t version) {
    return (index & INDEX_MASK) | ((version & VERSION_MASK) << VERSION_SHIFT);
}

entity_index_t get_entity_index(entity_t e) {
    return e & INDEX_MASK;
}

entity_version_t get_entity_version(entity_t e) {
    return (e >> VERSION_SHIFT) & VERSION_MASK;
}

}  // namespace ecs
}  // namespace game
