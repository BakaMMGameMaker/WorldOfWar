// levels.js
const LEVEL_DATA = {
    1: {
        name: "邊境衝突",
        description: "使用無人機逐一擊破敵方霰彈手，最後使用狙擊手摧毀敵方要塞",
        initAp: 50,
        availableUnits: ['sniper', 'drone'],
        blueUnits: [],
        redUnits: [
            { type: 'sniper', x: 15, y: 5, angle: 140 },
            { type: 'sniper', x: 15, y: 11, angle: 220 },

            { type: 'shotgun', x: 21, y: 8, angle: 180 },
            { type: 'shotgun', x: 22, y: 7, angle: 220 },
            { type: 'shotgun', x: 22, y: 9, angle: 140 },
            { type: 'shotgun', x: 23, y: 6, angle: 230 },
            { type: 'shotgun', x: 23, y: 10, angle: 130 },
            { type: 'shotgun', x: 15, y: 4, angle: 180 },
            { type: 'shotgun', x: 15, y: 12, angle: 180 },
            { type: 'shotgun', x: 16, y: 4, angle: -45 },
            { type: 'shotgun', x: 16, y: 12, angle: 45 },
            { type: 'shotgun', x: 16, y: 5, angle: 0 },
            { type: 'shotgun', x: 16, y: 11, angle: 0 }
        ],
    },
    2: {
        name: "火燒眉毛",
        description: "情況危急，先進攻兩側狙擊手，再部署霰彈槍手並用 autoscan on 指令啟用自動巡邏以防禦無人機",
        initAp: 100,
        availableUnits: ['sniper', 'drone', 'shotgun'],
        blueUnits: [],
        redUnits: [
            { type: 'sniper', x: 2, y: 3, angle: 120 },
            { type: 'sniper', x: 2, y: 13, angle: 240 },
            { type: 'sniper', x: 8, y: 8, angle: 180 },
            { type: 'sniper', x: 20, y: 4, angle: 160 },
            { type: 'sniper', x: 20, y: 12, angle: 200 },
            { type: 'sniper', x: 21, y: 8, angle: 180 },

            { type: 'drone', x: 22, y: 2, angle: 160, targetPos: { x: 4, y: 4 }, time: 10 },
            { type: 'drone', x: 23, y: 1, angle: 160, targetPos: { x: 5, y: 3 }, time: 10.1 },
            { type: 'drone', x: 22, y: 14, angle: 200, targetPos: { x: 4, y: 12 }, time: 20 },
            { type: 'drone', x: 23, y: 15, angle: 200, targetPos: { x: 5, y: 13 }, time: 20.1 },
            { type: 'drone', x: 21, y: 5, angle: 170, targetPos: { x: 8, y: 7 }, time: 8 },
            { type: 'drone', x: 21, y: 11, angle: 190, targetPos: { x: 8, y: 9 }, time: 8.1 },
            { type: 'drone', x: 9, y: 8, angle: 180 },
            { type: 'drone', x: 23, y: 6, angle: 160 },
            { type: 'drone', x: 23, y: 10, angle: 200 },

            { type: 'shotgun', x: 7, y: 6, angle: 170 },
            { type: 'shotgun', x: 7, y: 10, angle: 190 },
            { type: 'shotgun', x: 19, y: 5, angle: 170 },
            { type: 'shotgun', x: 19, y: 11, angle: 190 },
            { type: 'shotgun', x: 22, y: 7, angle: 180 },
            { type: 'shotgun', x: 22, y: 9, angle: 180 }
        ],
    },
}