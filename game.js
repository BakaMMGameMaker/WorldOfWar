// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BT_STATUS = { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE', RUNNING: 'RUNNING' };
const GAME_STATE = { MENU: 'MENU', PLAYING: 'PLAYING', VICTORY: 'VICTORY', DEFEAT: 'DEFEAT' };

class Node { tick(tickContext) { return BT_STATUS.FAILURE; } }

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

class Parallel extends Node {
    constructor(children) {
        super();
        this.children = children;
    }
    tick(tickContext) {
        let allSuccess = true;
        for (let child of this.children) {
            const status = child.tick(tickContext);
            if (status === BT_STATUS.FAILURE) return BT_STATUS.FAILURE;
            if (status !== BT_STATUS.SUCCESS) allSuccess = false;
        }
        return allSuccess ? BT_STATUS.SUCCESS : BT_STATUS.RUNNING;
    }
}

class Action extends Node {
    constructor(actionFn) {
        super();
        this.execute = actionFn;
    }
    tick(tickContext) { return this.execute(tickContext); }
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
                return { action: 'DEPLOYING', unit: this.unit };
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
        const mainBlue = CONFIG.blueTheme; const neonBlue = '#00f2ff';

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

        ctx.strokeStyle = borderColor; ctx.lineWidth = this.state === 'SELECTED' ? 3 : 1;
        ctx.shadowBlur = glow; ctx.shadowColor = borderColor;
        ctx.stroke();

        ctx.shadowBlur = 0; ctx.fillStyle = textColor;
        ctx.font = 'bold 16px "Microsoft JhengHei"';
        ctx.fillText(this.unit.name, 15, 22);
        ctx.font = '14px "Courier New"';
        ctx.fillText(`COST: ${this.unit.cost}`, 15, 40);
        ctx.restore();
    }
}

class Actor {
    constructor(x, y, side, id) {
        this.x = x; this.y = y; this.side = side; this.colorTheme = side === 'blue' ? CONFIG.blueTheme : CONFIG.redTheme;
        this.hp = 0; this.alive = false;
        this.unitId = id;
        this.lastAttacker = null; this.lastAttackerTime = 0;
    }

    takeDamage(ctx) {
        this.hp -= ctx.damage;
        this.lastAttacker = ctx.attacker;
        this.lastAttackerTime = performance.now();
        if (this.hp > 0) return;
        this.hp = 0;
        this.alive = false;
    }
}

// 要塞
class Fortress extends Actor {
    static FORT_STATE = { NORMAL: 'NORMAL', SHOW_CARDS: 'SHOW_CARDS', DEPLOYING: 'PLACING', COMMANDING: 'COMMANDING' };

    constructor(x, y, side, id) {
        super(x, y, side, id);
        this.hp = CONFIG.maxHp; this.alive = true;
        this.isAI = side === 'red';
        this.ap = this.isAI ? CONFIG.maxAp : 0;

        this.state = Fortress.FORT_STATE.NORMAL;
        this.selectedUnitData = null; this.selectedUnit = null;
        this.cards = [];
    }

    takeDamage(ctx) {
        super.takeDamage(ctx);
        if (this.hp > 0) return;
        camera.shake = 50;
        for (let i = 0; i < 100; i++) {
            const p = new Particle(this.x, this.y, i % 2 === 0 ? '#fff' : this.colorTheme);
            p.vx *= 5; p.vy *= 5;
            p.life = 2.0 + Math.random();
            particles.push(p);
        }
    }

    update(dt) {
        if (!this.isAI && this.state === Fortress.FORT_STATE.SHOW_CARDS) this.cards.forEach(card => card.update());
    }

    updateAvailableCards(unitKeys) {
        if (!unitKeys || unitKeys.length === 0) {
            unitKeys = Object.keys(CONFIG.UNIT_STATS);
            return;
        }

        this.cards = unitKeys.map((key, index) => {
            const stats = CONFIG.UNIT_STATS[key];
            if (!stats) return null;

            const unitData = {
                id: key,
                name: stats.name,
                cost: stats.cost,
                class: stats.class
            };

            const startX = 120;
            const startY = 300 + (index * 70);

            return new UnitCard(unitData, startX, startY, this);
        }).filter(card => card !== null);
    }

    getClickedUnit(mx, my, radius) {
        let clickedUnit = null;
        for (let u of units) {
            if (!u.alive) continue;
            const sPos = camera.worldToScreen(u.x, u.y);
            const d = Math.hypot(sPos.x - mx, sPos.y - my);
            if (d > radius) continue;
            radius = d;
            clickedUnit = u;
        }
        return clickedUnit;
    }

    switchState(newState) {
        if (newState === Fortress.FORT_STATE.NORMAL) {
            this.cards.forEach(card => { if (card.state === 'SELECTED') card.state = 'AVAILABLE'; });
            if (this.selectedUnit) this.selectedUnit.isSelected = false;
            this.selectedUnit = null; this.selectedUnitData = null;
            gameConsole.deactivate();
        } else if (newState === Fortress.FORT_STATE.COMMANDING) {
            uiManager.add(`戰術單位已就緒`, this.colorTheme);
            this.selectedUnit.isSelected = true;
            gameConsole.activate();
        }
        this.state = newState;
    }

    handleInput(mx, my, type) {
        const worldPos = camera.screenToWorld(mx, my);
        const { x: wx, y: wy } = worldPos;

        const clickedSelf = this.inRange(wx, wy);
        let clickedUnit = this.getClickedUnit(mx, my, 35);

        switch (this.state) {
            case Fortress.FORT_STATE.NORMAL:
                if (type !== 'click') return;
                // 点击要塞
                if (clickedSelf) {
                    this.switchState(Fortress.FORT_STATE.SHOW_CARDS);
                    return;
                }
                // 点击己方单位
                if (clickedUnit && clickedUnit.side === this.side) {
                    this.selectedUnit = clickedUnit;
                    this.switchState(Fortress.FORT_STATE.COMMANDING);
                    return;
                }
                break;

            case Fortress.FORT_STATE.SHOW_CARDS:
                if (type !== 'click' || clickedSelf) {
                    this.switchState(Fortress.FORT_STATE.NORMAL);
                    return;
                }
                for (let card of this.cards) {
                    const result = card.checkClick(mx, my);
                    if (!result) continue;
                    if (result.action === 'DEPLOYING') {
                        this.selectedUnitData = result.unit;
                        this.switchState(Fortress.FORT_STATE.DEPLOYING);
                        break;
                    }
                }
                break;

            case Fortress.FORT_STATE.DEPLOYING:
                if (type !== 'click') {
                    uiManager.add('指令已取消', '#ccc');
                    this.switchState(Fortress.FORT_STATE.NORMAL);
                    return;
                }
                let deployingTarget = null;
                let followTarget = null;
                // 点击要塞
                for (let f of allForts) {
                    if (!f.inRange(wx, wy)) continue;
                    if (f.side === 'blue') {
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    if (!BaseUnit.canClassAttack(this.selectedUnitData.class, f)) {
                        uiManager.add('無法鎖定該目標', '#ff4444');
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    deployingTarget = f;
                }
                // 点击单位，友方跟随，敌方攻击
                if (!deployingTarget && clickedUnit) {
                    if (clickedUnit.side !== this.side) {
                        if (!BaseUnit.canClassAttack(this.selectedUnitData.class, clickedUnit)) {
                            uiManager.add('無法鎖定該目標', '#ff4444');
                            this.switchState(Fortress.FORT_STATE.NORMAL);
                            return;
                        }
                        deployingTarget = clickedUnit;
                    } else {
                        followTarget = clickedUnit;
                    }
                }
                // 费用检查
                if (this.ap < this.selectedUnitData.cost) {
                    uiManager.add('行動值不足', '#ff4444');
                    this.switchState(Fortress.FORT_STATE.NORMAL);
                    return;
                }
                this.ap -= this.selectedUnitData.cost;
                let u = new this.selectedUnitData.class(this);
                units.push(u);

                if (deployingTarget) u.cmdTarget = deployingTarget;
                else if (followTarget) u.followTarget = followTarget;
                else u.targetPos = { x: wx, y: wy };

                uiManager.add(`${this.selectedUnitData.name} 已投入戰場`, this.colorTheme);
                this.switchState(Fortress.FORT_STATE.NORMAL);
                break;

            case Fortress.FORT_STATE.COMMANDING:
                if (!this.selectedUnit || !this.selectedUnit.alive) { // 单位中途阵亡
                    this.switchState(Fortress.FORT_STATE.NORMAL);
                    return;
                }
                if (type !== 'click') {
                    uiManager.add('指令已取消', '#ccc');
                    this.switchState(Fortress.FORT_STATE.NORMAL);
                    return;
                }
                let cmdTarget = null;
                // 单位目标
                if (clickedUnit) {
                    if (clickedUnit === this.selectedUnit) {
                        uiManager.add('指令已取消', '#ffffff');
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    if (clickedUnit.side === this.side) {
                        if (clickedUnit.followTarget === this.selectedUnit) {
                            uiManager.add('禁止循環跟隨', '#ff4444');
                        } else {
                            this.selectedUnit.resetState();
                            this.selectedUnit.followTarget = clickedUnit;
                            this.selectedUnit.switchState(BaseUnit.UNIT_STATE.FOLLOWING);
                            uiManager.add(`已跟隨指定單位`, this.colorTheme);
                        }
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    if (!this.selectedUnit.canAttack(clickedUnit)) {
                        uiManager.add('無法鎖定該目標', '#ff4444');
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    cmdTarget = clickedUnit;
                }
                // 要塞目标
                for (let f of allForts) {
                    if (!f.inRange(wx, wy)) continue;
                    if (f.side === this.side) {
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    if (!this.selectedUnit.canAttack(f)) {
                        uiManager.add('無法鎖定該目標', '#ff4444');
                        this.switchState(Fortress.FORT_STATE.NORMAL);
                        return;
                    }
                    cmdTarget = f;
                    break;
                }
                // 攻击敌方单位或移动
                this.selectedUnit.resetState();
                if (cmdTarget) {
                    this.selectedUnit.cmdTarget = cmdTarget;
                    this.selectedUnit.switchState(BaseUnit.UNIT_STATE.APPROACHING_CMD_TARGET);
                    uiManager.add(`已鎖定目標`, this.colorTheme);
                } else {
                    this.selectedUnit.targetPos = { x: wx, y: wy };
                    this.selectedUnit.switchState(BaseUnit.UNIT_STATE.MOVING_TO_POS);
                    uiManager.add(`移動至 ${Math.floor(wx)}, ${Math.floor(wy)}`, this.colorTheme);
                }
                this.switchState(Fortress.FORT_STATE.NORMAL);
                break;
        }
    }

    drawBase(ctx) {
        if (!this.alive) return;
        this.drawProgressOctagon(ctx, CONFIG.fortressSizes[0], this.hp / CONFIG.maxHp, this.colorTheme, true);
        this.drawProgressOctagon(ctx, CONFIG.fortressSizes[1], this.ap / CONFIG.maxAp, '#00f2ff', false);
        // this.drawStatusText(ctx);
    }

    drawOverlay(ctx) {
        switch (this.state) {
            case Fortress.FORT_STATE.SHOW_CARDS: this.cards.forEach(card => card.draw(ctx)); break;
            case Fortress.FORT_STATE.DEPLOYING: this.drawDeployingOverlay(ctx); break;
        }
    }

    drawDeployingOverlay(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 242, 255, 0.05)';
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
        ctx.fillStyle = '#00f2ff';
        ctx.font = '20px "Microsoft JhengHei"';
        ctx.textAlign = 'center';
        ctx.fillText(`點擊地圖放置 ${this.selectedUnitData.name} (右鍵取消)`, CONFIG.width / 2, 80);
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

    inRange(wx, wy) { return Math.hypot(wx - this.x, wy - this.y) < CONFIG.fortressSizes[0]; }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }

    update(dt) {
        this.x += this.vx; this.y += this.vy;
        this.life -= dt * 1.5;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, this.life));
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.fillStyle = this.color;
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
            if (u.side === this.owner.side || !u.alive || !this.owner.canAttack(u)) continue;
            if (Math.hypot(this.x - u.x, this.y - u.y) > 25) continue;
            u.takeDamage({ attacker: this.owner, damage: this.damage });
            this.onHit(particles);
            return;
        }
        const targetFort = this.owner.side === 'blue' ? redFort : blueFort;
        if (!this.owner.canAttack(targetFort) || Math.hypot(this.x - targetFort.x, this.y - targetFort.y) > CONFIG.fortressSizes[0]) return;
        targetFort.takeDamage({ attacker: this.owner, damage: this.damage });
        this.onHit(particles);
    }

    onHit(particles) {
        this.alive = false;
        for (let i = 0; i < 10; i++) { particles.push(new Particle(this.x, this.y, '#fff')); }
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

class BaseUnit extends Actor {
    static UNIT_STATE = { DEPLOYING: 'DEPLOYING', MOVING_TO_POS: 'MOVING_TO_POS', APPROACHING_CMD_TARGET: 'APPROCHING_CMD_TARGET', FOLLOWING: 'FOLLOWING', IDLE: 'IDLE' };

    static canClassAttack(unitCls, target) {
        if (!target || !target.alive) return false;
        const allowed = unitCls.allowedTargets || [];
        return allowed.some(cls => target instanceof cls);
    }

    constructor(owner) {
        // 基本信息
        super(owner.x, owner.y, owner.side, unitIdCounter++);
        this.owner = owner;
        this.alive = true;

        // 运动状态
        this.angle = (this.side === 'blue') ? 0 : Math.PI;
        this.vel = 0; this.angVel = 0;

        // 行为状态
        this.navTarget = null;
        this.targetPos = null;
        this.cmdTarget = null;    // 要塞指定的敌方单位
        this.autoTarget = null;   // 自动扫描发现的敌军
        this.followTarget = null; // 要跟随的单位
        this.isSelected = false;
        this.isAutoScanEnabled = false;
        this.state = BaseUnit.UNIT_STATE.DEPLOYING;

        // 动画数据
        this.reloadFlashTimer = 0;
        this.reloadFlashDuration = 0.15;
        this.lastReloaded = true;

        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.15;
    }

    loadStats(stats) {
        this.cost = stats.cost;
        this.maxHp = this.hp = stats.hp;
        this.attackRange = stats.attackRange;
        this.reloadTime = stats.reloadTime * 1000;
        this.unitMaxSpeed = stats.maxSpeed;
        this.bulletSpeed = stats.bulletSpeed;
        this.damage = stats.damage;
        this.priorityMap = stats.priorityMap;
    }

    switchState(newState) {
        if (this.state === newState) return;
        this.state = newState;
    }

    doDeploy(dt) {
        const fortressR = CONFIG.fortressSizes[0];
        const offset = this.collisionRadius;
        const exitX = (this.side === 'blue') ? fortressR + offset : CONFIG.worldWidth - (fortressR + offset);

        const passedExit = (this.side === 'blue') ? this.x >= exitX : this.x <= exitX;
        if (!passedExit) {
            this.move(dt, this.side === 'blue' ? CONFIG.worldWidth : 0, this.y);
        } else {
            if (this.targetPos) this.switchState(BaseUnit.UNIT_STATE.MOVING_TO_POS);
            else if (this.cmdTarget) this.switchState(BaseUnit.UNIT_STATE.APPROACHING_CMD_TARGET);
            else if (this.followTargett) this.switchState(BaseUnit.UNIT_STATE.FOLLOWING);
            else this.switchState(BaseUnit.UNIT_STATE.IDLE);
        }
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

    moveToPos(dt) {
        if (!this.targetPos) { this.switchState(BaseUnit.UNIT_STATE.IDLE); return; }
        const { x: tx, y: ty } = this.targetPos;
        const dist = Math.hypot(tx - this.x, ty - this.y);
        if (dist < 15 && this.vel < 5) { this.resetState(); return; }
        this.navTarget = this.targetPos;
        const targetAngle = Math.atan2(ty - this.y, tx - this.x);
        this.move(dt, tx, ty, 10);
        this.rotate(dt, targetAngle);
    }

    followLeader(dt) {
        const leader = this.followTarget;
        if (!leader || !leader.alive) { this.resetState(); return; }

        const distToLeader = Math.hypot(leader.x - this.x, leader.y - this.y);
        const stopDist = this.collisionRadius + leader.collisionRadius + 20;

        if (distToLeader > stopDist) {
            const targetAngle = Math.atan2(leader.y - this.y, leader.x - this.x);
            this.rotate(dt, targetAngle);
            this.move(dt, leader.x, leader.y, stopDist);
        } else {
            this.rotate(dt, leader.angle);
        }
        this.tryAttackAutoTarget(dt);
    }

    canAttack(target) { return BaseUnit.canClassAttack(this.constructor, target); }

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

    validatePriorityTarget() {
        if (this.cmdTarget && this.cmdTarget.alive) return this.cmdTarget;
        this.cmdTarget = null;
        if (this.autoTarget && this.autoTarget.alive) return this.autoTarget;
        this.autoTarget = null;
        return null;
    }

    scanForAutoTarget() {
        // 已经做好攻击 cmdtarget 的准备，重置 autotarget 且不再扫描
        if (this.cmdTarget && this.cmdTarget.alive && Math.hypot(this.cmdTarget.x - this.x, this.cmdTarget.y - this.y) <= this.attackRange) { this.autoTarget = null; return; }
        if (!this.isAutoScanEnabled || (this.autoTarget && this.autoTarget.alive)) return;

        const now = performance.now();
        let bestTarget = null;
        let bestScore = Infinity;

        for (let target of units.concat(allForts)) {
            if (target.side === this.side || !target.alive || !this.canAttack(target)) continue;
            const dist = Math.hypot(target.x - this.x, target.y - this.y);
            if (dist > this.attackRange) continue;

            let score = 999; // 目标优先级

            if (this.lastAttacker === target && (now - this.lastAttackerTime < 2000)) {
                score = 0; // 攻击者优先级最高
            } else if (this.priorityMap) {
                const p = this.priorityMap.get(target.constructor);
                if (p !== undefined) {
                    score = p;
                } else {
                    for (let [cls, pValue] of this.priorityMap) {
                        if (target instanceof cls) {
                            score = pValue;
                            break;
                        }
                    }
                }
            }
            if (score < bestScore) {
                bestScore = score;
                bestTarget = target;
            } else if (score === bestScore && bestTarget) {
                const distToBest = Math.hypot(bestTarget.x - this.x, bestTarget.y - this.y);
                if (dist < distToBest) bestTarget = target;
            }
        }
        this.autoTarget = bestTarget; // 要不 null 要不实际单位
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
        if (this.side === 'red') return;

        if (this.followTarget && this.followTarget.alive) {
            this.drawFollowLink(ctx);
            return;
        }

        if (!this.navTarget) return;
        const { x: tx, y: ty } = this.navTarget;

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

    drawFollowLink(ctx) {
        const leader = this.followTarget;
        const now = performance.now();

        ctx.save();

        // 浅色虚线
        ctx.strokeStyle = this.colorTheme;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1.5;

        const dashPattern = [10, 8];
        ctx.setLineDash(dashPattern);

        ctx.lineDashOffset = -(now * 0.05);

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(leader.x, leader.y);
        ctx.stroke();

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

    takeDamage(ctx) {
        const wasAlive = this.alive;
        super.takeDamage(ctx);

        if (wasAlive && !this.alive && ctx.attacker && ctx.attacker.side === 'blue') {
            const killerFort = ctx.attacker.owner;
            if (killerFort && killerFort !== this.owner && this.cost) {
                killerFort.ap = Math.min(CONFIG.maxAp, killerFort.ap + this.cost);
                uiManager.add(`戰術回收: +${this.cost} AP`, killerFort.colorTheme);
            }
        }
        if (!this.alive) return;
        if (this.hp / this.maxHp >= 0.3) this.hitFlashTimer = this.hitFlashDuration;
    }

    checkWorldCollision() {
        const r = this.collisionRadius;
        // 边界检查
        if (this.x - r < 0) this.x = r; if (this.x + r > CONFIG.worldWidth) this.x = CONFIG.worldWidth - r;
        if (this.y - r < 0) this.y = r; if (this.y + r > CONFIG.worldHeight) this.y = CONFIG.worldHeight - r;

        // 要塞硬碰撞
        if (this.state === BaseUnit.UNIT_STATE.DEPLOYING || this.domain != 'GROUND') return;
        const allFortresses = [blueFortress, redFortress];
        for (let f of allFortresses) {
            const dist = Math.hypot(this.x - f.x, this.y - f.y);
            const minDist = r + CONFIG.fortressSizes[0];
            if (dist > minDist) continue;
            const angle = Math.atan2(this.y - f.y, this.x - f.x);
            this.x = f.x + Math.cos(angle) * minDist; this.y = f.y + Math.sin(angle) * minDist;
        }
    }

    drawSelectionUI(ctx) {
        if (!this.alive || !this.isSelected) return;

        const now = performance.now();
        const startAngle = -Math.PI / 2; // 垂直向上

        const hpPercent = this.hp / this.maxHp;
        const isLowHp = hpPercent < 0.3;

        let hpColor, hpGlow;
        if (isLowHp) {
            const pulse = (Math.sin(now / 150) + 1) / 2;
            const r = 255; const g = Math.floor(60 + 40 * pulse); const b = Math.floor(60 + 40 * pulse);
            hpColor = `rgb(${r}, ${g}, ${b})`; hpGlow = 10 + pulse * 15;
        } else {
            hpColor = this.colorTheme; hpGlow = 5;
            if (this.hitFlashTimer > 0) {
                const ratio = this.hitFlashTimer / this.hitFlashDuration;
                hpColor = this.lerpColor(this.colorTheme, '#ffffff', ratio); hpGlow = 15 + (ratio * 20);
            }
        }

        // 背景环
        ctx.save();
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';

        // 半透明底环
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();

        ctx.shadowBlur = hpGlow; ctx.shadowColor = hpColor; ctx.strokeStyle = hpColor; // 进度环

        ctx.beginPath();
        // 生命值
        const endAngle = startAngle + (Math.PI * 2 * hpPercent);
        ctx.arc(0, 0, 48, startAngle, endAngle, false);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        const pulse = Math.sin(now / 400) * 0.02 + 0.03;
        ctx.beginPath();
        ctx.arc(0, 0, this.attackRange, 0, Math.PI * 2);
        ctx.fillStyle = this.colorTheme; ctx.globalAlpha = pulse;
        ctx.fill();
        ctx.restore();

        let reloadPercent = 1;
        if (this.reloadTime && this.lastFire) {
            const elapsed = now - this.lastFire;
            reloadPercent = Math.min(1, elapsed / this.reloadTime);
        }

        const isReady = reloadPercent === 1;
        if (isReady && !this.lastReloaded) {
            this.reloadFlashTimer = this.reloadFlashDuration; // 装填完成
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
            sColor = `rgb(${nr}, ${ng}, ${nb})`; sBlur = 15 + (ratio * 15);
        } else {
            sColor = this.colorTheme; sBlur = 12;
        }

        // 射程圈 
        ctx.save();
        ctx.rotate(now / 15000);
        ctx.strokeStyle = this.colorTheme; ctx.globalAlpha = 0.7;
        ctx.setLineDash([12, 18]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.attackRange, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 装填圈
        ctx.save();
        ctx.rotate(-now / 2000);
        ctx.strokeStyle = sColor; ctx.lineWidth = 1.8;
        ctx.shadowBlur = sBlur; ctx.shadowColor = sColor;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
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

    resetState() {
        this.navTarget = null;
        this.targetPos = null;
        this.cmdTarget = null;
        this.autoTarget = null;
        this.followTarget = null;
        this.switchState(BaseUnit.UNIT_STATE.IDLE);
    }

    static AI = {
        scanForAutoTarget: (ctx) => {
            const u = ctx.unit;
            if (u.validatePriorityTarget()) return BT_STATUS.SUCCESS;

            if (!u.isAutoScanEnabled) {
                u.autoTarget = null;
                return BT_STATUS.FAILURE;
            }

            const now = performance.now();
            let bestTarget = null;
            let bestScore = Infinity;

            for (let target of units.concat(allForts)) {
                if (target.side === u.side || !target.alive || !u.canAttack(target)) continue;
                const dist = Math.hypot(target.x - u.x, target.y - u.y);
                if (dist > u.attackRange) continue;

                let score = 999; // 目标优先级

                if (u.lastAttacker === target && (now - u.lastAttackerTime < 2000)) {
                    score = 0; // 攻击者优先级最高
                } else if (u.priorityMap) {
                    const p = u.priorityMap.get(target.constructor);
                    if (p !== undefined) {
                        score = p;
                    } else {
                        for (let [cls, pValue] of u.priorityMap) {
                            if (target instanceof cls) {
                                score = pValue;
                                break;
                            }
                        }
                    }
                }
                if (score < bestScore) {
                    bestScore = score;
                    bestTarget = target;
                } else if (score === bestScore && bestTarget) {
                    const distToBest = Math.hypot(bestTarget.x - u.x, bestTarget.y - u.y);
                    if (dist < distToBest) bestTarget = target;
                }
            }
            u.autoTarget = bestTarget; // 要不 null 要不实际单位
            return bestTarget !== null ? BT_STATUS.SUCCESS : BT_STATUS.FAILURE;
        },
        fire: (ctx) => {
            const u = ctx.unit;
            if (!u.fire || !u.validatePriorityTarget()) return BT_STATUS.FAILURE;
            u.fire();
            return BT_STATUS.SUCCESS;
        },
    }
}

class VehicleUnit extends BaseUnit {
    constructor(owner) {
        super(owner);
        this.domain = 'GROUND';
        this.state = BaseUnit.UNIT_STATE.DEPLOYING;

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

        switch (this.state) {
            case BaseUnit.UNIT_STATE.DEPLOYING: { this.doDeploy(dt); break; }
            case BaseUnit.UNIT_STATE.MOVING_TO_POS: { this.moveToPos(dt); this.tryAttackAutoTarget(dt); break; }
            case BaseUnit.UNIT_STATE.APPROACHING_CMD_TARGET:
                {
                    const target = this.cmdTarget;
                    if (!target || !target.alive) { this.resetState(); return; }
                    const dist = Math.hypot(target.x - this.x, target.y - this.y);
                    if (dist <= this.attackRange) {
                        this.navTarget = null;
                        this.move(dt, this.x, this.y);
                        this.rotate(dt, this.angle);
                        if (this.aimAtTarget(dt, target)) this.fire();
                        break;
                    }
                    this.navTarget = { x: target.x, y: target.y };
                    const targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                    this.move(dt, target.x, target.y, this.attackRange * 0.9);
                    this.rotate(dt, targetAngle);
                    if (!this.autoTarget) this.aimAtTarget(dt, target);
                    this.tryAttackAutoTarget(dt);
                    break;
                }
            case BaseUnit.UNIT_STATE.FOLLOWING: { this.followLeader(dt); break; }
            case BaseUnit.UNIT_STATE.IDLE:
                {
                    // 缓动
                    this.move(dt, this.x, this.y);
                    this.rotate(dt, this.angle);
                    // 巡逻
                    this.tryAttackAutoTarget(dt);
                    if (!this.autoTarget || !this.autoTarget.alive) this.rotateTurret(dt, this.turretAngle);
                    break;
                }
        }
    }

    tryAttackAutoTarget(dt) {
        this.scanForAutoTarget();
        const target = this.autoTarget;
        if (!target || !target.alive) return;
        const dist = Math.hypot(target.x - this.x, target.y - this.y);
        if (dist <= this.attackRange && this.aimAtTarget(dt, target)) this.fire();
    }

    updateRecoil() {
        if (this.lastFire === 0) return;
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
    aimAtTarget(dt, target) {
        if (!target || !target.alive) return;

        const angleToEnemy = Math.atan2(target.y - this.y, target.x - this.x); // 理想角度
        this.rotateTurret(dt, angleToEnemy); // 旋转炮塔

        // 精度校验
        const dist = Math.hypot(target.x - this.x, target.y - this.y); // 到目标的距离
        const angleDiff = Math.abs(this.getAngleDiff(angleToEnemy, this.turretAngle));
        const lateralError = dist * Math.sin(angleDiff); // 如果以当前角度发射，子弹离目标的距离
        // angle diff < 0.1 防止反向发射
        return angleDiff < 0.1 && lateralError < 20 && dist <= this.attackRange; // 返回是否对准
    }
}

// 狙击手
class SniperUnit extends VehicleUnit {
    static allowedTargets = [Fortress, VehicleUnit];

    constructor(owner) {
        super(owner);
        this.loadStats(CONFIG.UNIT_STATS.sniper);

        this.unitAccel = 10;
        this.unitAngMaxSpeed = 2; this.unitAngAccel = 0.5;
        this.turretMaxSpeed = 3.0; this.turretAccel = 1;
        this.collisionRadius = 40;
    }

    fire() {
        if (performance.now() - this.lastFire < this.reloadTime) return;
        this.lastFire = performance.now();
        let muzzleX = this.x + Math.cos(this.turretAngle) * 40; let muzzleY = this.y + Math.sin(this.turretAngle) * 40;
        bullets.push(new Bullet(muzzleX, muzzleY, this.turretAngle, this.bulletSpeed, this.damage, this, this.attackRange));
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
        ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = this.colorTheme; ctx.lineWidth = 2;
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
    static allowedTargets = [Fortress, VehicleUnit];

    constructor(owner) {
        super(owner);
        this.loadStats(CONFIG.UNIT_STATS.drone);

        this.domain = 'AIR';
        this.vx = 0; this.vy = 0;
        this.unitAccel = 400;
        this.unitAngMaxSpeed = 8;
        this.unitAngAccel = 4;
        this.turnSensitivity = 5.0; // 转向灵敏度
        this.collisionRadius = 20;
    }

    move(dt, tx, ty, stopRadius = 0, smoothStop = true) {
        const dx = tx - this.x; const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        // 计算期望速度
        const angleToTarget = Math.atan2(dy, dx);
        let speed = this.unitMaxSpeed;
        if (smoothStop) {
            const stopDist = (Math.hypot(this.vx, this.vy) ** 2) / (2 * this.unitAccel);
            if (dist <= stopDist + stopRadius) speed = 0;
        }
        const desiredVx = Math.cos(angleToTarget) * speed;
        const desiredVy = Math.sin(angleToTarget) * speed;
        // 计算转向力并应用惯性
        if (Math.abs(desiredVx - this.vx) <= 0.5) this.vx = desiredVx;
        else this.vx += (desiredVx - this.vx) * this.turnSensitivity * dt;
        if (Math.abs(desiredVy - this.vy) <= 0.5) this.vy = desiredVy;
        else this.vy += (desiredVy - this.vy) * this.turnSensitivity * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
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

    tryAttackAutoTarget(dt) {
        this.scanForAutoTarget();
        const target = this.autoTarget;
        if (!target || !target.alive) return;
        const { x: tx, y: ty } = target;
        const dist = Math.hypot(tx - this.x, ty - this.y);
        if (dist <= 15) { this.fire(); return; }

        this.navTarget = { x: tx, y: ty };
        const targetAngle = Math.atan2(ty - this.y, tx - this.x);
        this.move(dt, tx, ty, 0, false);
        this.rotate(dt, targetAngle);
    }

    update(dt) {
        if (!this.alive) return;
        super.update(dt);
        this.applySeparation(dt, units);

        switch (this.state) {
            case BaseUnit.UNIT_STATE.DEPLOYING: { this.doDeploy(dt); break; }
            case BaseUnit.UNIT_STATE.MOVING_TO_POS: { this.moveToPos(dt); break; }
            case BaseUnit.UNIT_STATE.APPROACHING_CMD_TARGET:
                {
                    const target = this.cmdTarget;
                    if (!target || !target.alive) { this.resetState(); return; }
                    const dist = Math.hypot(target.x - this.x, target.y - this.y);
                    if (dist <= 10) {
                        this.navTarget = null;
                        this.fire();
                        break;
                    }
                    this.navTarget = { x: target.x, y: target.y };
                    const targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                    this.rotate(dt, targetAngle);
                    this.move(dt, target.x, target.y, 0, false);
                    break;
                }
            case BaseUnit.UNIT_STATE.FOLLOWING: { this.followLeader(dt); break; }
            case BaseUnit.UNIT_STATE.IDLE: {
                this.move(dt, this.x, this.y);
                this.tryAttackAutoTarget(dt);
                if (!this.autoTarget || !this.autoTarget.alive) this.rotate(dt, this.angle);
                break;
            }
        }
    }

    fire() {
        // 触碰爆炸
        const target = this.validatePriorityTarget();
        target.takeDamage({ attacker: this, damage: this.damage });
        this.hp = 0; this.alive = false; this.state = null;
        for (let i = 0; i < 20; i++) particles.push(new Particle(this.x, this.y, '#ff4400')); // 爆炸粒子
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
        ctx.fillStyle = '#222'; ctx.strokeStyle = this.colorTheme; ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        // 核心
        ctx.beginPath();
        ctx.arc(-2, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.colorTheme;
        ctx.fill();
        // 桨叶
        const bladeAngle = (performance.now() / 20);
        ctx.strokeStyle = '#bebebe'; ctx.lineWidth = 2;
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

// 霰弹手
class ShotgunUnit extends VehicleUnit {
    static allowedTargets = [VehicleUnit, DroneUnit];

    constructor(owner) {
        super(owner);
        this.loadStats(CONFIG.UNIT_STATS.shotgun);

        this.unitAccel = 40;
        this.unitAngMaxSpeed = 6; this.unitAngAccel = 2;
        this.turretMaxSpeed = 6; this.turretAccel = 3;

        this.collisionRadius = 30;
    }

    fire() {
        if (performance.now() - this.lastFire < this.reloadTime) return;
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

// 战术日志类
class TechNotification {
    constructor(text, color) {
        this.text = text; this.color = color;
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

                ctx.shadowColor = this.color; ctx.shadowBlur = glowIntensity; ctx.fillStyle = this.color;

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
    constructor() { this.messages = []; }
    add(text, color) { this.messages.unshift(new TechNotification(text, color)); }
    draw(ctx) {
        this.messages = this.messages.filter((msg, index) => { return msg.draw(ctx, index * UI_CONFIG.msgSpacing); }); // 过滤过期的消息
    }
}
class GameConsole {
    constructor() {
        this.active = false;
        this.inputBuffer = "";
        this.cursorVisible = true;
        this.lastBlink = 0;
        this.history = [];
    }
    activate() {
        this.active = true;
        this.inputBuffer = "";
    }
    deactivate() { this.active = false; }
    handleKeyDown(e) {
        if (!blueFortress.selectedUnit || !this.active) return;
        if (e.key === 'Enter') {
            this.executeCommand();
        } else {
            if (e.key === 'Backspace') this.inputBuffer = this.inputBuffer.slice(0, -1);
            else if (e.key === 'Escape') this.deactivate();
            else if (e.key.length === 1) this.inputBuffer += e.key;
        }
    }
    // todo: 支持移动坐标，因为 console 本身就会挡住一些位置没法点击
    executeCommand() {
        const cmd = this.inputBuffer.trim().toLowerCase();
        const unit = blueFortress.selectedUnit;
        if (unit) {
            if (cmd === "autoscan off") {
                unit.isAutoScanEnabled = false;
                unit.autoTarget = null;
                uiManager.add('自主巡邏已關閉', CONFIG.blueTheme);
            } else if (cmd === "autoscan on") {
                unit.isAutoScanEnabled = true;
                uiManager.add('自主巡邏已啟用', CONFIG.blueTheme);
            } else if (cmd !== "") {
                uiManager.add('未知指令', '#777');
            }
        }
        this.inputBuffer = "";
    }
    draw(ctx) {
        const unit = blueFortress.selectedUnit;
        if (!unit || !unit.alive || !this.active) return;
        const now = performance.now();
        if (now - this.lastBlink > 500) {
            this.cursorVisible = !this.cursorVisible;
            this.lastBlink = now;
        }

        const margin = 20;
        const h = 40;
        const y = CONFIG.height - h - margin;
        const w = CONFIG.width - 2 * margin;

        ctx.save();
        // 终端背景
        ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
        ctx.strokeStyle = unit ? unit.colorTheme : '#555';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(margin + w - 15, y);
        ctx.lineTo(margin + w, y + 15);
        ctx.lineTo(margin + w, y + h);
        ctx.lineTo(margin, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 提示符与文本
        ctx.font = '18px "Courier New"';
        const theme = unit ? unit.colorTheme : '#555';
        ctx.fillStyle = theme;
        ctx.shadowBlur = 10;
        ctx.shadowColor = theme;

        const prompt = this.active ? "> " : "READY_ ";
        const text = prompt + this.inputBuffer + (this.active && this.cursorVisible ? "_" : "");

        ctx.fillText(text, margin + 15, y + 26);

        ctx.restore();
    }
}

class LevelManager {
    constructor() {
        this.currentLevel = 0;
        this.state = GAME_STATE.MENU;
        this.clearedLevels = JSON.parse(localStorage.getItem('td_cleared_levels')) || [];

        // 任务调度
        this.elapsedTime = 0;
        this.pendingTasks = [];
    }
    startLevel(levelId) {
        const level = LEVEL_DATA[levelId];
        if (!level) return;

        units = [];
        bullets = [];
        particles = [];
        this.elapsedTime = 0;
        this.pendingTasks = [];

        this.currentLevel = levelId;
        this.state = GAME_STATE.PLAYING;

        blueFortress.hp = CONFIG.maxHp;
        blueFortress.alive = true;
        blueFortress.ap = level.initAp;
        blueFortress.updateAvailableCards(level.availableUnits);
        blueFortress.switchState(Fortress.FORT_STATE.NORMAL);

        redFortress.hp = CONFIG.maxHp;
        redFortress.alive = true;

        if (level.blueUnits) this.prepareUnits(level.blueUnits, blueFortress);
        if (level.redUnits) this.prepareUnits(level.redUnits, redFortress);

        uiManager.add(`▶ 任務開始 - ${level.description}`, CONFIG.redTheme);
    }
    update(dt) {
        if (this.state !== GAME_STATE.PLAYING) return;
        this.elapsedTime += dt;

        for (let i = this.pendingTasks.length - 1; i >= 0; i--) {
            const task = this.pendingTasks[i];
            if (this.elapsedTime < task.triggerTime) continue; // 没到时间，如果任务按照时间排序，可以break掉
            if (!task.unit.alive) continue;
            // 执行预约的任务：设置目标点并切换状态
            task.unit.targetPos = { x: task.targetPos.x * CONFIG.gridWidth, y: task.targetPos.y * CONFIG.gridWidth };
            task.unit.switchState(BaseUnit.UNIT_STATE.MOVING_TO_POS);
            this.pendingTasks.splice(i, 1);
        }
        this.checkGameStatus();
    }
    checkGameStatus() {
        if (this.state !== GAME_STATE.PLAYING) return;
        if (!redFortress.alive) {
            this.state = GAME_STATE.VICTORY;
            if (!this.clearedLevels.includes(this.currentLevel)) {
                this.clearedLevels.push(this.currentLevel);
                localStorage.setItem('td_cleared_levels', JSON.stringify(this.clearedLevels));
            }
            uiManager.add('▶ 戰役勝利：敵方要塞已摧毀。點擊任意位置返回指揮中心', '#2ecc71'); // todo: 爆特效，顺便把相同阵营的剩余单位一个个爆了给特效，爆完了再给消息并listen点击回menu
        } else if (!blueFortress.alive) {
            this.state = GAME_STATE.DEFEAT;
            uiManager.add('▶ 戰役失敗：要塞失守。點擊任意位置返回指揮中心', CONFIG.redTheme);   // todo: 如果玩家选择重开/退出，也当作失败
        }
    }
    prepareUnits(levelUnits, fort) {
        levelUnits.forEach(unitData => {
            const stats = CONFIG.UNIT_STATS[unitData.type];
            if (!stats) return;

            let u = new stats.class(fort);
            units.push(u);
            u.isAutoScanEnabled = true;

            u.x = unitData.x * CONFIG.gridWidth; u.y = unitData.y * CONFIG.gridWidth;

            if (unitData.angle !== undefined) {
                const deg = unitData.angle + (Math.random() - 0.5) * 20;
                const rad = (deg * Math.PI) / 180;
                u.angle = rad;
                if (u.turretAngle !== undefined) u.turretAngle = rad;
            }

            if (unitData.time > 0 && unitData.targetPos) {
                u.switchState(BaseUnit.UNIT_STATE.IDLE);
                this.pendingTasks.push({
                    triggerTime: unitData.time,
                    unit: u,
                    targetPos: unitData.targetPos
                });
            } else if (unitData.targetPos) { // 没有执行刻
                u.targetPos = { x: unitData.targetPos.x * CONFIG.gridWidth, y: unitData.targetPos.y * CONFIG.gridWidth };
                u.switchState(BaseUnit.UNIT_STATE.MOVING_TO_POS);
            } else {
                u.switchState(BaseUnit.UNIT_STATE.IDLE);
            }
        });
    }
}

class LevelSelectUI {
    draw(ctx) {
        ctx.save();
        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = CONFIG.blueTheme;
        ctx.font = 'bold 40px "Microsoft JhengHei"';
        ctx.fillText('戰區指揮中心', CONFIG.width / 2, 150);

        const levelIds = Object.keys(LEVEL_DATA);
        const btnW = 300;
        const btnH = 60;

        levelIds.forEach((id, index) => {
            const lid = parseInt(id);
            const isUnlocked = lid === 1 || levelManager.clearedLevels.includes(lid - 1);
            const isCleared = levelManager.clearedLevels.includes(lid);

            const x = CONFIG.width / 2 - btnW / 2;
            const y = 250 + index * 80;

            // 绘制按钮
            ctx.strokeStyle = isUnlocked ? CONFIG.blueTheme : '#444';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, btnW, btnH);

            if (isUnlocked) {
                ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
                ctx.fillRect(x, y, btnW, btnH);
            }

            ctx.fillStyle = isUnlocked ? '#fff' : '#666';
            ctx.font = '20px "Microsoft JhengHei"';
            let statusText = isCleared ? ' [ 已完成 ]' : '';
            if (!isUnlocked) statusText = ' [ 鎖定 ]';

            ctx.fillText(`區域 ${lid}: ${LEVEL_DATA[id].name}${statusText}`, CONFIG.width / 2, y + 37);
        });
        ctx.restore();
    }

    handleInput(mx, my) {
        if (levelManager.state !== GAME_STATE.MENU) {
            levelManager.state = GAME_STATE.MENU;
            return;
        }

        const levelIds = Object.keys(LEVEL_DATA);
        const btnW = 300;
        levelIds.forEach((id, index) => {
            const lid = parseInt(id);
            const isUnlocked = lid === 1 || levelManager.clearedLevels.includes(lid - 1);
            if (!isUnlocked) return;

            const x = CONFIG.width / 2 - btnW / 2;
            const y = 250 + index * 80;

            if (mx >= x && mx <= x + btnW && my >= y && my <= y + 60) {
                levelManager.startLevel(lid);
            }
        });
    }
}

class Camera {
    constructor() {
        // 核心坐标与缩放
        this.x = CONFIG.worldWidth / 2;
        this.y = CONFIG.worldHeight / 2;
        this.zoomPivotX = CONFIG.width / 2;
        this.zoomPivotY = CONFIG.height / 2;

        // 限制参数
        this.minZoom = Math.max(CONFIG.width / CONFIG.worldWidth, CONFIG.height / CONFIG.worldHeight);
        this.zoom = this.targetZoom = this.minZoom;
        this.maxZoom = 1.6;
        this.zoomFriction = 0.15;

        // 运动与拖拽
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.98;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.startX = 0;
        this.startY = 0;
        this.dragThreshold = 5;

        // 特效
        this.shake = 0;

        // 初始化缩放
        this.zoom = this.targetZoom = this.minZoom;
    }

    update(dt) {
        // 处理缩放平滑过渡
        if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
            const worldBefore = this.screenToWorld(this.zoomPivotX, this.zoomPivotY);
            this.zoom += (this.targetZoom - this.zoom) * this.zoomFriction;
            const worldAfter = this.screenToWorld(this.zoomPivotX, this.zoomPivotY);
            this.x -= (worldAfter.x - worldBefore.x);
            this.y -= (worldAfter.y - worldBefore.y);
        } else {
            this.zoom = this.targetZoom;
        }

        // 处理惯性移动
        if (!this.isDragging) {
            if (Math.abs(this.vx) > 0.01) {
                this.x += this.vx;
                this.vx *= this.friction;
            } else {
                this.vx = 0;
            }
            if (Math.abs(this.vy) > 0.01) {
                this.y += this.vy;
                this.vy *= this.friction;
            } else {
                this.vy = 0;
            }
        }

        // 震动衰减
        if (this.shake > 0) {
            this.x += (Math.random() - 0.5) * this.shake;
            this.y += (Math.random() - 0.5) * this.shake;
            this.shake *= 0.94;
            if (this.shake < 0.05) this.shake = 0;
        }

        this.clamp();
    }

    clamp() {
        const halfVisibleWidth = (CONFIG.width / 2) / this.zoom;
        const halfVisibleHeight = (CONFIG.height / 2) / this.zoom;

        if (CONFIG.worldWidth < halfVisibleWidth * 2) {
            this.x = CONFIG.worldWidth / 2;
        } else {
            this.x = Math.max(halfVisibleWidth, Math.min(CONFIG.worldWidth - halfVisibleWidth, this.x));
        }

        if (CONFIG.worldHeight < halfVisibleHeight * 2) {
            this.y = CONFIG.worldHeight / 2;
        } else {
            this.y = Math.max(halfVisibleHeight, Math.min(CONFIG.worldHeight - halfVisibleHeight, this.y));
        }
    }

    screenToWorld(sx, sy) {
        const x = (sx - CONFIG.width / 2) / this.zoom + this.x;
        const y = (sy - CONFIG.height / 2) / this.zoom + this.y;
        return { x, y };
    }

    worldToScreen(wx, wy) {
        const sx = (wx - this.x) * this.zoom + CONFIG.width / 2;
        const sy = (wy - this.y) * this.zoom + CONFIG.height / 2;
        return { x: sx, y: sy };
    }
}

const CONFIG = {
    width: 1200, height: 800,
    worldWidth: 2400, worldHeight: 1600,
    gridWidth: 100,
    maxHp: 1000, maxAp: 300,
    fortressSizes: [80, 50],
    blueTheme: '#3498db', redTheme: '#e74c3c',

    cardWidth: 140, cardHeight: 50,

    UNIT_STATS: {
        sniper: {
            class: SniperUnit, name: '狙擊手',
            cost: 50, hp: 1000, maxSpeed: 50, attackRange: 500,
            damage: 200, reloadTime: 2.0, bulletSpeed: 1500,
            priorityMap: new Map([[SniperUnit, 1], [ShotgunUnit, 2], [Fortress, 3]]),
        },
        drone: {
            class: DroneUnit, name: '無人機',
            cost: 30, hp: 20, maxSpeed: 300, attackRange: 600,
            damage: 500, reloadTime: null, bulletSpeed: null,
            priorityMap: new Map([[ShotgunUnit, 1], [SniperUnit, 2], [Fortress, 3]]),
        },
        shotgun: {
            class: ShotgunUnit, name: '霰彈兵',
            cost: 40, hp: 250, maxSpeed: 160, attackRange: 350,
            damage: 20, reloadTime: 1.0, bulletSpeed: 800,
            priorityMap: new Map([[DroneUnit, 1], [SniperUnit, 2], [Fortress, 3]]),
        },
    },
};

const UI_CONFIG = {
    msgX: 20, msgY: 40,
    msgSpacing: 35,
    charDelay: 30,      // 0.03s 逐字出现
    glowDuration: 200,  // 0.2s 荧光衰减
    msgLife: 6000,      // 消息持续时间
    fadeOutTime: 1000   // 1s 消息渐变消失
};

let units = []; let bullets = []; let particles = [];
let lastTime = performance.now();
let unitIdCounter = 1; // 从 1 开始，避免 0 ID 被判假

const blueFortress = new Fortress(0, CONFIG.worldHeight / 2, 'blue', 100000);
const redFortress = new Fortress(CONFIG.worldWidth, CONFIG.worldHeight / 2, 'red', 100001);
const allForts = [blueFortress, redFortress];
const uiManager = new NotificationManager();
const gameConsole = new GameConsole();
const camera = new Camera();
const levelManager = new LevelManager();
const levelSelectUI = new LevelSelectUI();
levelManager.state = GAME_STATE.MENU;
// 制作关卡时开启以下两行
levelManager.startLevel(2);
levelManager.state = GAME_STATE.PLAYING;

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    camera.isDragging = true;
    camera.lastMouseX = mx; camera.lastMouseY = my;
    camera.startX = mx; camera.startY = my;

    camera.vx = 0; camera.vy = 0;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    camera.zoomPivotX = mx; camera.zoomPivotY = my;

    const zoomSpeed = 0.001;
    camera.targetZoom = Math.min(Math.max(camera.targetZoom + (-e.deltaY * zoomSpeed), camera.minZoom), camera.maxZoom);
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    blueFortress.handleInput(mx, my, 'rightclick');
});

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    if (camera.isDragging) {
        const dx = (mx - camera.lastMouseX) / camera.zoom;
        const dy = (my - camera.lastMouseY) / camera.zoom;

        camera.x -= dx; camera.y -= dy;

        camera.vx = (camera.vx * 0.5) - (dx * 0.5); // 加权平均
        camera.vy = (camera.vy * 0.5) - (dy * 0.5);
        camera.lastMouseX = mx; camera.lastMouseY = my;
        camera.clamp();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !camera.isDragging) return;
    camera.isDragging = false;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    const dist = Math.hypot(mx - camera.startX, my - camera.startY);

    if (dist < camera.dragThreshold) {
        if (levelManager.state === GAME_STATE.VICTORY || levelManager.state === GAME_STATE.DEFEAT) {
            levelManager.state = GAME_STATE.MENU;
        } else if (levelManager.state === GAME_STATE.PLAYING) {
            blueFortress.handleInput(mx, my, 'click');
        } else {
            levelSelectUI.handleInput(mx, my);
        }
        camera.vx = 0; camera.vy = 0;
    }
});

window.addEventListener('keydown', (e) => { gameConsole.handleKeyDown(e); });

function drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
    ctx.beginPath();
    for (let x = 0; x <= CONFIG.worldWidth; x += CONFIG.gridWidth) { ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.worldHeight); }
    for (let y = 0; y <= CONFIG.worldHeight; y += CONFIG.gridWidth) { ctx.moveTo(0, y); ctx.lineTo(CONFIG.worldWidth, y); }
    ctx.stroke();
    ctx.restore();
}
function gameLoop(now) {
    const dt = (now - lastTime) / 1000; lastTime = now;

    if (levelManager.state !== GAME_STATE.MENU) {
        camera.update(dt);
        levelManager.update(dt);

        // 背景与网格
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

        ctx.save();
        ctx.translate(CONFIG.width / 2, CONFIG.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);
        drawGrid(ctx);

        blueFortress.update(dt); redFortress.update(dt);

        units = units.filter(u => u.alive || particles.length > 0);
        bullets = bullets.filter(b => b.alive);
        particles = particles.filter(p => p.life > 0);

        units.filter(u => u.domain === 'GROUND').forEach(u => { u.update(dt); u.draw(ctx); });
        bullets.forEach(b => { b.update(dt, units, blueFortress, redFortress, particles); b.draw(ctx); });
        particles.forEach(p => { p.update(dt); p.draw(ctx); });
        blueFortress.drawBase(ctx); redFortress.drawBase(ctx);
        units.filter(u => u.domain === 'AIR').forEach(u => { u.update(dt); u.draw(ctx); });

        ctx.restore();

        blueFortress.drawOverlay(ctx);
        uiManager.draw(ctx);
        gameConsole.draw(ctx);
    } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        levelSelectUI.draw(ctx);
    }
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);