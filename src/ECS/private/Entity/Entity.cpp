#include "Entity/Entity.h"

namespace Game {
namespace ECS {

namespace {
    constexpr FEntity   INDEX_MASK     = GetMaxEntities() - 1;
    constexpr uint32_t VERSION_SHIFT  = 24;
    constexpr uint32_t VERSION_MASK   = 0xFF;
} // namespace

FEntity MakeEntity(FEntityIndex Index, FEntityVersion Version) {
    return (Index & INDEX_MASK) | ((Version & VERSION_MASK) << VERSION_SHIFT);
}

FEntityIndex GetEntityIndex(FEntity E) {
    return E & INDEX_MASK;
}

FEntityVersion GetEntityVersion(FEntity E) {
    return (E >> VERSION_SHIFT) & VERSION_MASK;
}

}  // namespace ECS
}  // namespace Game
