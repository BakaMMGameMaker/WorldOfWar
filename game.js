// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BT_STATUS = { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE', RUNNING: 'RUNNING' };

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
        const mainBlue = '#3498db'; const neonBlue = '#00f2ff';

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

// 要塞
class Fortress {
    static FORTRESS_STATE = { NORMAL: 'NORMAL', SHOW_CARDS: 'SHOW_CARDS', DEPLOYING: 'PLACING', COMMANDING: 'COMMANDING' };

    constructor(side, x, y, colorTheme) {
        this.side = side;
        this.x = x; this.y = y;
        this.hp = CONFIG.maxHp; this.alive = true;
        this.ap = 0;
        this.colorTheme = colorTheme;
        this.isAI = side === 'red';
        this.isAI = false;

        if (this.isAI) {
            // 待接入 LLM
        }
        else {
            this.state = Fortress.FORTRESS_STATE.NORMAL;
            this.selectedUnitData = null; this.selectedUnit = null;
            this.cards = CONFIG.cards.map((u, index) => {
                const startX = 120; const startY = 300 + (index * 70);
                return new UnitCard(u, startX, startY, this);
            });
        }
    }

    processAICommands(jsonCommands) {
        if (!this.alive) return ['行動失敗：要塞已毀損']; // 注意，发现死亡之后，以后就不要再给 LLM 发消息了
        try {
            const data = typeof jsonCommands === 'string' ? JSON.parse(jsonCommands) : jsonCommands;
            if (!data.actions || !Array.isArray(data.actions)) return ['格式錯誤：未發現 actions 列表'];
            return data.actions.map((action, index) => {
                const prefix = `[指令 #${index + 1} ${action.cmd}] `;
                if (!action.cmd) return prefix + '錯誤：缺少 cmd 字段';
                if (!action.target) return prefix + '錯誤：缺少 target 字段';
                switch (action.cmd) {
                    case 'DEPLOY':
                        return prefix + this.executeAiDeploy(action.type, action.target);
                    case 'ORDER':
                        return prefix + this.executeAiOrder(action.id, action.target);
                    default:
                        return prefix + `錯誤：無效指令類型 ${action.cmd}`;
                }
            });
        } catch (e) {
            return ['JSON 解析失敗：請確保輸出標準的 JSON 格式'];
        }
    }

    inferTask(unitClass, targetRef) {
        if (!targetRef) return { ok: false, reason: '未指定 target' };
        // 坐标
        if (typeof targetRef === 'object' && targetRef.x !== undefined && targetRef.y !== undefined) {
            const tx = targetRef.x; const ty = targetRef.y;
            const allForts = [blueFortress, redFortress];
            for (let f of allForts) {
                if (Math.hypot(tx - f.x, ty - f.y) <= CONFIG.fortressSizes[0]) {
                    if (f.side === this.side) return { ok: false, reason: '禁止鎖定己方要塞' };
                    if (!BaseUnit.canClassAttack(unitClass, f)) return { ok: false, reason: '該兵種無法攻擊要塞' };
                    return { ok: true, task: 'ATTACK', finalTarget: f };
                }
            }
            return { ok: true, task: 'MOVE', finalTarget: { x: tx, y: ty } };
        }
        // 特定字符串
        if (targetRef === 'FORTRESS_blue' || targetRef === 'FORTRESS_red') {
            const targetFort = (targetRef === 'FORTRESS_blue') ? blueFortress : redFortress;
            if (targetFort.side === this.side) return { ok: false, reason: '禁止鎖定己方要塞' };
            if (!BaseUnit.canClassAttack(unitClass, targetFort)) return { ok: false, reason: '該兵種無法攻擊要塞' };
            return { ok: true, task: 'ATTACK', finalTarget: targetFort };
        }
        // 单位 ID
        if (typeof targetRef === 'number') {
            const targetUnit = units.find(u => u.unitId === targetRef && u.alive);
            if (!targetUnit) return { ok: false, reason: `目標單位 ID ${targetRef} 不存在或已陣亡` };
            if (targetUnit.side === this.side) {
                return { ok: true, task: 'FOLLOW', finalTarget: targetUnit };
            } else {
                if (!BaseUnit.canClassAttack(unitClass, targetUnit)) return { ok: false, reason: '無法鎖定該目標' };
                return { ok: true, task: 'ATTACK', finalTarget: targetUnit };
            }
        }
        return { ok: false, reason: '無法識別的目標格式' };
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
        const unit = units.find(u => u.unitId === unitId && u.side === this.side && u.alive);
        if (!unit) return `失敗：找不到 ID 為 ${unitId} 的存活友軍`;

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
                unit.targetX = finalTarget.x;
                unit.targetY = finalTarget.y;
                unit.hasMoveOrder = true;
                return `移至坐標 (${Math.floor(unit.targetX)}, ${Math.floor(unit.targetY)})`;
            case 'ATTACK':
                unit.cmdTarget = finalTarget;
                const name = (finalTarget instanceof Fortress) ? '敵軍要塞' : `敵機 ${finalTarget.unitId}`;
                return `正在進攻 ${name}`;
            case 'FOLLOW':
                unit.followTarget = finalTarget;
                return `跟隨友方單位 ${finalTarget.unitId}`;
            default:
                return '進入待機模式';
        }
    }

    switchState(newState) {
        if (newState === Fortress.FORTRESS_STATE.NORMAL) {
            this.cards.forEach(card => { if (card.state === 'SELECTED') card.state = 'AVAILABLE'; });
            if (this.selectedUnit) this.selectedUnit.isSelected = false;
            this.selectedUnit = null; this.selectedUnitData = null;
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
        if (!this.isAI && this.state === Fortress.FORTRESS_STATE.SHOW_CARDS) this.cards.forEach(card => card.update());
    }

    takeDamage(amt) {
        this.hp -= amt;
        if (this.hp > 0) return;
        this.hp = 0;
        this.alive = false;
    }

    getClickedUnit(mx, my, radius) {
        let clickedUnit = null;
        for (let u of units) {
            if (!u.alive) continue;
            const sPos = worldToScreen(u.x, u.y);
            const d = Math.hypot(sPos.x - mx, sPos.y - my);
            if (d > radius) continue;
            radius = d;
            clickedUnit = u;
        }
        return clickedUnit;
    }

    handleInput(mx, my, type, otherFortress) {
        const worldPos = screenToWorld(mx, my);
        const wx = worldPos.x;
        const wy = worldPos.y;

        const clickedSelf = this.isClicked(wx, wy);
        let isUIClicked = false;
        const allFortresses = [this, otherFortress];

        let clickedUnit = this.getClickedUnit(mx, my, 35);

        switch (this.state) {
            case Fortress.FORTRESS_STATE.NORMAL:
                if (type !== 'click') return false;
                // 点击要塞
                if (clickedSelf) {
                    this.switchState(Fortress.FORTRESS_STATE.SHOW_CARDS);
                    return true; // click self
                }
                // 点击己方单位
                if (clickedUnit && clickedUnit.side === this.side) {
                    this.selectedUnit = clickedUnit;
                    this.switchState(Fortress.FORTRESS_STATE.COMMANDING);
                    return true; // click unit
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
                    if (result.action === 'DEPLOYING') {
                        this.selectedUnitData = result.unit;
                        this.switchState(Fortress.FORTRESS_STATE.DEPLOYING);
                        break;
                    }
                }
                break;

            case Fortress.FORTRESS_STATE.DEPLOYING:
                if (type !== 'click') {
                    uiManager.add('指令已取消', '#ccc');
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return false;
                }
                let deployingTarget = null;
                let followTarget = null;
                // 点击要塞
                for (let f of allFortresses) {
                    if (!f.isClicked(wx, wy)) continue;
                    if (f.side === 'blue') {
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true; // click fortress
                    }
                    if (!BaseUnit.canClassAttack(this.selectedUnitData.class, f)) {
                        uiManager.add('無法鎖定該目標', '#ff4444');
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true;
                    }
                    isUIClicked = true; // click fortress
                    deployingTarget = f;
                }
                // 点击单位，友方跟随，敌方攻击
                if (!deployingTarget && clickedUnit) {
                    if (clickedUnit.side !== this.side) {
                        if (!BaseUnit.canClassAttack(this.selectedUnitData.class, clickedUnit)) {
                            uiManager.add('無法鎖定該目標', '#ff4444');
                            this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                            return true;
                        }
                        deployingTarget = clickedUnit;
                    } else {
                        followTarget = clickedUnit;
                    }
                    isUIClicked = true; // click any unit
                }
                // 费用检查
                if (this.ap < this.selectedUnitData.cost) {
                    uiManager.add('行動值不足', '#ff4444');
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return true; // placing
                }
                this.ap -= this.selectedUnitData.cost;
                let u = new this.selectedUnitData.class(this);
                units.push(u);
                if (deployingTarget) {
                    u.cmdTarget = deployingTarget;
                } else if (followTarget) {
                    u.followTarget = followTarget;
                } else {
                    u.hasMoveOrder = true;
                    u.targetX = wx; u.targetY = wy;
                }
                uiManager.add(`${this.selectedUnitData.name} 已投入戰場`, this.colorTheme);
                this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                break;

            case Fortress.FORTRESS_STATE.COMMANDING:
                if (!this.selectedUnit || !this.selectedUnit.alive) { // 单位中途阵亡
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return false;
                }
                if (type !== 'click') {
                    uiManager.add('指令已取消', '#ccc');
                    this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                    return false;
                }
                let cmdTarget = null;
                // 单位目标
                if (clickedUnit) {
                    if (clickedUnit === this.selectedUnit) {
                        uiManager.add('指令已取消', '#ffffff');
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true;
                    }
                    if (clickedUnit.side === this.side) {
                        if (clickedUnit.followTarget === this.selectedUnit) {
                            uiManager.add('禁止循環跟隨', '#ff4444');
                        } else {
                            this.selectedUnit.resetState();
                            this.selectedUnit.followTarget = clickedUnit;
                            uiManager.add(`已跟隨指定單位`, this.colorTheme);
                        }
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true;
                    }
                    if (!this.selectedUnit.canAttack(clickedUnit)) {
                        uiManager.add('無法鎖定該目標', '#ff4444');
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true;
                    }
                    isUIClicked = true; // click any unit
                    cmdTarget = clickedUnit;
                }
                // 要塞目标
                for (let f of allFortresses) {
                    if (!f.isClicked(wx, wy)) continue;
                    if (f.side === this.side) {
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true; // click self
                    }
                    if (!this.selectedUnit.canAttack(f)) {
                        uiManager.add('無法鎖定該目標', '#ff4444');
                        this.switchState(Fortress.FORTRESS_STATE.NORMAL);
                        return true;
                    }
                    isUIClicked = true; // click fortress
                    cmdTarget = f;
                    break;
                }
                // 攻击敌方单位或移动
                this.selectedUnit.resetState();
                if (cmdTarget) {
                    this.selectedUnit.cmdTarget = cmdTarget;
                    uiManager.add(`已鎖定目標`, this.colorTheme);
                } else {
                    this.selectedUnit.targetX = wx; this.selectedUnit.targetY = wy;
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
        if (this.state === Fortress.FORTRESS_STATE.DEPLOYING) {
            this.drawDeployingOverlay(ctx);
        }
    }

    drawDeployingOverlay(ctx) {
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

    isClicked(wx, wy) { return Math.hypot(wx - this.x, wy - this.y) < CONFIG.fortressSizes[0]; }
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
            if (u.side !== this.owner.side && u.alive && this.owner.canAttack(u)) {
                if (Math.hypot(this.x - u.x, this.y - u.y) < 25) { // 命中半径
                    u.takeDamage(this.damage);
                    this.onHit(particles);
                    return;
                }
            }
        }
        const targetFort = this.owner.side === 'blue' ? redFort : blueFort;
        if (!this.owner.canAttack(targetFort)) return;
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
    static canClassAttack(unitCls, target) {
        if (!target || !target.alive) return false;
        const allowed = unitCls.allowedTargets || [];
        return allowed.some(cls => target instanceof cls);
    }

    constructor(owner) {
        // 基本信息
        this.owner = owner;
        this.side = owner.side;
        this.unitId = unitIdCounter++;
        this.colorTheme = owner.colorTheme;
        this.alive = true;

        // 运动状态
        this.x = (this.side === 'blue') ? 0 : CONFIG.worldWidth; this.y = CONFIG.worldHeight / 2;
        this.angle = (this.side === 'blue') ? 0 : Math.PI;
        this.vel = 0; this.angVel = 0;

        // 行为状态
        this.targetX = this.targetY = null;
        this.cmdTarget = null;    // 要塞指定的敌方单位
        this.autoTarget = null;   // 自动扫描发现的敌军
        this.followTarget = null; // 要跟随的单位
        this.isDeploying = true;
        this.hasMoveOrder = false;
        this.isNavigating = false;
        this.isSelected = false;

        // 动画数据
        this.reloadFlashTimer = 0;
        this.reloadFlashDuration = 0.15;
        this.lastReloaded = true;

        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.15;
    }

    loadStats(stats) {
        this.maxHp = this.hp = stats.hp;
        this.attackRange = stats.attackRange;
        this.reloadTime = stats.reloadTime * 1000;
        this.unitMaxSpeed = stats.maxSpeed;
        this.bulletSpeed = stats.bulletSpeed;
        this.damage = stats.damage;
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

    getPriorityTarget() {
        if (this.cmdTarget && this.cmdTarget.alive) return this.cmdTarget;
        this.cmdTarget = null;
        if (this.autoTarget && this.autoTarget.alive) return this.autoTarget;
        this.autoTarget = null;
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
        if (this.followTarget && this.followTarget.alive) {
            this.drawFollowLink(ctx);
            return;
        }

        if (!this.isNavigating) return;
        const tx = this.targetX;
        const ty = this.targetY;
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
        if (this.isDeploying || this.domain != 'GROUND') return;
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
        // 生命值
        const endAngle = startAngle + (Math.PI * 2 * hpPercent);
        ctx.arc(0, 0, 48, startAngle, endAngle, false);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        const pulse = Math.sin(now / 400) * 0.02 + 0.03;
        ctx.beginPath();
        ctx.arc(0, 0, this.attackRange, 0, Math.PI * 2);
        ctx.fillStyle = this.colorTheme;
        ctx.globalAlpha = pulse;
        ctx.fill();
        ctx.restore();

        let reloadPercent = 1;
        if (this.fireCD && this.lastFire) {
            const elapsed = now - this.lastFire;
            reloadPercent = Math.min(1, elapsed / this.fireCD);
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
        this.cmdTarget = null;
        this.autoTarget = null;
        this.followTarget = null;
        this.isNavigating = false;
        this.hasMoveOrder = false;
    }

    static AI = {
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
        moveToTarget: (ctx) => {
            const u = ctx.unit;
            if (!u.hasMoveOrder) return BT_STATUS.FAILURE;
            const dist = Math.hypot(u.targetX - u.x, u.targetY - u.y);
            if (dist < 15 && u.vel < 5) {
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
            if (!u.fire || !u.getPriorityTarget()) return BT_STATUS.FAILURE;
            u.fire();
            return BT_STATUS.SUCCESS;
        },
        followLeader: (ctx) => {
            const u = ctx.unit;
            const leader = u.followTarget;

            // 领队不存在
            if (!leader || !leader.alive) {
                u.followTarget = null;
                return BT_STATUS.FAILURE;
            }

            // 协助领队但不主动追击
            const leaderPriorityTarget = leader.getPriorityTarget();
            if (leaderPriorityTarget && u.canAttack(leaderPriorityTarget)) {
                const distToEnemy = Math.hypot(leaderPriorityTarget.x - u.x, leaderPriorityTarget.y - u.y);
                if (distToEnemy <= u.attackRange) {
                    u.autoTarget = leaderPriorityTarget;
                }
            }

            // 跟随移动
            const distToLeader = Math.hypot(leader.x - u.x, leader.y - u.y);
            const stopDist = u.collisionRadius + leader.collisionRadius + 20;

            if (distToLeader > stopDist) {
                const targetAngle = Math.atan2(leader.y - u.y, leader.x - u.x);
                u.rotate(ctx.dt, targetAngle);
                u.move(ctx.dt, leader.x, leader.y, stopDist);
                return BT_STATUS.RUNNING;
            } else {
                u.rotate(ctx.dt, leader.angle);
                return BT_STATUS.SUCCESS;
            }
        },
        idle: (ctx) => {
            const u = ctx.unit;
            u.resetState();
            return BT_STATUS.SUCCESS;
        },
    }
}

class VehicleUnit extends BaseUnit {
    constructor(owner) {
        super(owner);
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
            if (u.cmdTarget) return BT_STATUS.FAILURE;
            const found = units.find(target =>
                target.side !== u.side && target.alive && u.canAttack(target) &&
                Math.hypot(target.x - u.x, target.y - u.y) <= u.attackRange
            );
            u.autoTarget = found || null;
            return found ? BT_STATUS.SUCCESS : BT_STATUS.FAILURE;
        },
        approachCmdTarget: (ctx) => {
            const u = ctx.unit;
            const target = u.cmdTarget;
            if (!target || !target.alive) {
                u.cmdTarget = null;
                return BT_STATUS.FAILURE;
            }
            u.targetX = target.x; u.targetY = target.y;
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
    static allowedTargets = [Fortress, VehicleUnit];

    constructor(owner) {
        super(owner);
        this.loadStats(CONFIG.UNIT_STATS.sniper);

        this.unitAccel = 10;
        this.unitAngMaxSpeed = 2; this.unitAngAccel = 0.5;
        this.turretMaxSpeed = 3.0; this.turretAccel = 1;
        this.collisionRadius = 40;

        this.btRoot = new Sequence([
            new Selector([
                new Sequence([new Action(BaseUnit.AI.isDeploying), new Action(BaseUnit.AI.doDeploy)]),
                new Action(BaseUnit.AI.moveToTarget),
                new Sequence([
                    new Action(VehicleUnit.AI.approachCmdTarget),
                    new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)
                ]),
                new Sequence([
                    new Action(BaseUnit.AI.followLeader),
                    new Selector([
                        new Sequence([new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)]),
                        new Action((ctx) => BT_STATUS.SUCCESS) // 防止进 idle
                    ])
                ]),
                new Action(BaseUnit.AI.idle),
            ])
        ]);
    }

    fire() {
        if (performance.now() - this.lastFire < this.reloadTime) return BT_STATUS.RUNNING;
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

    static AI = {
        approachCmdTarget: (ctx) => {
            const u = ctx.unit;
            const target = u.cmdTarget;
            if (!target || !target.alive) {
                u.cmdTarget = null;
                return BT_STATUS.FAILURE;
            }
            u.targetX = target.x; u.targetY = target.y;
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            const minDist = target instanceof Fortress ? u.collisionRadius + 5 : 5;
            if (dist <= minDist) return BT_STATUS.SUCCESS; // 触碰爆炸

            u.isNavigating = true;
            const targetAngle = Math.atan2(target.y - u.y, target.x - u.x);
            u.rotate(ctx.dt, targetAngle);
            u.move(ctx.dt, target.x, target.y, 0, false);
            return BT_STATUS.RUNNING;
        },
    };

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

        this.btRoot = new Selector([
            new Sequence([new Action(BaseUnit.AI.isDeploying), new Action(BaseUnit.AI.doDeploy)]),
            new Action(BaseUnit.AI.moveToTarget),
            new Sequence([new Action(DroneUnit.AI.approachCmdTarget), new Action(BaseUnit.AI.fire)]),
            new Sequence([
                new Action(BaseUnit.AI.followLeader),
                new Selector([
                    new Action(BaseUnit.AI.fire),
                    new Action((ctx) => BT_STATUS.SUCCESS) // 防止进 idle
                ])
            ]),
            new Action(BaseUnit.AI.idle),
        ]);
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

    update(dt) {
        if (!this.alive) return;
        super.update(dt);
        this.applySeparation(dt, units);

        const oldX = this.x; const oldY = this.y;
        const oldAngle = this.angle;
        if (this.btRoot) this.btRoot.tick({ unit: this, dt: dt });
        if (this.x === oldX && this.y === oldY && (this.vx != 0 || this.vy != 0)) this.move(dt, this.x, this.y);
        if (this.angle === oldAngle && this.angVel != 0) this.rotate(dt, this.angle);
    }

    fire() {
        // 触碰爆炸
        const target = this.cmdTarget;
        target.takeDamage(this.damage);
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

        this.btRoot = new Selector([
            // 部署阶段
            new Sequence([new Action(BaseUnit.AI.isDeploying), new Action(BaseUnit.AI.doDeploy)]),
            // 要塞指令
            new Action(BaseUnit.AI.moveToTarget),
            new Sequence([
                new Action(VehicleUnit.AI.approachCmdTarget),
                new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)
            ]),
            // 自动战斗
            new Sequence([
                new Action(VehicleUnit.AI.scanArea), new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)
            ]),
            // 小队跟随
            new Sequence([
                new Action(BaseUnit.AI.followLeader),
                new Selector([
                    new Sequence([new Action(VehicleUnit.AI.aimAtTarget), new Action(BaseUnit.AI.fire)]),
                    new Action((ctx) => BT_STATUS.SUCCESS) // 防止进 idle
                ])
            ]),
            new Action(BaseUnit.AI.idle),
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

class BattlefieldReporter {
    constructor(side) {
        this.side = side;
        this.reportInterval = 2000; // 20 秒总结一次
        this.timer = 0;
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
# 戰場指揮官系統指令集
你現在是戰場指揮系統 AI。每${this.reportInterval}秒，你會收到來自前線分析員發送的JSON格式戰況。你需要分析戰局，部署單位並下達指令，最終摧毀敵方要塞。

## 1. 環境參數
- 戰場尺寸: ${CONFIG.worldWidth} x ${CONFIG.worldHeight}。
- 陣營: 你指揮 [${this.side.toUpperCase()}] 陣營。
- 要塞坐標: 藍方要塞 (0, ${CONFIG.worldHeight / 2}), 紅方要塞 (${CONFIG.worldWidth}, ${CONFIG.worldHeight / 2})。
- 要塞屬性: HP ${CONFIG.maxHp}, 最大行動值(AP) ${CONFIG.maxAp}, AP 恢復速率: ${CONFIG.apRegenPerSecond} AP/sec。

## 2. 兵種數據手冊
| 兵種 | AP | HP | 移速 | 射程 | 傷害 | 裝填時間 | 子彈速度 | 攻擊目標 | 兵種描述 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows}

## 3. 單位 AI 行為邏輯 (優先級從高到低)
單位在每一時刻僅執行一個最高優先級的行為。下達新指令會立即中斷並清除當前正在執行的低優先級指令。

1. **手動移動 (Move Order)**: 
   - 當收到坐標指令時，單位全力向目標點移動。
   - **互斥性**: 進入移動狀態會立即清除“鎖定目標”和“跟隨”狀態。
   - **停止**: 到達目標點附近後進入“待機(Idle)”狀態。
2. **強制鎖定 (Lock-on/Cmd Target)**:
   - 單位會持續追逐指定 ID 的敵軍，直至進入射程並開火或自爆。
   - **持久性**: 除非目標死亡或不可見、或單位收到新指令，否則單位將持續追逐目標。
   - **載具特性**: 擁有砲管的單位在開火前，砲塔需要一定的旋轉瞄準時間。若目標移動過快，可能導致無法精確射擊。
3. **戰術跟隨 (Follow)**:
   - 單位與友方領頭保持安全距離並同步移動。
   - **協同攻擊**: 跟隨者會嘗試攻擊“領頭單位”正在攻擊的目標。若目標不在射程內，跟隨者不會獨自衝鋒，而是優先保持隊形。
4. **自動掃描 (Auto Scan/Idle)**:
   - 若無任何指令，某些單位會自動掃描射程內的敵軍並攻擊。

## 4. 指令輸出規範 (JSON Actions)
你必須輸出一個包含 "thoughts" 字符串與 "actions" 數組的 JSON 作為指令。"thoughts" 用來描述你目前的戰術考量、"actions" 用來存放你下達的所有指示。

### 指令類型：
1. **DEPLOY (部署)**: { "cmd": "DEPLOY", "type": "兵種typename", "target": 目標 }
2. **ORDER (集結/重定向)**: { "cmd": "ORDER", "id": 單位ID, "target": 目標 }

## 5.目標 (target) 類型說明:
- 座標: { "x": number, "y": number }
- 要塞: "FORTRESS_blue" 或 "FORTRESS_red"
- 單位: 直接填寫數字 ID

### A. 當目標是「坐標 {x, y}」時：
1. **進攻**: 如果坐標落在「敵方要塞」範圍內，單位將進入進攻要塞的狀態。
2. **移動**: 如果坐標是空地，單位將前往該點，到達後進入待機模式。
3. **檢查**: 禁止鎖定己方要塞坐標。

### B. 當目標是「單位 ID (數字)」時：
1. **跟隨 (FOLLOW)**: 如果 ID 是「友軍」，單位將保持距離並跟隨該友軍。
2. **進攻 (ATTACK)**: 如果 ID 是「敵軍」，單位將持續追擊該敵軍直至進入射程或自爆。
3. **檢查**: 如果該兵種無法攻擊目標類型（見手冊），指令將被攔截。

### 目標 (target) 範例：
- 坐標: \`{ "x": 100, "y": 200 }\`
- 敵方要塞 (快捷方式): \`"FORTRESS_blue"\` 或 \`"FORTRESS_red"\`
- 特定單位: \`105\` (直接填寫數字 ID)

## 6. 數據條目定義
在前線分析員發送的 JSON 數據中：
- allies/enemies: 友軍與敵軍列表。你只能取得少量有關敵軍單位的信息。
- hasMoveOrder: 為 true 時，表示單位正無視敵襲前往目的地。
- targetPos: 移動指令的目標座標。僅當 hasMoveOrder 為真時有意義。
- cmdTargetId: 指揮官（你）下達的強制攻擊/跟隨目標 ID。
- autoTargetId: 單位 AI 自動掃描並鎖定的目標 ID。
- followTargetId: 單位正在跟隨的隊友 ID。
- ID 說明: 'FORTRESS_blue/red' 代表要塞，數字代表具體戰術單位。
`;
    }
    getTargetId(target) {
        if (!target) return null;
        if (target instanceof Fortress) return `FORTRESS_${target.side}`;
        else if (target instanceof BaseUnit) return target.unitId;
        return null;
    }
    getSummary(units, blueFort, redFort) {
        const side = this.side;
        const summary = {
            timestamp: Date.now(),
            fortress: {
                hp: side === 'blue' ? blueFort.hp : redFort.hp,
                ap: side === 'blue' ? blueFort.ap : redFort.ap
            },
            techStatus: {
                availableTypes: Object.keys(CONFIG.UNIT_STATS), // 目前全部開放，未來可根據解鎖邏輯過濾
                lockedTypes: [] // 預留給未來研究院機制
            },
            allies: [],           // 全发，否则 LLM 以后会遗忘自己的单位
            enemies: [],          // 目前全发，以后可只发送可见的敌方单位以及位于自身单位攻击范围内的敌方单位
            historys: [],         // 记录过去 4 轮的指令，以及战术日志
            events: [],           // 记录过去 4 轮内发生的事件，如友方士兵/建筑受击/死亡原因
            memory: [],           // 持久化记录一定数量的 AI 认为十分重要的 event（核心记忆）
            suggestions: [],      // 上次行动对本轮行动所提出的建议，本轮行动根据局势来选择是否遵循建议
            avgResponseTime: 0.0, // LLM 的平均响应时间，计算从发送出去到最终执行的平均时间，用于为 LLM 提前出牌
        };
        // todo: 轮式单位，提供 angle 和 vel，无人机提供 vx 和 vy
        units.forEach(u => {
            if (!u.alive) return;

            const physics = {};
            if (u.vx !== undefined && u.vy !== undefined) {
                physics.vx = Number(u.vx.toFixed(2));
                physics.vy = Number(u.vy.toFixed(2));
            } else if (u.vel !== undefined) {
                physics.vel = Number(u.vel.toFixed(2));
                physics.angle = Number(u.angle.toFixed(2));
            }

            const unitData = {
                id: u.unitId,
                type: u.constructor.name,
                x: Math.floor(u.x),
                y: Math.floor(u.y),
                ...physics // 添加物理数据
            };

            if (u.side === side) {
                // 友軍額外信息
                Object.assign(unitData, {
                    hp: Math.floor(u.hp),
                    hasMoveOrder: u.hasMoveOrder,
                    targetPos: u.hasMoveOrder ? { x: Math.floor(u.targetX), y: Math.floor(u.targetY) } : null,
                    cmdTargetId: this.getTargetId(u.cmdTarget),
                    autoTargetId: this.getTargetId(u.autoTarget),
                    followTargetId: this.getTargetId(u.followTarget)
                });
            }

            summary.enemies.push(unitData);
        });
        return summary;
    }
    update(dt, units, blueFort, redFort) {
        this.timer += dt;
        if (this.timer < this.reportInterval) return;
        this.timer = 0;
        this.sendToLLM(this.getSummary(units, blueFort, redFort));
    }
    sendToLLM(data) {
        // todo: 未来替换为 API 调用
        console.log("=== 戰場局勢總結 ===");
        console.log(this.getGameRules());
        console.log(JSON.stringify(data, null, 2));
        uiManager.add("戰術數據同步中...", "#00f2ff");
    }
}

const CONFIG = {
    width: 1200,        // 视口宽度
    height: 800,        // 视口高度
    worldWidth: 6000,   // 战场宽度
    worldHeight: 4000,  // 战场宽度
    maxHp: 10000,
    maxAp: 300,
    apRegenPerSecond: 10,
    fortressSizes: [80, 50],

    cardWidth: 140, cardHeight: 50,

    TYPE_NAMES: {
        'Fortress': '要塞',
        'VehicleUnit': '載具',
        'DroneUnit': '無人機',
        'SniperUnit': '狙擊手',
        'ShotgunUnit': '霰彈手',
        'BaseUnit': '所有單位',
    },
    UNIT_STATS: {
        sniper: {
            class: SniperUnit, name: '狙擊手',
            cost: 50, hp: 1000, maxSpeed: 50, attackRange: 500,
            damage: 200, reloadTime: 2.0, bulletSpeed: 1200,
            desc: '遠程火力單位，擅長後方狙擊要塞與重型單位。不會自動掃描。'
        },
        drone: {
            class: DroneUnit, name: '無人機',
            cost: 30, hp: 20, maxSpeed: 300, attackRange: 600,
            damage: 600, reloadTime: null, bulletSpeed: null,
            desc: '自殺式襲擊單位，觸碰目標即引爆。不會自動掃描。'
        },
        shotgun: {
            class: ShotgunUnit, name: '霰彈兵',
            cost: 40, hp: 250, maxSpeed: 160, attackRange: 250,
            damage: 20, reloadTime: 1.0, bulletSpeed: 800,
            desc: '近戰壓制單位，扇形發射 4 枚彈丸，無人機的剋星。會自動掃描。'
        },
    },
};
CONFIG.cards = Object.keys(CONFIG.UNIT_STATS).map(key => {
    const stats = CONFIG.UNIT_STATS[key];
    return { id: key, name: stats.name, cost: stats.cost, class: stats.class };
});

const camera = {
    // 视点
    x: CONFIG.width / 2, // 游戏开始得看着自家要塞
    y: CONFIG.worldHeight / 2,
    zoomPivotX: CONFIG.width / 2,  // 缩放锚点
    zoomPivotY: CONFIG.height / 2,
    vx: 0, vy: 0,
    friction: 0.98,
    isDragging: false,
    lastMouseX: 0, lastMouseY: 0,

    // 缩放
    zoom: 1,
    minZoom: Math.max(CONFIG.width / CONFIG.worldWidth, CONFIG.height / CONFIG.worldHeight),
    maxZoom: 1.6,
    targetZoom: 1,
    zoomFriction: 0.15, // 缩放平滑度，越小越平滑

    // 拖拽触发
    startX: 0, startY: 0,
    dragThreshold: 5, // 移动超过 5 像素为拖拽

    update(dt) {
        if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
            const worldBefore = screenToWorld(this.zoomPivotX, this.zoomPivotY);
            this.zoom += (this.targetZoom - this.zoom) * this.zoomFriction;
            const worldAfter = screenToWorld(this.zoomPivotX, this.zoomPivotY);
            this.x -= (worldAfter.x - worldBefore.x); this.y -= (worldAfter.y - worldBefore.y);
        } else {
            this.zoom = this.targetZoom;
        }
        if (!this.isDragging) {
            if (Math.abs(this.vx) > 0.01) { this.x += this.vx; this.vx *= this.friction; }
            else { this.vx = 0; }
            if (Math.abs(this.vy) > 0.01) { this.y += this.vy; this.vy *= this.friction; }
            else { this.vy = 0; }
        }
        this.clamp();
    },
    clamp() {
        const halfVisibleWidth = (CONFIG.width / 2) / this.zoom;
        const halfVisibleHeight = (CONFIG.height / 2) / this.zoom;
        // 限制 X 轴和 Y 轴
        if (CONFIG.worldWidth < halfVisibleWidth * 2) this.x = CONFIG.worldWidth / 2;
        else this.x = Math.max(halfVisibleWidth, Math.min(CONFIG.worldWidth - halfVisibleWidth, this.x));
        if (CONFIG.worldHeight < halfVisibleHeight * 2) this.y = CONFIG.worldHeight / 2;
        else this.y = Math.max(halfVisibleHeight, Math.min(CONFIG.worldHeight - halfVisibleHeight, this.y));
    }
};

const UI_CONFIG = {
    msgX: 20, msgY: 40,
    msgSpacing: 35,
    charDelay: 30,      // 0.03s 逐字出现
    glowDuration: 200,  // 0.2s 荧光衰减
    msgLife: 5000,      // 5s 消息持续时间
    fadeOutTime: 1000   // 1s 消息渐变消失
};

let units = []; let bullets = []; let particles = [];
let lastTime = performance.now();
let unitIdCounter = 0;

const blueFortress = new Fortress('blue', 0, CONFIG.worldHeight / 2, '#3498db');
const redFortress = new Fortress('red', CONFIG.worldWidth, CONFIG.worldHeight / 2, '#e74c3c');
const uiManager = new NotificationManager();
const reporter = new BattlefieldReporter('red');

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    camera.isDragging = true;
    camera.lastMouseX = mx; camera.lastMouseY = my;
    camera.startX = mx; camera.startY = my;

    camera.vx = 0; camera.vy = 0;
});

// 滚轮缩放
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    camera.zoomPivotX = mx; camera.zoomPivotY = my;

    const zoomSpeed = 0.001;
    camera.targetZoom = Math.min(Math.max(camera.targetZoom + (-e.deltaY * zoomSpeed), camera.minZoom), camera.maxZoom);
}, { passive: false });

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
        blueFortress.handleInput(mx, my, 'click', redFortress);
        camera.vx = 0; camera.vy = 0;
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    blueFortress.handleInput(mx, my, 'rightclick', redFortress);
});

function screenToWorld(sx, sy) {
    const x = (sx - CONFIG.width / 2) / camera.zoom + camera.x;
    const y = (sy - CONFIG.height / 2) / camera.zoom + camera.y;
    return { x, y };
}
function worldToScreen(wx, wy) {
    const sx = (wx - camera.x) * camera.zoom + CONFIG.width / 2;
    const sy = (wy - camera.y) * camera.zoom + CONFIG.height / 2;
    return { x: sx, y: sy };
}
function drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
    ctx.beginPath();
    for (let x = 0; x <= CONFIG.worldWidth; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.worldHeight); }
    for (let y = 0; y <= CONFIG.worldHeight; y += 100) { ctx.moveTo(0, y); ctx.lineTo(CONFIG.worldWidth, y); }
    ctx.stroke();
    ctx.restore();
}
function gameLoop(now) {
    const dt = (now - lastTime) / 1000; lastTime = now;

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

    reporter.update(dt, units, blueFortress, redFortress);

    blueFortress.drawOverlay(ctx);
    uiManager.draw(ctx);

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);