#include <cstdio>

#include "CanvasConfig.h"
#include "World/World.h"
#include "Components/BaseComponents.h"
#include "Components/CombatComponents.h"
#include "Components/MotionComponents.h"

using namespace game;

// ============================================================================
// 测试系统：遍历所有带 transform + health 的实体，打印信息
// ============================================================================
class debug_info_system : public ecs::system {
   public:
    void update(ecs::world& w, float dt) override {
        // view 查询：同时拥有 transform 和 health 的实体
        auto entities = w.view<ecs::transform, ecs::health>();
        printf("[ECS] 实体数量: %zu | dt=%.3f\n", entities.size(), dt);
        for (auto e : entities) {
            auto* t = w.get_component<ecs::transform>(e);
            auto* h = w.get_component<ecs::health>(e);
            if (t && h) {
                printf("  - Entity %u: (%.0f, %.0f) HP=%.0f/%.0f\n",
                       e, t->x_, t->y_, h->hp_, h->maxhp_);
            }
        }
    }
};

int main() {
    printf("[C++] 帧缓冲: %dx%d\n",
           canvas::get_canvas_width(),
           canvas::get_canvas_height());

    // ========================================================================
    // ECS 框架自检
    // ========================================================================
    printf("[ECS] 自检开始\n");

    ecs::world w;

    // 注册测试系统
    w.add_system(std::make_unique<debug_info_system>());

    // 创建测试实体 1：坦克（地面单位）
    ecs::entity_t tank = w.create_entity();
    w.add_component<ecs::transform>(tank, {100.0f, 200.0f, 0.0f});
    w.add_component<ecs::health>(tank, {1000.0f, 1000.0f});
    w.add_component<ecs::team>(tank, {ecs::eteam::blue, ecs::get_invalid_entity()});
    w.add_component<ecs::ground_motion>(tank);
    w.add_component<ecs::motion_config>(
        tank, {/*max_speed=*/50.0f, /*accel=*/10.0f, /*max_angle_vel=*/2.0f,
               /*angle_accel=*/0.5f});
    w.add_component<ecs::combat>(
        tank, {/*damage=*/200.0f, /*attack_range=*/500.0f, /*reload_time=*/2.0f,
               /*bullet_speed=*/1500.0f});
    w.add_component<ecs::turret>(tank);
    w.add_component<ecs::collision>(tank, {40.0f});
    w.add_component<ecs::domain>(tank, {ecs::edomain::ground});

    // 创建测试实体 2：无人机（空中单位）
    ecs::entity_t drone = w.create_entity();
    w.add_component<ecs::transform>(drone, {300.0f, 400.0f, 0.0f});
    w.add_component<ecs::health>(drone, {20.0f, 20.0f});
    w.add_component<ecs::team>(drone, {ecs::eteam::blue, ecs::get_invalid_entity()});
    w.add_component<ecs::air_motion>(drone);
    w.add_component<ecs::motion_config>(
        drone, {/*max_speed=*/300.0f, /*accel=*/400.0f,
                /*max_angle_vel=*/0.0f, /*angle_accel=*/0.0f,
                /*turn_sensitivity=*/5.0f});
    w.add_component<ecs::combat>(
        drone, {/*damage=*/500.0f, /*attack_range=*/600.0f, /*reload_time=*/0.0f,
               /*bullet_speed=*/0.0f});
    w.add_component<ecs::collision>(drone, {20.0f});
    w.add_component<ecs::domain>(drone, {ecs::edomain::air});

    printf("[ECS] 存活实体: %u\n", w.get_alive_entity_count());

    // 组件查询验证
    printf("[ECS] has_component 检查:\n");
    printf("  tank has health: %d\n", w.has_component<ecs::health>(tank));
    printf("  tank has air_motion: %d\n", w.has_component<ecs::air_motion>(tank));
    printf("  drone has air_motion: %d\n", w.has_component<ecs::air_motion>(drone));

    // view 查询验证
    auto ground_units = w.view<ecs::transform, ecs::ground_motion>();
    printf("[ECS] 地面单位: %zu\n", ground_units.size());

    auto air_units = w.view<ecs::transform, ecs::air_motion>();
    printf("[ECS] 空中单位: %zu\n", air_units.size());

    // 执行系统更新
    w.update(0.016f);

    // 销毁实体测试
    w.destroy_entity(tank);
    printf("[ECS] 销毁 tank 后存活: %u\n", w.get_alive_entity_count());
    printf("[ECS] tank 是否存活: %d\n", w.is_alive(tank));
    printf("[ECS] drone 是否存活: %d\n", w.is_alive(drone));

    printf("[ECS] 自检完成\n");
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
