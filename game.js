// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BT_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    RUNNING: 'RUNNING'
};

class Node {
    tick(tickContext) { return BT_STATUS.FAILURE; }
}

class Sequence extends Node {
    constructor(children) {
        super();
        this.children = children;
    }
    tick(tickContext) {
        for (let child of this.children) {
            const status = child.tick(tickContext);
            if (status !== BT_STATUS.SUCCESS) return status;
        }
        return BT_STATUS.SUCCESS;
    }
}

class Selector extends Node {
    constructor(children) {
        super();
        this.children = children;
    }
    tick(tickContext) {
        for (let child of this.children) {
            const status = child.tick(tickContext);
            if (status !== BT_STATUS.FAILURE) return status;
        }
        return BT_STATUS.FAILURE;
    }
}

class Action extends Node {
    constructor(actionFn) {
        super();
        this.execute = actionFn;
    }
    tick(tickContext) {
        return this.execute(tickContext);
    }
}

class UnitCard {
    constructor(unit, x, y, owner) {
        this.unit = unit;
        this.x = x; this.y = y;
        this.w = CONFIG.cardWidth; this.h = CONFIG.cardHeight;
        this.owner = owner;
        this.state = 'DISABLED';
    }

    update() {
        const canAfford = this.owner.ap >= this.unit.cost;
        if (this.state === 'SELECTED') {
            if (!canAfford) this.state = 'DISABLED';
        } else {
            this.state = canAfford ? 'AVAILABLE' : 'DISABLED';
        }
    }

    checkClick(mx, my) {
        if (mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h) {
            if (this.state === 'SELECTED') {
                return { action: 'START_PLACING', unit: this.unit };
            } else if (this.state === 'AVAILABLE') {
                this.owner.cards.forEach(c => { if (c.state === 'SELECTED') c.state = 'AVAILABLE' });
                this.state = 'SELECTED';
                return { action: 'SELECTED' };
            }
        }
        return null;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        let textColor, borderColor, glow = 0;
        const mainBlue = '#3498db';
        const neonBlue = '#00f2ff';

        switch (this.state) {
            case 'AVAILABLE': textColor = mainBlue; borderColor = mainBlue; break;
            case 'DISABLED': textColor = '#666'; borderColor = mainBlue; break;
            case 'SELECTED': textColor = mainBlue; borderColor = neonBlue; glow = 15; break;
        }

        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(this.w - 10, 0); ctx.lineTo(this.w, 10);
        ctx.lineTo(this.w, this.h); ctx.lineTo(10, this.h); ctx.lineTo(0, this.h - 10);
        ctx.closePath();
        ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
        ctx.fill();

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = this.state === 'SELECTED' ? 3 : 1;
        ctx.shadowBlur = glow;
        ctx.shadowColor = borderColor;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = textColor;
        ctx.font = 'bold 16px "Microsoft JhengHei"';
        ctx.fillText(this.unit.name, 15, 22);
        ctx.font = '14px "Courier New"';
        ctx.fillText(`COST: ${this.unit.cost}`, 15, 40);
        ctx.restore();
    }
}

class Fortress {
    static FORTRESS_STATE = {
        NORMAL: 'NORMAL',
        SHOW_CARDS: 'SHOW_CARDS',
        PLACING: 'PLACING',
        COMMANDING: 'COMMANDING',
    };

    static AI = {
        // 寻找离要塞最近且未被锁定的敌对狙击手
        findTargetSniper: (ctx) => {
            const blueSnipers = units.filter(u => u.side === 'blue' && u.alive && u instanceof SniperUnit);
            const lockedTargets = units
                .filter(u => u.side === 'red' && u.getPriorityTarget())
                .map(u => u.getPriorityTarget()); // 找出已经被红方无人机锁定的狙击手

            let bestTarget = null;
            let minDist = Infinity;

            blueSnipers.forEach(s => {
                if (!lockedTargets.includes(s)) {
                    const d = Math.hypot(s.x - ctx.fortress.x, s.y - ctx.fortress.y);
                    if (d < minDist) {
                        minDist = d;
                        bestTarget = s;
                    }
                }
            });

            if (bestTarget) {
                ctx.blackboard.targetSniper = bestTarget;
                return BT_STATUS.SUCCESS;
            }
            return BT_STATUS.FAILURE;
        },

        // 检查是否有空闲无人机
        manageExistingDrones: (ctx) => {
            const idleDrones = units.filter(u =>
                u instanceof DroneUnit &&
                u.side === 'red' &&
                u.alive &&
                !u.getPriorityTarget()
            );
            if (idleDrones.length === 0) return BT_STATUS.FAILURE;
            const target = ctx.blackboard.targetSniper;
            idleDrones.forEach(drone => {
                drone.manualTarget = target;
            });
            return BT_STATUS.SUCCESS;
        },

        // 尝试部署新无人机
        tryDeployDrone: (ctx) => {
            const droneData = CONFIG.units.find(u => u.id === 'drone');
            const deployNum = 2;
            const deployCost = droneData.cost * deployNum;
            if (ctx.fortress.ap >= deployCost) {
                ctx.fortress.ap -= deployCost;
                const target = ctx.blackboard.targetSniper;
                // 生成两台
                for (let i = 0; i < deployNum; i++) {
                    const newDrone = new droneData.class(
                        'red',
                        target.x,
                        target.y,
                        ctx.fortress.colorTheme
                    );
                    newDrone.y += i * newDrone.collisionRadius - newDrone.collisionRadius / 2;
                    // 锁定目标
                    newDrone.manualTarget = target;
                    units.push(newDrone);
                }
                return BT_STATUS.SUCCESS;
            }
            return BT_STATUS.FAILURE;
        }
    };

    constructor(side, x, y, colorTheme) {
        this.side = side;
        this.x = x; this.y = y;
        this.hp = CONFIG.maxHp; this.alive = true;
        this.ap = 0;
        this.colorTheme = colorTheme;
        this.isAI = side === 'red';
        this.isAI = false;
        if (this.isAI) {
            this.blackboard = {};
            this.aiInterval = 0.5; // 决策频率 (0.5秒一次)
            this.aiTimer = 0;

            // 行为树
            this.btRoot = new Sequence([
                new Action(Fortress.AI.findTargetSniper), // 有目标狙击手
                new Selector([
                    new Action(Fortress.AI.manageExistingDrones), // 调度现有无人机
                    new Action(Fortress.AI.tryDeployDrone)        // 尝试部署
                ])
            ]);
        }
        else {
            this.state = Fortress.FORTRESS_STATE.NORMAL;
            this.selectedUnitData = null;
            this.selectedUnit = null;
            this.cards = CONFIG.units.map((u, index) => {
                const startX = 120;
                const startY = 300 + (index * 70);
                return new UnitCard(u, startX, startY, this);
            });
        }
    }

    think(dt) {
        if (!this.isAI || !this.alive) return;
        this.aiTimer += dt;
        if (this.aiTimer >= this.aiInterval) {
            this.aiTimer = 0;
            const ctx = {
                fortress: this,
                blackboard: this.blackboard
            };
            this.btRoot.tick(ctx);
        }
    }

    switchState(newState) {
        if (newState === Fortress.FORTRESS_STATE.NORMAL) {
            this.cards.forEach(card => {
                if (card.state === 'SELECTED') card.state = 'AVAILABLE';
            });
            if (this.selectedUnit) this.selectedUnit.isSelected = false;
            this.selectedUnit = null;
            this.selectedUnitData = null;
        }
        else if (newState === Fortress.FORTRESS_STATE.COMMANDING) {
            uiManager.add(`戰術單位已就緒`, this.colorTheme);
            this.selectedUnit.isSelected = true;
        }
        this.state = newState;
    }

    update(dt) {
        if (this.ap < CONFIG.maxAp) {
            this.ap += CONFIG.apRegenPerSecond * dt;
            if (this.ap > CONFIG.maxAp) this.ap = CONFIG.maxAp;
        }
        if (!this.isAI && this.state === Fortress.FORTRESS_STATE.SHOW_CARDS) {
            this.cards.forEach(card => card.update()); // 更新卡片
        }
    }

    takeDamage(amt) {
        this.hp -= amt;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
    }

    handleInput(mx, my, type, otherFortress) {
        const worldPos = screenToWorld(mx, my);
        const wx = worldPos.x;
        const wy = worldPos.y;
        const clickedSelf = this.isClicked(wx, wy);
        let isUIClicked = false;
        const allFortresses = [this, otherFortress];

        switch (this.state) {
            case Fortress.FORTRESS_STATE.NORMAL:
                if (type !== 'click') return false;
                // 点击要塞
                if (clickedSelf) {
                    this.switchState(Fortress.FORTRESS_STATE.SHOW_CARDS);
                    return true; // click self
                }
                // 点击己方单位
                for (let u of units) {
                    if (u.side === this.side && u.alive && Math.hypot(u.x - wx, u.y - wy) < 30) {
                        this.selectedUnit = u;
                        this.switchState(Fortress.FORTRESS_STATE.COMMANDING);
                        return true; // click unit
                    }
                }
                break;

            case Fortress.FORTRESS_STATE.SHOW_CARDS:
                if (type !== 'click' || clickedSelf) {
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return true; // click self
                }
                for (let card of this.cards) {
                    const result = card.checkClick(mx, my);
                    if (!result) continue;
                    isUIClicked = true;
                    if (result.action === 'START_PLACING') {
                        this.selectedUnitData = result.unit;
                        this.switchState(Fortress.FORTRESS_STATE.PLACING);
                        break;
                    }
                }
                break;

            case Fortress.FORTRESS_STATE.PLACING:
                if (type !== 'click') {
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return false;
                }
                // 点击要塞
                let targetFort = null;
                for (let f of allFortresses) {
                    if (!f.isClicked(wx, wy)) continue;
                    isUIClicked = true; // click fortress
                    if (f.side === 'blue') {
                        uiManager.add('禁止在我方要塞區域部署單位', '#ff4444');
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true; // click fortress
                    }
                    targetFort = f;
                }
                // 费用检查
                if (this.ap < this.selectedUnitData.cost) {
                    uiManager.add('行動值(AP)不足', '#ff4444');
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return true; // placing
                }
                this.ap -= this.selectedUnitData.cost;
                let u = new this.selectedUnitData.class(this.side, wx, wy, this.colorTheme)
                units.push(u);
                if (targetFort) {
                    u.manualTarget = targetFort;
                } else {
                    u.hasMoveOrder = true;
                }
                uiManager.add(`${this.selectedUnitData.name} 已投入戰場`, this.colorTheme);
                this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                break;

            case Fortress.FORTRESS_STATE.COMMANDING:
                // 单位中途阵亡
                if (!this.selectedUnit || !this.selectedUnit.alive) {
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return false;
                }
                if (type !== 'click') {
                    uiManager.add('指令已取消', '#ccc');
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return false;
                }
                let potentialTarget = null;
                // 查找单位目标
                for (let u of units) {
                    if (Math.hypot(u.x - wx, u.y - wy) < 30) {
                        if (u.side === this.side) {
                            uiManager.add('指令已取消', '#ccc');
                            this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                            return false;
                        }
                        if (!u.canAttack(u)) {
                            uiManager.add('無法鎖定該目標', '#ff4444');
                            this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                            return true;
                        }
                        isUIClicked = true; // click any unit
                        potentialTarget = u;
                        break;
                    }
                }
                // 查找要塞目标
                if (!potentialTarget) {
                    for (let f of allFortresses) {
                        if (f.isClicked(wx, wy)) {
                            if (f.side === this.side) {
                                this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                                return true; // click self
                            }
                            isUIClicked = true; // click fortress
                            potentialTarget = f;
                            break;
                        }
                    }
                }
                // 执行结果
                if (potentialTarget) {
                    this.selectedUnit.manualTarget = potentialTarget;
                    this.selectedUnit.autoTarget = null;
                    this.selectedUnit.hasMoveOrder = false;
                    uiManager.add(`已鎖定目標`, this.colorTheme);
                } else {
                    this.selectedUnit.targetX = wx; this.selectedUnit.targetY = wy;
                    this.selectedUnit.manualTarget = null;
                    this.selectedUnit.hasMoveOrder = true;
                    uiManager.add(`移動至 ${Math.floor(wx)}, ${Math.floor(wy)}`, this.colorTheme);
                }
                this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                break;
        }
        return isUIClicked;
    }

    drawBase(ctx) {
        if (!this.alive) return;
        this.drawProgressOctagon(ctx, CONFIG.fortressSizes[0], this.hp / CONFIG.maxHp, this.colorTheme, true);
        this.drawProgressOctagon(ctx, CONFIG.fortressSizes[1], this.ap / CONFIG.maxAp, '#00f2ff', false);
        this.drawStatusText(ctx);
    }

    drawOverlay(ctx) {
        if (this.state === Fortress.FORTRESS_STATE.SHOW_CARDS) {
            this.cards.forEach(card => card.draw(ctx));
        }
        if (this.state === Fortress.FORTRESS_STATE.PLACING) {
            this.drawPlacingOverlay(ctx);
        }
    }

    drawPlacingOverlay(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 242, 255, 0.1)';
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
        ctx.fillStyle = '#00f2ff';
        ctx.font = '20px "Microsoft JhengHei"';
        ctx.textAlign = 'center';
        ctx.fillText(`點擊地圖放置 ${this.selectedUnitData.name} (右鍵取消)`, CONFIG.width / 2, 50);
        ctx.restore();
    }

    drawProgressOctagon(ctx, radius, percent, color, isHP) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const dir = this.side === 'blue' ? 1 : -1;
        const rad1 = Math.PI * 3 / 8;
        const rad2 = Math.PI * 1 / 8;
        const rad3 = -Math.PI * 1 / 8;
        const rad4 = -Math.PI * 3 / 8;

        const points = [
            { x: 0, y: radius * Math.sin(rad1) },
            { x: dir * radius * Math.cos(rad1), y: radius * Math.sin(rad1) },
            { x: dir * radius * Math.cos(rad2), y: radius * Math.sin(rad2) },
            { x: dir * radius * Math.cos(rad3), y: radius * Math.sin(rad3) },
            { x: dir * radius * Math.cos(rad4), y: radius * Math.sin(rad4) },
            { x: 0, y: radius * Math.sin(rad4) }
        ];

        ctx.beginPath();
        ctx.moveTo(0, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(0, points[points.length - 1].y);
        ctx.closePath();
        ctx.fillStyle = isHP ? 'rgba(40, 40, 40, 0.8)' : 'rgba(60, 60, 60, 0.5)';
        ctx.fill();

        ctx.beginPath();
        ctx.lineWidth = isHP ? 8 : 5;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.lineCap = 'round';
        ctx.moveTo(points[0].x, points[0].y);

        const segmentWeights = [0.125, 0.25, 0.25, 0.25, 0.125];
        let accumulatedPercent = 0;
        for (let i = 0; i < segmentWeights.length; i++) {
            const weight = segmentWeights[i];
            if (percent > accumulatedPercent) {
                const segP = Math.min(1, (percent - accumulatedPercent) / weight);
                const tx = points[i].x + (points[i + 1].x - points[i].x) * segP;
                const ty = points[i].y + (points[i + 1].y - points[i].y) * segP;
                ctx.lineTo(tx, ty);
            }
            accumulatedPercent += weight;
        }
        ctx.stroke();
        ctx.restore();
    }

    drawStatusText(ctx) {
        ctx.save();
        const padding = 15;
        const xPos = this.side === 'blue' ? padding : CONFIG.worldWidth - padding;
        const align = this.side === 'blue' ? 'left' : 'right';
        ctx.font = 'bold 18px "Courier New"';
        ctx.fillStyle = '#00f2ff';
        ctx.textAlign = align;
        ctx.fillText(`${Math.floor(this.ap)} AP`, xPos, this.y + 110);
        ctx.fillStyle = this.colorTheme;
        ctx.fillText(`${Math.floor(this.hp)} HP`, xPos, this.y + 135);
        ctx.restore();
    }

    isClicked(wx, wy) {
        return Math.hypot(wx - this.x, wy - this.y) < CONFIG.fortressSizes[0];
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }

    update(dt) {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= dt * 1.5;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, this.life));
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle, speed, damage, owner, maxRange) {
        this.startX = x; this.startY = y;
        this.x = x; this.y = y;
        this.maxRange = maxRange;
        this.angle = angle;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.owner = owner;
        this.history = [];
        this.alive = true;
    }

    update(dt, allUnits, blueFort, redFort, particles) {
        if (!this.alive) return;

        // 超出射程或触碰边界
        const distTraveled = Math.hypot(this.x - this.startX, this.y - this.startY);
        if (distTraveled > this.maxRange || this.x < 0 || this.x > CONFIG.worldWidth || this.y < 0 || this.y > CONFIG.worldHeight) {
            this.alive = false;
            return;
        }

        // 更新位置与轨迹
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 5) this.history.shift();
        this.x += this.vx * dt; this.y += this.vy * dt;

        // 碰撞检测
        for (let u of allUnits) {
            if (u.side !== this.owner.side && u.alive && this.owner.canAttack(u)) {
                if (Math.hypot(this.x - u.x, this.y - u.y) < 25) { // 命中半径
                    u.takeDamage(this.damage);
                    this.onHit(particles);
                    return;
                }
            }
        }
        const targetFort = this.owner.side === 'blue' ? redFort : blueFort;
        if (Math.hypot(this.x - targetFort.x, this.y - targetFort.y) < CONFIG.fortressSizes[0]) {
            targetFort.takeDamage(this.damage);
            this.onHit(particles);
        }
    }

    onHit(particles) {
        this.alive = false;
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(this.x, this.y, '#fff'));
        }
    }

    draw(ctx) {
        ctx.save();
        // 拖尾
        ctx.beginPath();
        ctx.strokeStyle = this.owner.colorTheme; ctx.lineWidth = 3;
        this.history.forEach((p, i) => {
            ctx.globalAlpha = i / this.history.length;
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // 弹头
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
        ctx.fillRect(0, -2, 15, 4);
        ctx.restore();
    }
}

class BaseUnit {
    constructor(side, targetX, targetY, colorTheme) {
        // 基本信息
        this.side = side;
        this.colorTheme = colorTheme;

        // 单位状态
        this.x = (side === 'blue') ? 0 : CONFIG.worldWidth; this.y = CONFIG.worldHeight / 2;
        this.targetX = targetX; this.targetY = targetY;
        this.angle = (side === 'blue') ? 0 : Math.PI;
        this.maxHp = this.hp = 1; this.alive = true;
        this.vel = 0; this.angVel = 0;

        this.manualTarget = null; // 要塞指定的敌方单位
        this.autoTarget = null;   // AI 自动扫描发现的单位
        this.isSelected = false;
        this.isNavigating = false;
        this.hasMoveOrder = false;
        this.isDeploying = true;

        // SelectionUI 动画数据
        this.reloadFlashTimer = 0;
        this.reloadFlashDuration = 0.15;
        this.lastReloaded = true;

        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.15;

        this.allowedTargets = []; // 可攻击的单位
    }

    move(dt, tx, ty, stopRadius = 0, smoothStop = true) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);

        // 计算目标距离
        const effectiveDist = Math.max(0, dist - stopRadius);
        const targetAngle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(this.getAngleDiff(targetAngle, this.angle));

        // 计算目标速度
        let angleFactor = Math.max(0, Math.cos(angleDiff / 2)); // -180->0, 0->1
        let targetVel = this.unitMaxSpeed * angleFactor * angleFactor; // 2 阶平滑

        // 提前刹车
        if (smoothStop) {
            const stopDist = (this.vel * this.vel) / (2 * this.unitAccel);
            if (effectiveDist <= stopDist) targetVel = 0;
        }

        // 平滑速度
        if (this.vel < targetVel) this.vel = Math.min(targetVel, this.vel + this.unitAccel * dt);
        else this.vel = Math.max(targetVel, this.vel - this.unitAccel * dt);

        this.x += Math.cos(this.angle) * this.vel * dt;
        this.y += Math.sin(this.angle) * this.vel * dt;
    }

    rotate(dt, targetAngle) {
        let diff = this.getAngleDiff(targetAngle, this.angle);
        const dist = Math.abs(diff);
        const currentVel = this.angVel;
        const stoppingDist = (currentVel * currentVel) / (2 * this.unitAngAccel);

        if (dist > 0.001 || Math.abs(currentVel) > 0.01) {
            if (dist <= stoppingDist) {
                this.angVel -= Math.sign(currentVel) * this.unitAngAccel * dt;
            } else {
                this.angVel += Math.sign(diff) * this.unitAngAccel * dt;
            }
            this.angVel = Math.max(-this.unitAngMaxSpeed, Math.min(this.unitAngMaxSpeed, this.angVel));
            this.angle += this.angVel * dt;
        } else {
            this.angle = targetAngle;
            this.angVel = 0;
        }
    }

    canAttack(target) {
        if (!target || !target.alive) return false;
        return this.allowedTargets.some(cls => target instanceof cls);
    }

    updateTimers(dt) {
        if (this.reloadFlashTimer > dt) this.reloadFlashTimer -= dt;
        else this.reloadFlashTimer = 0;

        if (this.hitFlashTimer > dt) this.hitFlashTimer -= dt;
        else this.hitFlashTimer = 0;
    }

    update(dt) {
        if (!this.alive) return;
        this.updateTimers(dt);
    }

    getPriorityTarget() {
        if (this.manualTarget && this.manualTarget.alive) return this.manualTarget;
        if (this.autoTarget && this.autoTarget.alive) return this.autoTarget;
        return null;
    }

    getDarkenColor(hex, opacity) {
        return hex + Math.floor(opacity * 255).toString(16).padStart(2, '0');
    }

    lerpColor(color1, color2, weight) {
        const hex = (c) => parseInt(c, 16);
        const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
        const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));
        const r = Math.floor(r1 + (r2 - r1) * weight);
        const g = Math.floor(g1 + (g2 - g1) * weight);
        const b = Math.floor(b1 + (b2 - b1) * weight);
        return `rgb(${r},${g},${b})`;
    }

    drawNavigationPath(ctx) {
        if (!this.isNavigating) return;
        const enemy = this.getPriorityTarget();
        const tx = enemy ? enemy.x : this.targetX;
        const ty = enemy ? enemy.y : this.targetY;

        const dx = tx - this.x; const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 20) return;

        const angle = Math.atan2(dy, dx);
        const step = 30; const animOffset = (performance.now() / 1000 * 60) % step;

        ctx.save();
        ctx.fillStyle = this.colorTheme; ctx.globalAlpha = 0.6;
        ctx.font = 'bold 16px "Courier New"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 5; ctx.shadowColor = this.colorTheme;

        for (let d = animOffset; d < dist; d += step) {
            const px = this.x + Math.cos(angle) * d; const py = this.y + Math.sin(angle) * d;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.fillText('>', 0, 0);
            ctx.restore();
        }

        // 目标点标记
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 单位间排斥
    applySeparation(dt, allUnits) {
        let pushX = 0; let pushY = 0;
        const repulsionStrength = 50; // 排斥力

        for (let u of allUnits) {
            if (u === this || !u.alive || u.domain !== this.domain) continue;

            const dx = this.x - u.x; const dy = this.y - u.y;
            const dist = Math.hypot(dx, dy);
            const minDist = this.collisionRadius + u.collisionRadius;

            if (dist < minDist) {
                const angle = (dist === 0) ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx); // 排斥方向
                const force = (minDist - dist) / minDist; // 距离越近，排斥力越大
                pushX += Math.cos(angle) * force * repulsionStrength;
                pushY += Math.sin(angle) * force * repulsionStrength;
            }
        }
        this.x += pushX * dt; this.y += pushY * dt;
    }

    getAngleDiff(target, current) {
        let diff = target - current;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        return diff;
    }

    takeDamage(amt) {
        const prevHpPercent = this.hp / this.maxHp;
        this.hp -= amt;
        if (this.hp <= 0) {
            this.hp = 0; this.alive = false;
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, this.colorTheme));
            return;
        }
        if (prevHpPercent >= 0.3) this.hitFlashTimer = this.hitFlashDuration;
    }

    checkWorldCollision() {
        const r = this.collisionRadius;
        // 边界检查
        if (this.x - r < 0) this.x = r; if (this.x + r > CONFIG.worldWidth) this.x = CONFIG.worldWidth - r;
        if (this.y - r < 0) this.y = r; if (this.y + r > CONFIG.worldHeight) this.y = CONFIG.worldHeight - r;

        // 要塞硬碰撞
        if (this.domain != 'GROUND') return;
        const allFortresses = [blueFortress, redFortress];
        for (let f of allFortresses) {
            const dist = Math.hypot(this.x - f.x, this.y - f.y);
            const minDist = r + CONFIG.fortressSizes[0];
            if (dist < minDist) {
                if (!this.isDeploying) {
                    const angle = Math.atan2(this.y - f.y, this.x - f.x);
                    this.x = f.x + Math.cos(angle) * minDist; this.y = f.y + Math.sin(angle) * minDist;
                }
                return true;
            }
        }
        return false;
    }

    drawSelectionUI(ctx) {
        if (!this.alive || !this.isSelected) return;

        const now = performance.now();
        const startAngle = -Math.PI / 2; // 垂直向上

        const hpPercent = this.hp / this.maxHp;
        const isLowHp = hpPercent < 0.3;

        let hpColor, hpGlow;
        if (isLowHp) { // 低血量
            const pulse = (Math.sin(now / 150) + 1) / 2;
            const r = 255;
            const g = Math.floor(60 + 40 * pulse);
            const b = Math.floor(60 + 40 * pulse);
            hpColor = `rgb(${r}, ${g}, ${b})`;
            hpGlow = 10 + pulse * 15;
        } else {
            hpColor = this.colorTheme;
            hpGlow = 5;
            if (this.hitFlashTimer > 0) {
                const ratio = this.hitFlashTimer / this.hitFlashDuration;
                hpColor = this.lerpColor(this.colorTheme, '#ffffff', ratio);
                hpGlow = 15 + (ratio * 20);
            }
        }

        // 背景环
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // 半透明底环
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();

        // 进度环
        ctx.shadowBlur = hpGlow;
        ctx.shadowColor = hpColor;
        ctx.strokeStyle = hpColor;

        ctx.beginPath();
        // 顺时针绘制生命值
        const endAngle = startAngle + (Math.PI * 2 * hpPercent);
        ctx.arc(0, 0, 48, startAngle, endAngle, false);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        const pulse = Math.sin(now / 400) * 0.02 + 0.03;
        ctx.beginPath();
        ctx.arc(0, 0, this.attackRange, 0, Math.PI * 2);
        ctx.fillStyle = this.colorTheme;
        ctx.globalAlpha = pulse; // 低透明度填充
        ctx.fill();
        ctx.restore();

        let reloadPercent = 1;
        if (this.fireCD && this.lastFire) {
            const elapsed = now - this.lastFire;
            reloadPercent = Math.min(1, elapsed / this.fireCD);
        }

        const isReady = reloadPercent === 1;
        if (isReady && !this.lastReloaded) {
            this.reloadFlashTimer = this.reloadFlashDuration; // 装填完成时触发 flashTimer
        }
        this.lastReloaded = isReady;

        let sColor, sBlur;
        const flashDuration = this.reloadFlashDuration;
        if (!isReady) {
            sColor = this.getDarkenColor(this.colorTheme, 0.3);
            sBlur = 2;
        } else if (this.reloadFlashTimer > 0) {
            const ratio = this.reloadFlashTimer / flashDuration;
            const r = parseInt(this.colorTheme.slice(1, 3), 16);
            const g = parseInt(this.colorTheme.slice(3, 5), 16);
            const b = parseInt(this.colorTheme.slice(5, 7), 16);
            const nr = Math.floor(r + (255 - r) * ratio);
            const ng = Math.floor(g + (255 - g) * ratio);
            const nb = Math.floor(b + (255 - b) * ratio);
            sColor = `rgb(${nr}, ${ng}, ${nb})`;
            sBlur = 15 + (ratio * 15);
        } else {
            sColor = this.colorTheme;
            sBlur = 12;
        }

        // 射程圈 
        ctx.save();
        ctx.rotate(now / 15000);
        ctx.strokeStyle = this.colorTheme;
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([12, 18]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.attackRange, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 装填圈
        ctx.save();
        ctx.rotate(-now / 2000);
        ctx.strokeStyle = sColor;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = sBlur;
        ctx.shadowColor = sColor;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        // 装填进度圆弧
        ctx.arc(0, 0, 42, startAngle, startAngle + (Math.PI * 2 * reloadPercent), false);
        ctx.stroke();

        // 底色圈 
        ctx.setLineDash([]);
        ctx.globalAlpha = isReady ? 0.05 : 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    static AI = {
        hasManualTarget: (ctx) => (ctx.unit.manualTarget && ctx.unit.manualTarget.alive) ? BT_STATUS.SUCCESS : BT_STATUS.FAILURE,
        isDeploying: (ctx) => ctx.unit.isDeploying ? BT_STATUS.SUCCESS : BT_STATUS.FAILURE,
        doDeploy: (ctx) => {
            const u = ctx.unit;
            const fortressR = CONFIG.fortressSizes[0];
            const offset = u.collisionRadius + 20;
            const exitX = (u.side === 'blue') ? fortressR + offset : CONFIG.worldWidth - (fortressR + offset);

            const passedExit = (u.side === 'blue') ? u.x >= exitX : u.x <= exitX;
            if (!passedExit) {
                u.move(ctx.dt, u.side === 'blue' ? CONFIG.worldWidth : 0, u.y);
                return BT_STATUS.RUNNING;
            } else {
                u.isDeploying = false;
                u.isNavigating = true;
                return BT_STATUS.SUCCESS;
            }
        },
        hasMoveOrder: (ctx) => ctx.unit.hasMoveOrder ? BT_STATUS.SUCCESS : BT_STATUS.FAILURE,
        moveToTarget: (ctx) => {
            const u = ctx.unit;
            const dist = Math.hypot(u.targetX - u.x, u.targetY - u.y);
            if (dist < 5 && u.vel < 5) {
                u.vel = 0; u.isNavigating = false; u.hasMoveOrder = false;
                return BT_STATUS.SUCCESS;
            }
            u.isNavigating = true;
            const targetAngle = Math.atan2(u.targetY - u.y, u.targetX - u.x);
            u.rotate(ctx.dt, targetAngle);
            u.move(ctx.dt, u.targetX, u.targetY, 10);
            return BT_STATUS.RUNNING;
        },
        fire: (ctx) => {
            const u = ctx.unit;
            if (u.fire) {
                u.fire();
                return BT_STATUS.SUCCESS;
            }
            return BT_STATUS.FAILURE;
        },
        idle: (ctx) => {
            const u = ctx.unit;
            u.manualTarget = null;
            u.autoTarget = null;
            u.isNavigating = false;
            u.hasMoveOrder = false;
            return BT_STATUS.SUCCESS;
        },
    }
}

class VehicleUnit extends BaseUnit {
    constructor(side, targetX, targetY, colorTheme) {
        super(side, targetX, targetY, colorTheme);
        this.domain = 'GROUND';

        this.turretAngVel = 0;
        this.turretAngle = this.angle;

        this.barrelOffset = 0;
        this.lastFire = 0;
    }

    update(dt) {
        if (!this.alive) return; // 检测存活
        super.update(dt);
        // 检测挤压和碰撞
        this.applySeparation(dt, units);
        this.checkWorldCollision();
        this.updateRecoil();

        const oldX = this.x; const oldY = this.y; // 执行 BT 之前的位置
        const oldAngle = this.angle; const oldTurretAngle = this.turretAngle;
        if (this.btRoot) this.btRoot.tick({ unit: this, dt: dt }); // 运行行为树
        // 如果未调用位移函数，减速
        if (this.x === oldX && this.y === oldY && this.vel != 0) this.move(dt, this.x, this.y);
        if (this.angle === oldAngle && this.angVel != 0) this.rotate(dt, this.angle);
        if (this.turretAngle === oldTurretAngle && this.turretAngVel != 0) this.rotateTurret(dt, this.turretAngle);
    }

    updateRecoil() {
        const elapsed = performance.now() - this.lastFire;
        if (elapsed <= 60) this.barrelOffset = (elapsed / 60) * 12;
        else if (elapsed <= 360) this.barrelOffset = 12 - ((elapsed - 60) / 300) * 12;
        else this.barrelOffset = 0;
    }

    rotateTurret(dt, targetAngle) {
        let diff = targetAngle - this.turretAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const dist = Math.abs(diff);
        const currentVel = this.turretAngVel;
        const stoppingDist = (currentVel * currentVel) / (2 * this.turretAccel);

        if (dist > 0.001 || Math.abs(currentVel) > 0.01) {
            if (dist <= stoppingDist) {
                this.turretAngVel -= Math.sign(currentVel) * this.turretAccel * dt;
            } else {
                this.turretAngVel += Math.sign(diff) * this.turretAccel * dt;
            }
            this.turretAngVel = Math.max(-this.turretMaxSpeed, Math.min(this.turretMaxSpeed, this.turretAngVel));
            this.turretAngle += this.turretAngVel * dt;
        } else {
            this.turretAngle = targetAngle;
            this.turretAngVel = 0;
        }
    }

    static AI = {
        scanArea: (ctx) => {
            const u = ctx.unit;
            if (u.manualTarget) return BT_STATUS.FAILURE;
            const found = units.find(target =>
                target.side !== u.side && target.alive && u.canAttack(target) &&
                Math.hypot(target.x - u.x, target.y - u.y) <= u.attackRange
            );
            u.autoTarget = found || null;
            return found ? BT_STATUS.SUCCESS : BT_STATUS.FAILURE;
        },
        approachManualTarget: (ctx) => {
            const u = ctx.unit;
            const target = u.manualTarget;
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            // 已进入射程且基本停车
            if (dist <= u.attackRange && u.vel < 10) {
                u.isNavigating = false;
                return BT_STATUS.SUCCESS; // 已进入射程，节点完成
            }
            u.isNavigating = true;
            const targetAngle = Math.atan2(target.y - u.y, target.x - u.x);
            u.rotate(ctx.dt, targetAngle);
            u.move(ctx.dt, target.x, target.y, u.attackRange * 0.8);
            return BT_STATUS.RUNNING;
        },
        aimAtTarget: (ctx) => {
            const u = ctx.unit;
            const target = u.getPriorityTarget();
            if (!target) return BT_STATUS.FAILURE;
            const angleToEnemy = Math.atan2(target.y - u.y, target.x - u.x);
            u.rotateTurret(ctx.dt, angleToEnemy);
            const angleDiff = Math.abs(u.getAngleDiff(angleToEnemy, u.turretAngle));
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            return (angleDiff < 0.1 && dist <= u.attackRange) ? BT_STATUS.SUCCESS : BT_STATUS.RUNNING;
        },
    };
}

// 狙击手
class SniperUnit extends VehicleUnit {
    constructor(side, targetX, targetY, colorTheme) {
        super(side, targetX, targetY, colorTheme);
        this.maxHp = this.hp = 500;
        this.collisionRadius = 40;
        this.attackRange = 500;
        this.fireCD = 2000;

        this.unitMaxSpeed = 50;
        this.unitAccel = 10;

        this.unitAngMaxSpeed = 2;
        this.unitAngAccel = 0.5;

        this.turretMaxSpeed = 3.0;
        this.turretAccel = 1;

        this.bulletSpeed = 1200;
        this.damage = 200;

        this.allowedTargets = [Fortress, VehicleUnit];

        this.btRoot = new Sequence([
            new Selector([
                new Sequence([new Action(BaseUnit.AI.isDeploying), new Action(BaseUnit.AI.doDeploy)]),
                new Sequence([new Action(BaseUnit.AI.hasMoveOrder), new Action(BaseUnit.AI.moveToTarget)]),
                new Sequence([
                    new Action(BaseUnit.AI.hasManualTarget), new Action(VehicleUnit.AI.approachManualTarget),
                    new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)
                ]),
                new Action(BaseUnit.AI.idle),
            ])
        ]);
    }

    fire() {
        if (performance.now() - this.lastFire < this.fireCD) return BT_STATUS.RUNNING;
        this.lastFire = performance.now();
        let muzzleX = this.x + Math.cos(this.turretAngle) * 40; let muzzleY = this.y + Math.sin(this.turretAngle) * 40;
        bullets.push(new Bullet(muzzleX, muzzleY, this.turretAngle, this.bulletSpeed, this.damage, this, this.attackRange));
        return BT_STATUS.SUCCESS;
    }

    draw(ctx) {
        if (!this.alive) return;
        this.drawNavigationPath(ctx);

        ctx.save();
        ctx.translate(this.x, this.y);
        this.drawSelectionUI(ctx);

        // 底盘
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = '#444';
        ctx.fillRect(-20, -18, 40, 7); // 履带
        ctx.fillRect(-20, 11, 40, 7);
        ctx.beginPath();
        ctx.moveTo(-18, -12); ctx.lineTo(18, -12); ctx.lineTo(24, 0);
        ctx.lineTo(18, 12); ctx.lineTo(-18, 12); ctx.lineTo(-24, 0);
        ctx.closePath();
        ctx.fillStyle = '#1a1a1a';
        ctx.strokeStyle = this.colorTheme;
        ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // 炮塔
        ctx.save();
        ctx.rotate(this.turretAngle);
        // 炮管
        ctx.fillStyle = '#444';
        ctx.fillRect(5 - this.barrelOffset, -3, 35, 6);
        ctx.strokeStyle = this.colorTheme;
        ctx.strokeRect(5 - this.barrelOffset, -3, 35, 6);
        // 炮塔座
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a2a';
        ctx.fill(); ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}

// 无人机
class DroneUnit extends BaseUnit {
    static AI = {
        approachManualTarget: (ctx) => {
            const u = ctx.unit;
            const target = u.manualTarget;
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            const minDist = target instanceof Fortress ? u.collisionRadius + 5 : 5;
            if (dist <= minDist) {
                // 触碰爆炸
                return BT_STATUS.SUCCESS;
            }
            u.isNavigating = true;
            const targetAngle = Math.atan2(target.y - u.y, target.x - u.x);
            u.rotate(ctx.dt, targetAngle);
            u.move(ctx.dt, target.x, target.y, 0, false);
            return BT_STATUS.RUNNING;
        },
    };

    constructor(side, targetX, targetY, colorTheme) {
        super(side, targetX, targetY, colorTheme);
        this.domain = 'AIR';
        this.maxHp = this.hp = 100;
        this.collisionRadius = 20;
        this.attackRange = 600;

        this.unitMaxSpeed = 300;
        this.unitAccel = 400;

        this.unitAngMaxSpeed = 8;
        this.unitAngAccel = 4;

        this.damage = 500;

        this.lastTargetAngle = 0;

        this.allowedTargets = [Fortress, VehicleUnit];

        this.vx = 0;
        this.vy = 0;
        // 转向灵敏度（越大拐弯越急，越小漂移感越强）
        this.turnSensitivity = 5.0;

        this.btRoot = new Selector([
            new Sequence([new Action(BaseUnit.AI.isDeploying), new Action(BaseUnit.AI.doDeploy)]),
            new Sequence([new Action(BaseUnit.AI.hasMoveOrder), new Action(BaseUnit.AI.moveToTarget)]),
            new Sequence([new Action(BaseUnit.AI.hasManualTarget), new Action(DroneUnit.AI.approachManualTarget), new Action(BaseUnit.AI.fire)]),
            new Action(BaseUnit.AI.idle),
        ]);
    }

    move(dt, tx, ty, stopRadius = 0, smoothStop = true) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        // 到达后快速减速
        if (dist < 5 + stopRadius) {
            this.vx *= 0.95; this.vy *= 0.95;
            if (this.vx <= 0.05 && this.vy <= 0.05) {
                this.vx = 0; this.vy = 0;
                return;
            }
        }
        // 计算期望速度
        const angleToTarget = Math.atan2(dy, dx);
        let speed = this.unitMaxSpeed;

        if (smoothStop) {
            const stopDist = (Math.hypot(this.vx, this.vy) ** 2) / (2 * this.unitAccel);
            if (dist <= stopDist) speed = 0;
        }

        const desiredVx = Math.cos(angleToTarget) * speed;
        const desiredVy = Math.sin(angleToTarget) * speed;

        // 计算转向力并应用惯性
        this.vx += (desiredVx - this.vx) * this.turnSensitivity * dt;
        this.vy += (desiredVy - this.vy) * this.turnSensitivity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    // 空中单位：只有同种类型才会排斥
    applySeparation(dt, allUnits) {
        let pushX = 0; let pushY = 0;
        const repulsionStrength = 50; // 排斥力

        for (let u of allUnits) {
            if (u === this || !u.alive || u.constructor !== this.constructor) continue;

            const dx = this.x - u.x; const dy = this.y - u.y;
            const dist = Math.hypot(dx, dy);
            const minDist = this.collisionRadius + u.collisionRadius;

            if (dist < minDist) {
                const angle = (dist === 0) ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx); // 排斥方向
                const force = (minDist - dist) / minDist; // 距离越近，排斥力越大
                pushX += Math.cos(angle) * force * repulsionStrength;
                pushY += Math.sin(angle) * force * repulsionStrength;
            }
        }
        this.x += pushX * dt; this.y += pushY * dt;
    }

    update(dt) {
        if (!this.alive) return;
        super.update(dt);
        this.applySeparation(dt, units);
        // this.checkWorldCollision(); 允许空中单位飞出去

        const oldX = this.x; const oldY = this.y;
        const oldAngle = this.angle;
        if (this.btRoot) this.btRoot.tick({ unit: this, dt: dt });
        if (this.x === oldX && this.y === oldY && (this.vx != 0 || this.vy != 0)) this.move(dt, this.x, this.y);
        if (this.angle === oldAngle && this.angVel != 0) this.rotate(dt, this.angle);
    }

    fire() {
        // 触碰爆炸
        const target = this.manualTarget;
        target.takeDamage(this.damage);
        uiManager.add(`無人機已觸發自爆協議`, '#ff4444');
        this.hp = 0; this.alive = false;
        for (let i = 0; i < 20; i++) particles.push(new Particle(this.x, this.y, '#ff4400')); // 爆炸粒子
        return BT_STATUS.SUCCESS;
    }

    draw(ctx) {
        if (!this.alive) return;
        this.drawNavigationPath(ctx);

        ctx.save();
        ctx.translate(this.x, this.y);
        this.drawSelectionUI(ctx);
        ctx.rotate(this.angle);

        // 三角翼机身
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.colorTheme;
        // 主翼
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-10, -15); ctx.lineTo(-5, 0); ctx.lineTo(-10, 15);
        ctx.closePath();
        ctx.fillStyle = '#222';
        ctx.strokeStyle = this.colorTheme;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        // 核心
        ctx.beginPath();
        ctx.arc(-2, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.colorTheme;
        ctx.fill();
        // 桨叶
        const bladeAngle = (performance.now() / 20);
        ctx.strokeStyle = '#bebebe';
        ctx.lineWidth = 2;
        [{ x: -8, y: -12 }, { x: -8, y: 12 }].forEach(pos => {
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(bladeAngle);
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
            ctx.rotate(Math.PI / 2);
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
            ctx.restore();
        });
        ctx.restore();
    }

    checkCollision() {
        const r = this.collisionRadius;
        if (this.x - r < 0 || this.x + r > CONFIG.width || this.y - r < 0 || this.y + r > CONFIG.height) return true;
        return false;
    }
}

class ShotgunUnit extends VehicleUnit {
    constructor(side, targetX, targetY, colorTheme) {
        super(side, targetX, targetY, colorTheme);
        this.maxHp = this.hp = 250;
        this.collisionRadius = 30;
        this.attackRange = 250;
        this.fireCD = 1000;

        this.unitMaxSpeed = 160;
        this.unitAccel = 40;

        this.unitAngMaxSpeed = 6;
        this.unitAngAccel = 2;

        this.turretMaxSpeed = 6;
        this.turretAccel = 3;

        this.bulletSpeed = 800;
        this.damage = 50;

        this.allowedTargets = [Fortress, VehicleUnit, DroneUnit];

        this.btRoot = new Sequence([
            new Selector([
                new Sequence([new Action(BaseUnit.AI.isDeploying), new Action(BaseUnit.AI.doDeploy)]),
                new Sequence([new Action(BaseUnit.AI.hasMoveOrder), new Action(BaseUnit.AI.moveToTarget)]),
                new Sequence([
                    new Action(BaseUnit.AI.hasManualTarget), new Action(VehicleUnit.AI.approachManualTarget),
                    new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)
                ]),
                new Sequence([
                    new Action(VehicleUnit.AI.scanArea), new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)
                ]),
                new Action(BaseUnit.AI.idle),
            ])
        ]);
    }

    fire() {
        if (performance.now() - this.lastFire < this.fireCD) return BT_STATUS.RUNNING;
        this.lastFire = performance.now();
        // 发射多颗子弹
        const spread = 5 * Math.PI / 180;
        const muzzleX = this.x + Math.cos(this.turretAngle) * 30;
        const muzzleY = this.y + Math.sin(this.turretAngle) * 30;

        for (let i = 0; i < 4; i++) {
            const angleOffset = (Math.random() - 0.5) * spread * 2;
            bullets.push(new Bullet(
                muzzleX, muzzleY,
                this.turretAngle + angleOffset,
                this.bulletSpeed + (Math.random() * 100), // 增强随机感
                this.damage, this, this.attackRange
            ));
        }
        return BT_STATUS.SUCCESS;
    }

    draw(ctx) {
        if (!this.alive) return;
        this.drawNavigationPath(ctx);

        ctx.save();
        ctx.translate(this.x, this.y);
        this.drawSelectionUI(ctx);

        // 六边形底盘
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = '#1a1a1a';
        ctx.strokeStyle = this.colorTheme;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const r = 22;
            ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // 侧翼装饰
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -24, 30, 4);
        ctx.fillRect(-15, 20, 30, 4);
        ctx.restore();
        // 宽型炮管
        ctx.save();
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#2a2a2a';
        ctx.strokeStyle = this.colorTheme;
        // 宽口炮管
        ctx.beginPath();
        ctx.moveTo(8 - this.barrelOffset, -5); ctx.lineTo(30 - this.barrelOffset, -6);
        ctx.lineTo(30 - this.barrelOffset, 6); ctx.lineTo(8 - this.barrelOffset, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // 炮塔中心
        ctx.beginPath();
        ctx.rect(-10, -7, 17, 14);
        ctx.fill(); ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}

// 通知管理类
class TechNotification {
    constructor(text, color) {
        this.text = text;
        this.color = color;
        this.startTime = performance.now();
        this.chars = text.split('');
    }

    draw(ctx, yOffset) {
        const elapsed = performance.now() - this.startTime;
        const totalLife = UI_CONFIG.msgLife;

        // 计算透明度
        let alpha = 1;
        if (elapsed > totalLife) return false;
        if (elapsed > totalLife - UI_CONFIG.fadeOutTime) {
            alpha = 1 - (elapsed - (totalLife - UI_CONFIG.fadeOutTime)) / UI_CONFIG.fadeOutTime;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = 'bold 18px "Microsoft JhengHei", "Courier New"';
        ctx.textAlign = 'left';

        let currentX = UI_CONFIG.msgX;
        this.chars.forEach((char, i) => {
            const charSpawnTime = i * UI_CONFIG.charDelay;
            const charElapsed = elapsed - charSpawnTime;

            if (charElapsed > 0) {
                // 荧光强度计算
                const glowProgress = Math.min(1, charElapsed / UI_CONFIG.glowDuration);
                const glowIntensity = 30 - (glowProgress * 20);

                ctx.shadowColor = this.color;
                ctx.shadowBlur = glowIntensity;
                ctx.fillStyle = this.color;

                // 渲染字符
                ctx.fillText(char, currentX, UI_CONFIG.msgY + yOffset);

                currentX += ctx.measureText(char).width + 2;
            }
        });

        ctx.restore();
        return true;
    }
}

class NotificationManager {
    constructor() {
        this.messages = [];
    }

    add(text, color) {
        this.messages.unshift(new TechNotification(text, color)); // 新消息放开头
    }

    draw(ctx) {
        // 过滤过期的消息
        this.messages = this.messages.filter((msg, index) => {
            return msg.draw(ctx, index * UI_CONFIG.msgSpacing);
        });
    }
}

const CONFIG = {
    width: 1200,       // 视口宽度
    height: 800,       // 视口高度
    worldWidth: 6000,  // 战场宽度
    worldHeight: 4000, // 战场宽度
    maxHp: 10000,
    maxAp: 300,
    apRegenPerSecond: 50,
    fortressSizes: [80, 50],
    units: [
        { id: 'sniper', name: '狙擊手', cost: 50, class: SniperUnit },
        { id: 'drone', name: '無人機', cost: 30, class: DroneUnit },
        { id: 'shotgun', name: '霰彈兵', cost: 45, class: ShotgunUnit }
    ],
    cardWidth: 140,
    cardHeight: 50,
};

const camera = {
    // 视点
    x: CONFIG.width / 2, // 游戏开始得看着自家要塞
    y: CONFIG.worldHeight / 2,
    zoomPivotX: CONFIG.width / 2,  // 缩放锚点
    zoomPivotY: CONFIG.height / 2,
    vx: 0,
    vy: 0,
    friction: 0.98,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,

    // 缩放
    zoom: 1,
    minZoom: Math.max(CONFIG.width / CONFIG.worldWidth, CONFIG.height / CONFIG.worldHeight),
    maxZoom: 1.6,
    targetZoom: 1,
    zoomFriction: 0.15, // 缩放平滑度，越小越平滑

    // 拖拽触发
    startX: 0,
    startY: 0,
    dragThreshold: 5, // 移动超过 5 像素为拖拽

    update(dt) {
        if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
            const worldBefore = screenToWorld(this.zoomPivotX, this.zoomPivotY);
            this.zoom += (this.targetZoom - this.zoom) * this.zoomFriction;
            const worldAfter = screenToWorld(this.zoomPivotX, this.zoomPivotY);
            this.x -= (worldAfter.x - worldBefore.x);
            this.y -= (worldAfter.y - worldBefore.y);
        } else {
            this.zoom = this.targetZoom;
        }

        if (!this.isDragging) {
            if (Math.abs(this.vx) > 0.01) {
                this.x += this.vx;
                this.vx *= this.friction;
            }
            else { this.vx = 0; }
            if (Math.abs(this.vy) > 0.01) {
                this.y += this.vy;
                this.vy *= this.friction;
            }
            else { this.vy = 0; }
        }

        this.clamp();
    },

    clamp() {
        const halfVisibleWidth = (CONFIG.width / 2) / this.zoom;
        const halfVisibleHeight = (CONFIG.height / 2) / this.zoom;
        // 限制 X 轴
        if (CONFIG.worldWidth < halfVisibleWidth * 2) {
            this.x = CONFIG.worldWidth / 2;
        } else {
            this.x = Math.max(halfVisibleWidth, Math.min(CONFIG.worldWidth - halfVisibleWidth, this.x));
        }
        // 限制 Y 轴
        if (CONFIG.worldHeight < halfVisibleHeight * 2) {
            this.y = CONFIG.worldHeight / 2;
        } else {
            this.y = Math.max(halfVisibleHeight, Math.min(CONFIG.worldHeight - halfVisibleHeight, this.y));
        }
    }
};

// UI 配置
const UI_CONFIG = {
    msgX: 20,
    msgY: 40,
    msgSpacing: 35,
    charDelay: 30,      // 0.03s 逐字出现
    glowDuration: 200,  // 0.2s 荧光衰减
    msgLife: 5000,      // 5s 消息持续时间
    fadeOutTime: 1000   // 1s 消息渐变消失
};

let units = [];
let bullets = [];
let particles = [];

let lastTime = performance.now();

const blueFortress = new Fortress('blue', 0, CONFIG.worldHeight / 2, '#3498db');
const redFortress = new Fortress('red', CONFIG.worldWidth, CONFIG.worldHeight / 2, '#e74c3c');
const uiManager = new NotificationManager();

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    camera.isDragging = true;
    camera.lastMouseX = mx;
    camera.lastMouseY = my;
    camera.startX = mx;
    camera.startY = my;

    camera.vx = 0;
    camera.vy = 0;
});

// 滚轮缩放
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    camera.zoomPivotX = mx;
    camera.zoomPivotY = my;

    const zoomSpeed = 0.001;
    camera.targetZoom = Math.min(Math.max(camera.targetZoom + (-e.deltaY * zoomSpeed), camera.minZoom), camera.maxZoom);
}, { passive: false });

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (camera.isDragging) {
        const dx = (mx - camera.lastMouseX) / camera.zoom;
        const dy = (my - camera.lastMouseY) / camera.zoom;

        camera.x -= dx;
        camera.y -= dy;

        camera.vx = (camera.vx * 0.5) - (dx * 0.5); // 加权平均
        camera.vy = (camera.vy * 0.5) - (dy * 0.5);
        camera.lastMouseX = mx;
        camera.lastMouseY = my;
        camera.clamp();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !camera.isDragging) return;
    camera.isDragging = false;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const dist = Math.hypot(mx - camera.startX, my - camera.startY);
    if (dist < camera.dragThreshold) {
        blueFortress.handleInput(mx, my, 'click', redFortress);
        camera.vx = 0;
        camera.vy = 0;
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    blueFortress.handleInput(mx, my, 'rightclick', redFortress);
});

function screenToWorld(sx, sy) {
    const x = (sx - CONFIG.width / 2) / camera.zoom + camera.x;
    const y = (sy - CONFIG.height / 2) / camera.zoom + camera.y;
    return { x, y };
}
function drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
    ctx.beginPath();
    for (let x = 0; x <= CONFIG.worldWidth; x += 100) {
        ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.worldHeight);
    }
    for (let y = 0; y <= CONFIG.worldHeight; y += 100) {
        ctx.moveTo(0, y); ctx.lineTo(CONFIG.worldWidth, y);
    }
    ctx.stroke();
    ctx.restore();
}
function gameLoop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    camera.update(dt);

    // 背景与网格
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    ctx.save();
    ctx.translate(CONFIG.width / 2, CONFIG.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    drawGrid(ctx);

    blueFortress.update(dt);
    redFortress.update(dt);
    redFortress.think(dt);

    units = units.filter(u => u.alive || particles.length > 0);
    bullets = bullets.filter(b => b.alive);
    particles = particles.filter(p => p.life > 0);

    units.filter(u => u.domain === 'GROUND').forEach(u => {
        u.update(dt);
        u.draw(ctx);
    });

    blueFortress.drawBase(ctx);
    redFortress.drawBase(ctx);

    bullets.forEach(b => {
        b.update(dt, units, blueFortress, redFortress, particles);
        b.draw(ctx);
    });
    particles.forEach(p => { p.update(dt); p.draw(ctx); });

    units.filter(u => u.domain === 'AIR').forEach(u => {
        u.update(dt);
        u.draw(ctx);
    });

    ctx.restore();

    blueFortress.drawOverlay(ctx);
    uiManager.draw(ctx);

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);