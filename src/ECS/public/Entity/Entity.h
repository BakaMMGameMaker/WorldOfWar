#pragma once
#include <cstdint>

/// ECS 实体类型定义
/// 低 24 位为索引，高 8 位为版本号（防悬空指针）

namespace Game {
namespace ECS {

using FEntity        = uint32_t;
using FEntityIndex   = uint32_t;
using FEntityVersion = uint32_t;

/// 最大实体数量（索引上限 = 2^24 ≈ 1677 万）
inline constexpr uint32_t GetMaxEntities() { return 1u << 24; }

/// 无效实体句柄（索引 0 保留）
inline constexpr FEntity GetInvalidEntity() { return 0; }

/// 判断实体是否为无效句柄
inline constexpr bool IsInvalidEntity(FEntity E) { return E == GetInvalidEntity(); }

/// 从索引+版本构造实体 ID
FEntity MakeEntity(FEntityIndex Index, FEntityVersion Version);

/// 提取实体索引
FEntityIndex GetEntityIndex(FEntity E);

/// 提取实体版本
FEntityVersion GetEntityVersion(FEntity E);

}  // namespace ECS
}  // namespace Game
