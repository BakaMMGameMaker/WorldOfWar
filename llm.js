class BattlefieldReporter {
    constructor(side) {
        this.side = side;
        this.reportInterval = 2000000; // 20 秒总结一次
        this.timer = 0;
        this.isWaitingForAI = false;
        this.fort = side === 'blue' ? blueFortress : redFortress;

        // 延迟计算
        this.totalResponseTime = 0; // 累计等待总时长
        this.responseCount = 0;     // 成功响应的总次数
    }
    parseTargets(unitClass) {
        const targets = unitClass.allowedTargets || [];
        if (targets.length === 0) return '無';
        return targets.map(cls => CONFIG.TYPE_NAMES[cls.name] || cls.name).join(', ');
    }
    getGameRules() {
        const tableRows = Object.keys(CONFIG.UNIT_STATS).map(id => {
            const s = CONFIG.UNIT_STATS[id];
            const f = (val) => (val === null || val === undefined) ? '-' : val;
            const targetDesc = this.parseTargets(s.class);
            const nameWithClass = `${s.name} (${s.class.name})`;
            return `| ${nameWithClass} | ${s.cost} | ${s.hp} | ${s.maxSpeed} | ${s.attackRange} | ${f(s.damage)} | ${f(s.reloadTime)}${s.reloadTime ? 's' : ''} | ${f(s.bulletSpeed)} | ${targetDesc} | ${s.desc} |`;
        }).join('\n');
        return `
# 战场指挥官系统指令集
你现在是战场指挥系统 AI。每 ${this.reportInterval} 秒，你会收到来自前线分析员发送的 JSON 格式战况。你需要分析战局，部署单位并下达指令，最终摧毁敌方要塞。

## 1. 环境参数
- 战场尺寸: ${CONFIG.worldWidth} x ${CONFIG.worldHeight}。
- 阵营: 你指挥 [${this.side.toUpperCase()}] 阵营。
- 要塞坐标: 蓝方要塞 (0, ${CONFIG.worldHeight / 2}), 红方要塞 (${CONFIG.worldWidth}, ${CONFIG.worldHeight / 2})。
- 要塞属性: HP ${CONFIG.maxHp}, 最大行动值(AP) ${CONFIG.maxAp}, AP 恢复速率: ${CONFIG.apRegenPerSecond} AP/sec。

## 2. 兵种数据手册
| 兵种 | AP | HP | 移速 | 射程 | 伤害 | 装填时间 | 子弹速度 | 可进攻目标 | 兵种描述 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows}

## 3. 单位 AI 行为逻辑 (优先级从高到低)
单位在每一时刻仅执行一个最高优先级的行为。下达新指令会立即中断并清除当前正在执行的低优先级指令。

1. **移动 (Move Order)**:
   - 收到坐标指令时，单位全力向目标点移动。 
   - **互斥性**: 进入“移动”会立即清除“锁定”和“跟随”状态。
   - **停止**: 到达目标点附近后进入待机状态。
2. **锁定 (Lock-on/Cmd Target)**:
   - 收到敌军 ID 指令时，持续追逐指定 ID 的敌军，直至敌军进入射程并开火，或者自身接触敌军并爆炸。
   - **持久性**: 除非自身收到新指令或自身死亡，或者目标不可见或目标死亡，否则单位将持续追逐目标。
   - **互斥性**: 进入“锁定”会立即清除“移动”和“跟随”状态。
   - **载具特性**: 拥有炮管的单位在开火前，炮塔需要一定的旋转瞄准时间。若目标移动过快，可能无法精确射击。
3. **跟随 (Follow)**:
   - 单位与友方领头保持一定距离并同步移动直至单位接收到新指令或者领头死亡。
   - **互斥性**: 进入“跟随”会立即清除“移动”和“锁定”状态。
   - **协同攻击**: 跟随者会尝试攻击“领头单位”正在攻击的目标。若目标不在射程内，跟随者不会独自冲锋，而是优先保持队形。
4. **扫描 (Auto Scan/Idle)**:
   - 某些单位会自动扫描射程内的敌军并攻击。敌军优先级为：要塞指定的敌军 > 单位扫描到的敌军 > 领队正在攻击的敌军

## 4. 指令输出规范 (JSON Actions)
- 你必须输出一个包含"thoughts"字符串与"actions"数组且不含 Markdown 标签的 JSON 作为指令。 "thoughts"用来描述你目前的战术考量, "actions"用来存放你下达的所有指示。
- "actions"可以为空数组，此时效果相当于攒行动值。你需要最大化利用行动值，避免行动值达到容量上限。
- 你下达的所有指令会以${this.fort.commandInterval}秒的间隔依次执行，而非瞬间全部执行。

### 指令类型：
1. **DEPLOY (部署)**: { "cmd": "DEPLOY", "type": "兵种类型（见availableTypes）", "target": 坐标或单位 ID }。如果部署时 target 为单位 ID，将直接进入跟随状态或锁定状态。
2. **ORDER (集结/重定向)**: { "cmd": "ORDER", "id": 单位ID, "target": 坐标或单位 ID }

## 5.目标 (target) 类型说明:
- 坐标: { "x": number, "y": number }
- 单位: 数字 ID。**你必须选择「可进攻目标」内的类型作为攻击目标。**否则指令会被拦截。

### A. 当目标是「坐标 {x, y}」时：
1. **锁定**: 如果坐标落在「敌方要塞」范围内，单位将进入锁定要塞的状态。
2. **移动**: 如果坐标是空地，单位将前往该点，到达后进入待机模式。
3. **检查**: 禁止锁定己方要塞坐标。

### B. 当目标是「单位 ID (数字)」时：
1. **跟随 (FOLLOW)**: 如果 ID 是「友军」，单位将跟随该友军直至该友军死亡或者单位接收新指令。
2. **锁定 (ATTACK)**: 如果 ID 是「敌军」，单位将锁定并持续追击该敌军直至一方死亡。
3. **检查**: 如果该兵种无法攻击目标类型（见「可进攻目标」），指令将被拦截。

### 目标 (target) 示例：
- 指定坐标: \`{ "x": 100, "y": 200 }\`
- 指定单位: \`105\` (直接填写数字 ID)

## 6. 数据条目定义
在前线分析员发送的 JSON 数据中：
- gameTime: 当前的游戏时长 [分分:秒秒]
- currentRoundIndex: 当前你的行动轮次
- fortress: 你的要塞数据，包含生命值与行动值
- availableTypes/lockedTypes: 你当前已解锁/未解锁的兵种类型
- allies/enemies: 友军与敌军列表。你只能取得少量有关敌军单位的信息
- history: 包含你过去${this.fort.maxHistoryRounds}次决策的内容与执行结果
- events: 包含
- avgResponseTime: 过去轮次中从游戏端发送消息到你下达指令的平均延迟
- targetPos: 移动指令的目标坐标
- cmdTargetId: 你为单位下达的锁定目标 ID
- autoTargetId: 单位 AI 自动扫描并锁定的目标 ID
- followTargetId: 单位正在跟随的队友 ID

## 7. 战术建议
- 不要让单位单打独斗。善用跟随状态有利于你节省指令或保护重要单位。例如让霰弹手跟随狙击手可以减少狙击手被敌方无人机摧毁的可能性，且移动狙击手时无需为霰弹手下达额外指令。
- 避免让无人机与霰弹手正面交锋。通过先指定敌人侧后方的目标点，再尝试绕后突袭敌军可以提升无人机的进攻成功率。
- "actions" 为空数组时意味着你打算攒行动值；但你需要最大化利用行动值，避免行动值到达上限。
- 战场局势风云变幻，所以不要过分参考历史轮次的战略考量以及指令。
- 善用 avgResponseTime 有助于你估计本轮次中某条指令被执行时你的行动值。
`;
    }
    getTargetId(target) {
        if (!target || target.unitId === undefined) return null;
        return target.unitId;
    }
    getSummary(units) {
        const fort = this.fort;
        const avgRes = this.responseCount > 0 ? (this.totalResponseTime / this.responseCount) : 0.0;

        units.concat([blueFortress, redFortress]).forEach(u => {
            // todo: 其实可以知道敌军也在受伤的吧？
            if (u.side === this.side && u.damageMap.size > 0) {
                u.damageMap.forEach((data, attackerId) => {
                    eventManager.addEvent({
                        type: 'UNDER_ATTACK',
                        victimId: u.unitId,
                        attackerId: attackerId,
                        totalDamage: Math.floor(data.total),
                        lastAttackTime: data.lastTime
                    });
                });
                u.damageMap.clear();
            }
        });

        eventManager.nextRound(fort.roundCounter);

        const history = fort.historyRounds.map(round => ({
            round: round.roundIndex,
            thoughts: round.thoughts,
            executed_actions: round.actions.map(a => {
                const { _index, result, ...cmdParams } = a;
                return { id: _index, params: cmdParams, outcome: result };
            })
        }));

        const summary = {
            gameTime: formatGameTime(getGameDuration()),
            currentRoundIndex: fort.roundCounter,
            fortress: { hp: Math.floor(fort.hp), ap: Math.floor(fort.ap) },
            techStatus: {
                availableTypes: Object.keys(CONFIG.UNIT_STATS),
                lockedTypes: [] // 預留給未來研究院機制
            },
            allies: [],              // 全发，否则 LLM 以后会遗忘自己的单位
            enemies: [],             // 目前全发，以后可只发送可见的敌方单位以及位于自身单位攻击范围内的敌方单位
            history: history,        // 记录过去的 thoughs, actions with result
            events: eventManager.getHistory(),              // 记录过去 4 轮内发生的事件，如友方士兵/建筑受击/死亡原因
            memory: [],              // 持久化记录一定数量的 AI 认为十分重要的 event（核心记忆）
            suggestions: [],         // 上次行动对本轮行动所提出的建议，本轮行动根据局势来选择是否遵循建议
            avgResponseTime: Math.round(avgRes * 100) / 100,  // LLM 的平均响应时间，计算从发送出去到最终执行的平均时间，用于为 LLM 提前出牌
        };
        units.forEach(u => {
            if (!u.alive) return;

            const physics = {};
            if (u.domain === 'AIR') {
                physics.vx = Math.round(u.vx * 100) / 100; physics.vy = Math.round(u.vy * 100) / 100;
            } else {
                physics.vel = Math.round(u.vel * 100) / 100; physics.angle = Math.round(u.angle * 100) / 100;
            }

            const unitData = {
                id: u.unitId,
                type: u.constructor.name,
                x: Math.floor(u.x),
                y: Math.floor(u.y),
                ...physics // 添加物理数据
            };

            if (u.side === this.side) { // 友军额外信息
                Object.assign(unitData, {
                    hp: Math.floor(u.hp),
                    targetPos: u.targetPos,
                    cmdTargetId: this.getTargetId(u.cmdTarget),
                    autoTargetId: this.getTargetId(u.autoTarget),
                    followTargetId: this.getTargetId(u.followTarget)
                });
                summary.allies.push(unitData);
            } else {
                summary.enemies.push(unitData);
            }
        });
        console.log(summary);
        return summary;
    }
    update(dt, units) {
        this.timer += dt;
        if (this.fort.alive && this.timer >= this.reportInterval && !this.isWaitingForAI) {
            this.timer = 0;
            this.sendToLLM(this.getSummary(units));
        }
    }
    async sendToLLM(summaryData) {
        if (this.isWaitingForAI) return;
        this.isWaitingForAI = true;

        uiManager.add("戰術數據同步中...", "#00f2ff");
        const requestStartTime = Date.now();

        try {
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer sk-?`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        { role: "system", content: this.getGameRules() },
                        { role: "user", content: JSON.stringify(summaryData) }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            const completion = await response.json();
            const content = completion.choices[0].message.content;
            redFortress.enqueueCommands(content);

            const duration = (Date.now() - requestStartTime) / 1000;
            this.totalResponseTime += duration; this.responseCount++;
        } catch (error) {
            console.log(error);
            uiManager.add("戰術鏈路丟失!", "#ff4444");
        } finally {
            this.isWaitingForAI = false;
        }
    }
}
const reporter = new BattlefieldReporter('red');

class EventManager {
    constructor(maxRounds) {
        this.maxRounds = maxRounds;
        this.roundEvents = [];
        this.currentEvents = [];
    }

    nextRound(roundIndex) {
        if (this.currentEvents.length > 0) this.roundEvents.push({ round: roundIndex, data: [...this.currentEvents] });
        if (this.roundEvents.length > this.maxRounds) this.roundEvents.shift();
        this.currentEvents = [];
    }

    addEvent(event) { this.currentEvents.push({ time: formatGameTime(getGameDuration()), ...event }); }

    getHistory() { return this.roundEvents; }
}

const eventManager = new EventManager(redFortress.maxHistoryRounds);

class Fortress {
    constructor() {
        this.historyRounds = [];     // 存放历史轮次的索引，战术考量与指令执行结果
        this.roundCounter = 0;       // 全局回合计数
        this.maxHistoryRounds = 4;   // 保留最近 4 轮记录
        this.commandQueue = [];      // 待执行指令队列
        this.commandTimer = 0;       // 指令执行计数器
        this.commandInterval = 0.8;  // 指令执行间隔
    }
    enqueueCommands(jsonActions) {
        if (!this.alive) return;
        try {
            const data = typeof jsonActions === 'string' ? JSON.parse(jsonActions) : jsonActions;

            const newRound = {
                roundIndex: this.roundCounter,
                thoughts: data.thoughts || "無戰術描述",
                actions: [] // 存放带有执行结果的 action
            };

            this.roundCounter++;

            if (data.actions && Array.isArray(data.actions)) {
                data.actions.forEach((action, i) => {
                    const actionEntry = {
                        ...action,
                        _index: i + 1,  // 1-based
                        result: "等待執行..."
                    };
                    newRound.actions.push(actionEntry);
                    this.commandQueue.push(actionEntry);
                });
            }
            this.historyRounds.push(newRound);
            if (this.historyRounds.length > this.maxHistoryRounds) this.historyRounds.shift();
        } catch (e) {
            console.log(`JSON 解析失敗`);
        }
    }

    executeSingleCommand(actionEntry, timeStr) {
        let result = "";
        try {
            switch (actionEntry.cmd) {
                case 'DEPLOY': result = this.executeAiDeploy(actionEntry.type, actionEntry.target); break;
                case 'ORDER': result = this.executeAiOrder(actionEntry.id, actionEntry.target); break;
                case undefined: result = `解析失败，缺少 cmd 条目`; break;
                default: result = `执行失败：未知指令 "${actionEntry.cmd}"`;
            }
        } catch (err) {
            result = `核心执行崩溃：${err.message}`;
        }
        actionEntry.result = `[指令 #${actionEntry._index || '?'}] [分:秒 ${timeStr}] ${result}`; // 回填执行结果
    }

    inferTask(unitClass, targetRef) {
        // 不能 !targetRef，因为单位 ID 可能是 0
        if (targetRef === null || targetRef === undefined) return { ok: false, reason: '未指定 target' };
        // 坐标
        if (typeof targetRef === 'object' && targetRef.x !== undefined && targetRef.y !== undefined) {
            const { x: tx, y: ty } = targetRef;
            for (let f of allForts) {
                if (Math.hypot(tx - f.x, ty - f.y) > CONFIG.fortressSizes[0]) continue;
                if (f.side === this.side) return { ok: false, reason: '禁止锁定己方要塞' };
                if (!BaseUnit.canClassAttack(unitClass, f)) return { ok: false, reason: '该兵种无法攻击要塞' };
                return { ok: true, task: 'ATTACK', finalTarget: f };
            }
            return { ok: true, task: 'MOVE', finalTarget: { x: tx, y: ty } };
        }
        // ID 判定
        const targetEntity = worldEntities.get(targetRef);
        if (!targetEntity || !targetEntity.alive) return { ok: false, reason: `目标 ${targetRef} 不存在或已阵亡` };

        if (targetEntity.side === this.side) return { ok: true, task: 'FOLLOW', finalTarget: targetEntity };
        if (!BaseUnit.canClassAttack(unitClass, targetEntity)) return { ok: false, reason: `该兵种无法攻击目标类型: ${target.constructor.name}` };
        return { ok: true, task: 'ATTACK', finalTarget: targetEntity };
    }

    executeAiDeploy(unitTypeId, targetRef) {
        const stats = CONFIG.UNIT_STATS[unitTypeId];
        if (!stats) return `失敗：兵種 ${unitTypeId} 不存在`; // todo: 未解鎖
        if (this.ap < stats.cost) return `失敗：行動值不足 (需 ${stats.cost})`;

        // 验证
        const inference = this.inferTask(stats.class, targetRef);
        if (!inference.ok) return `部署攔截：${inference.reason}`;

        this.ap -= stats.cost;
        const newUnit = new stats.class(this);
        const resultDesc = this.applyTargetToUnit(newUnit, inference.task, inference.finalTarget);
        units.push(newUnit);

        uiManager.add(`[AI] 部署 ${stats.name}`, this.colorTheme); // todo: 仅调试
        return `成功：已投入 ${stats.name} (ID: ${newUnit.unitId})，意圖：${resultDesc}`;
    }

    executeAiOrder(unitId, targetRef) {
        const unit = worldEntities.get(unitId);
        if (!unit || unit.side !== this.side || !unit.alive) return `失敗：找不到 ID 為 ${unitId} 的存活友軍`;

        // 验证
        const inference = this.inferTask(unit.constructor, targetRef);
        if (!inference.ok) return `指令拒絕：${inference.reason}`;

        const resultDesc = this.applyTargetToUnit(unit, inference.task, inference.finalTarget);
        return `成功：單位 ${unitId} 已響應，意圖：${resultDesc}`;
    }

    applyTargetToUnit(unit, task, finalTarget) {
        unit.resetState();
        switch (task) {
            case 'MOVE':
                unit.targetPos = { x: finalTarget.x, y: finalTarget.y };
                return `移至坐標 (${Math.floor(unit.targetPos.x)}, ${Math.floor(unit.targetPos.y)})`;
            case 'ATTACK':
                unit.cmdTarget = finalTarget;
                const name = (finalTarget instanceof Fortress) ? '敵軍要塞' : `敵方單位 ${finalTarget.unitId}`;
                return `正在進攻 ${name}`;
            case 'FOLLOW':
                unit.followTarget = finalTarget;
                return `跟隨友方單位 ${finalTarget.unitId}`;
            default:
                return '進入待機模式';
        }
    }
    update() {
        // 执行队列指令
        if (this.isAI && this.alive && this.commandQueue.length > 0) {
            this.commandTimer += dt;
            if (this.commandTimer >= this.commandInterval) {
                const action = this.commandQueue.shift();
                const timeStr = formatGameTime(getGameDuration());
                this.executeSingleCommand(action, timeStr);
                this.commandTimer = 0;
            }
        }
    }
}

function formatGameTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `[${m}:${s}]`;
}

const CONFIG = {
    width: 1200,        // 视口宽度
    height: 800,        // 视口高度
    worldWidth: 6000,   // 战场宽度
    worldHeight: 4000,  // 战场宽度
    maxHp: 10000,
    maxAp: 300,
    apRegenPerSecond: 5,
    fortressSizes: [80, 50],

    cardWidth: 140, cardHeight: 50,

    TYPE_NAMES: { // 给 AI 看的，不繁体
        'Fortress': '要塞',
        'VehicleUnit': '载具',
        'DroneUnit': '无人机',
        'SniperUnit': '狙击手',
        'ShotgunUnit': '霰弹手',
        'BaseUnit': '所有单位',
    },
    UNIT_STATS: {
        sniper: {
            class: SniperUnit, name: '狙擊手',
            cost: 50, hp: 1000, maxSpeed: 50, attackRange: 500,
            damage: 200, reloadTime: 2.0, bulletSpeed: 1200,
            desc: '地面载具单位，提供远程火力，擅长后方狙击要塞与重型单位。不会自动扫描敌军。'
        },
        drone: {
            class: DroneUnit, name: '無人機',
            cost: 30, hp: 20, maxSpeed: 300, attackRange: 600,
            damage: 600, reloadTime: null, bulletSpeed: null,
            desc: '空中飞行单位，自杀式袭击，触碰目标即引爆。不会自动扫描敌军。'
        },
        shotgun: {
            class: ShotgunUnit, name: '霰彈兵',
            cost: 40, hp: 250, maxSpeed: 160, attackRange: 250,
            damage: 20, reloadTime: 1.0, bulletSpeed: 800,
            desc: '地面载具单位，提供近战压制，扇形发射4枚弹丸，无人机的克星。会自动扫描范围内敌军。'
        },
    },
};
