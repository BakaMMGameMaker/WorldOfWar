#include "Entity/Entity.h"

namespace Game {
namespace ECS {

Entity MakeEntity(uint32_t Index, uint32_t Version) {
    return (Index & INDEX_MASK) | ((Version & VERSION_MASK) << VERSION_SHIFT);
}

uint32_t GetEntityIndex(Entity E) {
    return E & INDEX_MASK;
}

uint32_t GetEntityVersion(Entity E) {
    return (E >> VERSION_SHIFT) & VERSION_MASK;
}

}  // namespace ECS
}  // namespace Game
