#include "Entity/Entity.h"

namespace Game {
namespace ECS {

namespace {
    constexpr Entity   INDEX_MASK     = GetMaxEntities() - 1;
    constexpr uint32_t VERSION_SHIFT  = 24;
    constexpr uint32_t VERSION_MASK   = 0xFF;
} // namespace

Entity MakeEntity(EntityIndex Index, EntityVersion Version) {
    return (Index & INDEX_MASK) | ((Version & VERSION_MASK) << VERSION_SHIFT);
}

EntityIndex GetEntityIndex(Entity E) {
    return E & INDEX_MASK;
}

EntityVersion GetEntityVersion(Entity E) {
    return (E >> VERSION_SHIFT) & VERSION_MASK;
}

}  // namespace ECS
}  // namespace Game
