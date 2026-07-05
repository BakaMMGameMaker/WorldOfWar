#pragma once
#include <cstdint>

/// ECS 实体类型定义
/// 低 24 位为索引，高 8 位为版本号（防悬空指针）

namespace Game {
namespace ECS {

using Entity = uint32_t;

constexpr Entity INVALID_ENTITY = 0;
constexpr Entity MAX_ENTITIES    = 1u << 24;  // 约 1677 万
constexpr Entity INDEX_MASK      = MAX_ENTITIES - 1;
constexpr uint32_t VERSION_SHIFT = 24;
constexpr uint32_t VERSION_MASK  = 0xFF;

/// 从索引+版本构造实体 ID
inline Entity MakeEntity(uint32_t Index, uint32_t Version) {
    return (Index & INDEX_MASK) | ((Version & VERSION_MASK) << VERSION_SHIFT);
}

/// 提取实体索引
inline uint32_t GetEntityIndex(Entity E) {
    return E & INDEX_MASK;
}

/// 提取实体版本
inline uint32_t GetEntityVersion(Entity E) {
    return (E >> VERSION_SHIFT) & VERSION_MASK;
}

}  // namespace ECS
}  // namespace Game
