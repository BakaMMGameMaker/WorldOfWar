#pragma once

#include <cstdint>
/// ECS 实体类型定义
/// 低 24 位为索引，高 8 位为版本号（防悬空指针）

namespace game {
namespace ecs {

using entity_t         = uint32_t;
using entity_count_t   = uint32_t;
using entity_index_t   = uint32_t;
using entity_version_t = uint32_t;

/// 最大实体数量（索引上限 = 2^24 ≈ 1677 万）
inline constexpr entity_count_t get_max_entities() { return 1u << 24; }

/// 无效实体句柄（索引 0 保留）
inline constexpr entity_t get_invalid_entity() { return 0; }

/// 判断实体是否为无效句柄
inline constexpr bool is_invalid_entity(entity_t e) { return e == get_invalid_entity(); }

/// 从索引+版本构造实体 ID
entity_t make_entity_with(entity_index_t index, entity_version_t version);

/// 提取实体索引
entity_index_t get_entity_index(entity_t e);

/// 提取实体版本
entity_version_t get_entity_version(entity_t e);

}  // namespace ecs
}  // namespace game
