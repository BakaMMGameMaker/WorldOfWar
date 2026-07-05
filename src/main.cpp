#include <cstdio>

#include "Canvas/CanvasConfig.h"
#include "ECS/Core/World.h"
#include "ECS/Components/BaseComponents.h"
#include "ECS/Components/CombatComponents.h"
#include "ECS/Components/MiscComponents.h"
#include "ECS/Components/MotionComponents.h"

using namespace Game;

// ============================================================================
// 测试系统：遍历所有带 Transform + Health 的实体，打印信息
// ============================================================================
class DebugInfoSystem : public ECS::System {
   public:
    void Update(ECS::World& WorldRef, float DeltaTime) override {
        // View 查询：同时拥有 TransformComponent 和 HealthComponent 的实体
        auto entities =
            WorldRef.View<ECS::TransformComponent, ECS::HealthComponent>();
        printf("[ECS] 实体数量: %zu | dt=%.3f\n", entities.size(), DeltaTime);
        for (auto e : entities) {
            auto* t = WorldRef.GetComponent<ECS::TransformComponent>(e);
            auto* h = WorldRef.GetComponent<ECS::HealthComponent>(e);
            if (t && h) {
                printf("  - Entity %u: (%.0f, %.0f) HP=%.0f/%.0f\n",
                       e, t->X, t->Y, h->HP, h->MaxHP);
            }
        }
    }
};

int main() {
    printf("[C++] 帧缓冲: %dx%d\n",
           Canvas::GetCanvasWidth(),
           Canvas::GetCanvasHeight());

    // ========================================================================
    // ECS 框架自检
    // ========================================================================
    printf("[ECS] 自检开始\n");

    ECS::World world;

    // 注册测试系统
    world.AddSystem(std::make_unique<DebugInfoSystem>());

    // 创建测试实体 1：坦克（地面单位）
    ECS::Entity tank = world.CreateEntity();
    world.AddComponent<ECS::TransformComponent>(tank, {100.0f, 200.0f, 0.0f});
    world.AddComponent<ECS::HealthComponent>(tank, {1000.0f, 1000.0f});
    world.AddComponent<ECS::TeamComponent>(
        tank, {ECS::Side::Blue, ECS::INVALID_ENTITY});
    world.AddComponent<ECS::GroundMotionComponent>(tank);
    world.AddComponent<ECS::MotionParamsComponent>(
        tank, {/*MaxSpeed=*/50.0f, /*Accel=*/10.0f, /*AngMaxSpeed=*/2.0f,
               /*AngAccel=*/0.5f});
    world.AddComponent<ECS::CombatComponent>(
        tank, {/*Damage=*/200.0f, /*AttackRange=*/500.0f, /*ReloadTime=*/2.0f,
               /*BulletSpeed=*/1500.0f});
    world.AddComponent<ECS::TurretComponent>(tank);
    world.AddComponent<ECS::CollisionComponent>(tank, {40.0f});
    world.AddComponent<ECS::DomainComponent>(tank, {ECS::DomainType::Ground});

    // 创建测试实体 2：无人机（空中单位）
    ECS::Entity drone = world.CreateEntity();
    world.AddComponent<ECS::TransformComponent>(drone, {300.0f, 400.0f, 0.0f});
    world.AddComponent<ECS::HealthComponent>(drone, {20.0f, 20.0f});
    world.AddComponent<ECS::TeamComponent>(
        drone, {ECS::Side::Blue, ECS::INVALID_ENTITY});
    world.AddComponent<ECS::AirMotionComponent>(drone);
    world.AddComponent<ECS::MotionParamsComponent>(
        drone, {/*MaxSpeed=*/300.0f, /*Accel=*/400.0f,
                /*AngMaxSpeed=*/0.0f, /*AngAccel=*/0.0f,
                /*TurnSensitivity=*/5.0f});
    world.AddComponent<ECS::CombatComponent>(
        drone, {/*Damage=*/500.0f, /*AttackRange=*/600.0f, /*ReloadTime=*/0.0f,
               /*BulletSpeed=*/0.0f});
    world.AddComponent<ECS::CollisionComponent>(drone, {20.0f});
    world.AddComponent<ECS::DomainComponent>(drone, {ECS::DomainType::Air});

    printf("[ECS] 存活实体: %zu\n", world.EntityCount());

    // 组件查询验证
    printf("[ECS] HasComponent 检查:\n");
    printf("  tank has Health: %d\n",
           world.HasComponent<ECS::HealthComponent>(tank));
    printf("  tank has AirMotion: %d\n",
           world.HasComponent<ECS::AirMotionComponent>(tank));
    printf("  drone has AirMotion: %d\n",
           world.HasComponent<ECS::AirMotionComponent>(drone));

    // View 查询验证
    auto groundUnits =
        world.View<ECS::TransformComponent, ECS::GroundMotionComponent>();
    printf("[ECS] 地面单位: %zu\n", groundUnits.size());

    auto airUnits =
        world.View<ECS::TransformComponent, ECS::AirMotionComponent>();
    printf("[ECS] 空中单位: %zu\n", airUnits.size());

    // 执行系统更新
    world.Update(0.016f);

    // 销毁实体测试
    world.DestroyEntity(tank);
    printf("[ECS] 销毁 tank 后存活: %zu\n", world.EntityCount());
    printf("[ECS] tank 是否存活: %d\n", world.IsAlive(tank));
    printf("[ECS] drone 是否存活: %d\n", world.IsAlive(drone));

    printf("[ECS] 自检完成\n");
    printf("[C++] 等待 JS 渲染循环启动...\n");
    return 0;
}
