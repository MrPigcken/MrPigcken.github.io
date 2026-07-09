const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const placeHint = document.getElementById('placeHint');
const selectHint = document.getElementById('selectHint');
const presetContainer = document.getElementById('presetContainer');
const eraserBtn = document.getElementById('eraserBtn');

const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;
const baseCellSize = 8;

// 视口状态
let scale = 1.0;
let offsetX = 0;
let offsetY = 0;

// 工具状态
let currentTool = 'brush'; // brush: 画笔, eraser: 橡皮擦
let brushSize = 1;
let isDrawing = false;
let isPanning = false;
let drawMode = 'alive';
let lastMouseX = 0;
let lastMouseY = 0;

// 图案放置状态
let placingPattern = null;
let mouseWorldX = 0;
let mouseWorldY = 0;

// 选区保存状态
let isSelecting = false;
let selectStart = null;
let selectEnd = null;

// 当前分类
let currentCategory = 'stillLifes';

// 游戏状态
let cols = 1024;
let rows = 1024;
let stride;
let currentGrid;
let nextGrid;
let aliveCount = 0;
let isRunning = false;
let generation = 0;
let speed = 10;
let lastTime = 0;
let frameCount = 0;
let fps = 0;
let lastFpsUpdate = 0;

// ========== 原版图案分类库 ==========
const patternCategories = {
    stillLifes: {
        name: '静物',
        patterns: {
            block: { name: '方块', data: [[0,0],[0,1],[1,0],[1,1]] },
            beehive: { name: '蜂箱', data: [[1,0],[2,0],[0,1],[3,1],[1,2],[2,2]] },
            loaf: { name: '面包', data: [[1,0],[2,0],[0,1],[3,1],[1,2],[3,2],[2,3]] },
            boat: { name: '小船', data: [[0,0],[1,0],[0,1],[2,1],[1,2]] },
            tub: { name: '浴缸', data: [[1,0],[0,1],[2,1],[1,2]] },
            beacon: { name: '信标', data: [[0,0],[0,1],[1,0],[1,1],[2,2],[2,3],[3,2],[3,3]] }
        }
    },
    oscillators: {
        name: '振荡器',
        patterns: {
            blinker: { name: '闪烁器', data: [[0,1],[1,1],[2,1]] },
            toad: { name: '蟾蜍', data: [[1,0],[2,0],[3,0],[0,1],[1,1],[2,1]] },
            pulsar: { 
                name: '脉冲星', 
                data: [
                    [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
                    [0,2],[5,2],[7,2],[12,2],
                    [0,3],[5,3],[7,3],[12,3],
                    [0,4],[5,4],[7,4],[12,4],
                    [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
                    [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
                    [0,8],[5,8],[7,8],[12,8],
                    [0,9],[5,9],[7,9],[12,9],
                    [0,10],[5,10],[7,10],[12,10],
                    [2,12],[3,12],[4,12],[8,12],[9,12],[10,12]
                ]
            },
            pentadecathlon: {
                name: '十五项全能',
                data: [
                    [1,0],[2,0],[3,0],[0,1],[4,1],[1,2],[2,2],[3,2],
                    [1,4],[2,4],[3,4],[0,5],[4,5],[1,6],[2,6],[3,6]
                ]
            }
        }
    },
    spaceships: {
        name: '飞船',
        patterns: {
            glider: { name: '滑翔机', data: [[0,1],[1,2],[2,0],[2,1],[2,2]] },
            lightweightSpaceship: { 
                name: '轻型飞船', 
                data: [[1,0],[4,0],[0,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3]]
            },
            middleweightSpaceship: {
                name: '中型飞船',
                data: [[2,0],[3,0],[1,1],[4,1],[0,2],[0,3],[4,3],[0,4],[1,4],[2,4],[3,4],[4,4]]
            },
            heavyweightSpaceship: {
                name: '重型飞船',
                data: [[2,0],[3,0],[1,1],[4,1],[0,2],[0,3],[4,3],[0,4],[1,4],[2,4],[3,4],[4,4]]
            }
        }
    },
    guns: {
        name: '枪与生成器',
        patterns: {
            gliderGun: {
                name: '高斯珀滑翔机枪',
                data: [
                    [24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],
                    [11,3],[15,3],[20,3],[21,3],[34,3],[35,3],[0,4],[1,4],[10,4],
                    [16,4],[20,4],[21,4],[0,5],[1,5],[10,5],[14,5],[16,5],[17,5],
                    [22,5],[24,5],[10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]
                ]
            },
            blockLayer: {
                name: '方块生成器',
                data: [
                    [0,1],[1,1],[2,1],[4,1],[5,1],[6,1],
                    [2,0],[2,2],[4,0],[4,2],
                    [2,4],[2,5],[4,4],[4,5],
                    [0,4],[1,4],[6,4],[5,4]
                ]
            }
        }
    },
    methuselahs: {
        name: '长寿型',
        patterns: {
            rPentomino: { name: 'R五联体', data: [[1,0],[2,0],[0,1],[1,1],[1,2]] },
            diehard: { name: '顽固生命', data: [[0,1],[1,1],[1,2],[5,0],[6,0],[6,1],[6,2]] },
            acorn: { name: '橡果', data: [[1,0],[2,1],[0,2],[1,2],[4,2],[5,2],[6,2]] }
        }
    },
    custom: {
        name: '自定义',
        patterns: {}
    }
};

// ========== 初始化 ==========
function initGrid() {
    stride = cols + 2;
    const totalCells = stride * (rows + 2);
    currentGrid = new Uint8Array(totalCells);
    nextGrid = new Uint8Array(totalCells);
    generation = 0;
    aliveCount = 0;
    fitToViewport();
    updateInfo();
    loadCustomPatterns();
    renderPatternButtons();
    draw();
}

// 加载本地存储的自定义图案
function loadCustomPatterns() {
    try {
        const saved = localStorage.getItem('gol_custom_patterns');
        if (saved) {
            patternCategories.custom.patterns = JSON.parse(saved);
        }
    } catch (e) {
        patternCategories.custom.patterns = {};
    }
}

// 保存自定义图案到本地存储
function saveCustomPatterns() {
    try {
        localStorage.setItem('gol_custom_patterns', JSON.stringify(patternCategories.custom.patterns));
    } catch (e) {
        console.warn('本地存储失败');
    }
}

// 渲染当前分类的图案按钮
function renderPatternButtons() {
    presetContainer.innerHTML = '';
    const category = patternCategories[currentCategory];
    if (!category) return;

    Object.entries(category.patterns).forEach(([id, pattern]) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        if (currentCategory === 'custom') btn.classList.add('custom-item');
        btn.textContent = pattern.name;
        btn.dataset.patternId = id;
        btn.dataset.category = currentCategory;

        btn.addEventListener('click', () => {
            if (placingPattern && placingPattern.id === id && placingPattern.category === currentCategory) {
                exitPlaceMode();
            } else {
                enterPlaceMode(currentCategory, id);
            }
        });

        // 右键删除自定义图案
        if (currentCategory === 'custom') {
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm(`确定删除自定义图案「${pattern.name}」吗？`)) {
                    delete patternCategories.custom.patterns[id];
                    saveCustomPatterns();
                    renderPatternButtons();
                }
            });
        }

        presetContainer.appendChild(btn);
    });
}

// ========== 视口与坐标 ==========
function fitToViewport() {
    const gridPixelW = cols * baseCellSize;
    const gridPixelH = rows * baseCellSize;
    const scaleX = VIEW_WIDTH / gridPixelW;
    const scaleY = VIEW_HEIGHT / gridPixelH;
    scale = Math.min(scaleX, scaleY) * 0.95;
    centerViewport();
}

function centerViewport() {
    const cellPixelSize = baseCellSize * scale;
    const gridPixelWidth = cols * cellPixelSize;
    const gridPixelHeight = rows * cellPixelSize;
    offsetX = (VIEW_WIDTH - gridPixelWidth) / 2;
    offsetY = (VIEW_HEIGHT - gridPixelHeight) / 2;
}

function screenToWorld(sx, sy) {
    const cellPixelSize = baseCellSize * scale;
    return {
        x: Math.floor((sx - offsetX) / cellPixelSize),
        y: Math.floor((sy - offsetY) / cellPixelSize)
    };
}

// ========== 绘制 ==========
function draw() {
    const cellPixelSize = baseCellSize * scale;
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    
    const startWorldX = Math.max(0, Math.floor(-offsetX / cellPixelSize));
    const endWorldX = Math.min(cols, Math.ceil((VIEW_WIDTH - offsetX) / cellPixelSize));
    const startWorldY = Math.max(0, Math.floor(-offsetY / cellPixelSize));
    const endWorldY = Math.min(rows, Math.ceil((VIEW_HEIGHT - offsetY) / cellPixelSize));

    const showGap = cellPixelSize >= 3;
    const cellDrawSize = showGap ? cellPixelSize - 1 : Math.max(1, cellPixelSize);
    const cellOffset = showGap ? 0.5 : 0;

    // 绘制细胞
    const cellPath = new Path2D();
    for (let wy = startWorldY; wy < endWorldY; wy++) {
        const rowIdx = (wy + 1) * stride;
        for (let wx = startWorldX; wx < endWorldX; wx++) {
            if (currentGrid[rowIdx + wx + 1]) {
                const sx = Math.floor(wx * cellPixelSize + offsetX + cellOffset);
                const sy = Math.floor(wy * cellPixelSize + offsetY + cellOffset);
                cellPath.rect(sx, sy, cellDrawSize, cellDrawSize);
            }
        }
    }
    ctx.fillStyle = '#0ea5e9';
    ctx.fill(cellPath);
    
    // 绘制放置预览
    if (placingPattern) {
        const previewPath = new Path2D();
        const pattern = getPatternData(placingPattern.category, placingPattern.id);
        if (!pattern) return;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        pattern.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });
        const patternW = maxX - minX + 1;
        const patternH = maxY - minY + 1;
        const offX = mouseWorldX - Math.floor(patternW / 2) - minX;
        const offY = mouseWorldY - Math.floor(patternH / 2) - minY;
        
        pattern.forEach(([x, y]) => {
            const px = x + offX;
            const py = y + offY;
            if (px >= 0 && px < cols && py >= 0 && py < rows) {
                const sx = Math.floor(px * cellPixelSize + offsetX + cellOffset);
                const sy = Math.floor(py * cellPixelSize + offsetY + cellOffset);
                previewPath.rect(sx, sy, cellDrawSize, cellDrawSize);
            }
        });
        
        ctx.fillStyle = 'rgba(124, 58, 237, 0.6)';
        ctx.fill(previewPath);
    }

    // 绘制选区框
    if (isSelecting && selectStart && selectEnd) {
        const cellPixelSize = baseCellSize * scale;
        const x1 = Math.min(selectStart.x, selectEnd.x);
        const y1 = Math.min(selectStart.y, selectEnd.y);
        const x2 = Math.max(selectStart.x, selectEnd.x) + 1;
        const y2 = Math.max(selectStart.y, selectEnd.y) + 1;

        const sx1 = x1 * cellPixelSize + offsetX;
        const sy1 = y1 * cellPixelSize + offsetY;
        const sw = (x2 - x1) * cellPixelSize;
        const sh = (y2 - y1) * cellPixelSize;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(sx1, sy1, sw, sh);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
        ctx.fillRect(sx1, sy1, sw, sh);
    }
    
    // 网格线
    if (cellPixelSize >= 4) {
        const gridPath = new Path2D();
        for (let wx = startWorldX; wx <= endWorldX; wx++) {
            const sx = Math.round(wx * cellPixelSize + offsetX);
            gridPath.moveTo(sx, 0);
            gridPath.lineTo(sx, VIEW_HEIGHT);
        }
        for (let wy = startWorldY; wy <= endWorldY; wy++) {
            const sy = Math.round(wy * cellPixelSize + offsetY);
            gridPath.moveTo(0, sy);
            gridPath.lineTo(VIEW_WIDTH, sy);
        }
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke(gridPath);
    }
}

// 获取图案数据
function getPatternData(category, id) {
    return patternCategories[category]?.patterns[id]?.data;
}

// ========== 演化逻辑 ==========
function nextGeneration() {
    let newAlive = 0;
    
    for (let y = 1; y <= rows; y++) {
        const rowIdx = y * stride;
        const upRow = rowIdx - stride;
        const downRow = rowIdx + stride;
        
        for (let x = 1; x <= cols; x++) {
            const idx = rowIdx + x;
            const neighbors = 
                currentGrid[upRow + x - 1] +
                currentGrid[upRow + x] +
                currentGrid[upRow + x + 1] +
                currentGrid[idx - 1] +
                currentGrid[idx + 1] +
                currentGrid[downRow + x - 1] +
                currentGrid[downRow + x] +
                currentGrid[downRow + x + 1];
            
            let alive = 0;
            if (currentGrid[idx]) {
                alive = (neighbors === 2 || neighbors === 3) ? 1 : 0;
            } else {
                alive = (neighbors === 3) ? 1 : 0;
            }
            
            nextGrid[idx] = alive;
            newAlive += alive;
        }
    }
    
    [currentGrid, nextGrid] = [nextGrid, currentGrid];
    aliveCount = newAlive;
    generation++;
    updateInfo();
}

// ========== 笔刷与橡皮擦 ==========
function applyBrush(worldX, worldY, mode) {
    const half = Math.floor(brushSize / 2);
    const startX = worldX - half + 1;
    const endX = worldX + (brushSize - half) + 1;
    const startY = worldY - half + 1;
    const endY = worldY + (brushSize - half) + 1;
    
    for (let y = startY; y < endY; y++) {
        const rowIdx = y * stride;
        for (let x = startX; x < endX; x++) {
            if (x >= 1 && x <= cols && y >= 1 && y <= rows) {
                const idx = rowIdx + x;
                const old = currentGrid[idx];
                const newVal = mode === 'alive' ? 1 : 0;
                if (old !== newVal) {
                    currentGrid[idx] = newVal;
                    aliveCount += newVal - old;
                }
            }
        }
    }
}

function placePatternAt(category, patternId, worldX, worldY) {
    const pattern = getPatternData(category, patternId);
    if (!pattern) return;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    pattern.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });
    const patternW = maxX - minX + 1;
    const patternH = maxY - minY + 1;
    const offX = worldX - Math.floor(patternW / 2) - minX;
    const offY = worldY - Math.floor(patternH / 2) - minY;
    
    pattern.forEach(([x, y]) => {
        const px = x + offX;
        const py = y + offY;
        if (px >= 0 && px < cols && py >= 0 && py < rows) {
            const idx = (py + 1) * stride + (px + 1);
            if (currentGrid[idx] === 0) {
                currentGrid[idx] = 1;
                aliveCount++;
            }
        }
    });
    
    updateInfo();
}

// 从选区提取图案
function extractPatternFromSelection() {
    if (!selectStart || !selectEnd) return null;

    const x1 = Math.max(0, Math.min(selectStart.x, selectEnd.x));
    const y1 = Math.max(0, Math.min(selectStart.y, selectEnd.y));
    const x2 = Math.min(cols - 1, Math.max(selectStart.x, selectEnd.x));
    const y2 = Math.min(rows - 1, Math.max(selectStart.y, selectEnd.y));

    const data = [];
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const idx = (y + 1) * stride + (x + 1);
            if (currentGrid[idx]) {
                data.push([x - x1, y - y1]);
            }
        }
    }

    if (data.length === 0) {
        alert('选区内没有存活细胞');
        return null;
    }
    return data;
}

// ========== 模式控制 ==========
function enterPlaceMode(category, patternId) {
    exitSelectMode();
    placingPattern = { category, id: patternId };
    canvas.classList.add('placing');
    placeHint.style.display = 'block';
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', 
            btn.dataset.patternId === patternId && btn.dataset.category === category
        );
    });
}

function exitPlaceMode() {
    placingPattern = null;
    canvas.classList.remove('placing');
    placeHint.style.display = 'none';
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    draw();
}

function enterSelectMode() {
    exitPlaceMode();
    isSelecting = true;
    selectStart = null;
    selectEnd = null;
    canvas.classList.add('selecting');
    selectHint.style.display = 'block';
    document.getElementById('saveCustomBtn').classList.add('active');
}

function exitSelectMode() {
    isSelecting = false;
    selectStart = null;
    selectEnd = null;
    canvas.classList.remove('selecting');
    selectHint.style.display = 'none';
    document.getElementById('saveCustomBtn').classList.remove('active');
    draw();
}

// 切换橡皮擦工具
function toggleEraser() {
    if (currentTool === 'eraser') {
        currentTool = 'brush';
        eraserBtn.classList.remove('eraser-active');
        canvas.classList.remove('eraser-mode');
    } else {
        currentTool = 'eraser';
        eraserBtn.classList.add('eraser-active');
        canvas.classList.add('eraser-mode');
        exitPlaceMode();
        exitSelectMode();
    }
}

// ========== 信息更新 ==========
function updateInfo() {
    document.getElementById('generation').textContent = generation;
    document.getElementById('aliveCount').textContent = aliveCount;
    document.getElementById('canvasSizeLabel').textContent = `${cols} × ${rows}`;
}

// ========== 游戏循环 ==========
function gameLoop(timestamp) {
    frameCount++;
    if (timestamp - lastFpsUpdate >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsUpdate = timestamp;
        document.getElementById('fps').textContent = fps;
    }

    if (isRunning) {
        const interval = 1000 / speed;
        if (timestamp - lastTime >= interval) {
            nextGeneration();
            draw();
            lastTime = timestamp;
        }
    }

    requestAnimationFrame(gameLoop);
}

// ========== 鼠标事件 ==========
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const pos = screenToWorld(mouseX, mouseY);
    
    // 选区模式
    if (isSelecting) {
        if (e.button === 0) {
            selectStart = pos;
            selectEnd = pos;
        } else if (e.button === 2) {
            exitSelectMode();
        }
        return;
    }

    // 放置模式
    if (placingPattern) {
        if (e.button === 0) {
            placePatternAt(placingPattern.category, placingPattern.id, pos.x, pos.y);
            draw();
        } else if (e.button === 2) {
            exitPlaceMode();
        }
        return;
    }
    
    if (e.button === 1) {
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
        // 左键根据当前工具决定绘制/擦除
        isDrawing = true;
        drawMode = currentTool === 'eraser' ? 'dead' : 'alive';
        applyBrush(pos.x, pos.y, drawMode);
        draw();
        updateInfo();
    } else if (e.button === 2) {
        // 右键临时擦除，不改变当前工具
        isDrawing = true;
        drawMode = 'dead';
        applyBrush(pos.x, pos.y, 'dead');
        draw();
        updateInfo();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const pos = screenToWorld(mouseX, mouseY);
    
    if (isSelecting && selectStart) {
        selectEnd = pos;
        draw();
        return;
    }
    
    if (placingPattern) {
        mouseWorldX = pos.x;
        mouseWorldY = pos.y;
        draw();
        return;
    }
    
    if (isPanning) {
        offsetX += e.clientX - lastMouseX;
        offsetY += e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        draw();
    } else if (isDrawing) {
        applyBrush(pos.x, pos.y, drawMode);
        draw();
        updateInfo();
    }
});

canvas.addEventListener('mouseup', (e) => {
    // 选区结束，保存图案
    if (isSelecting && selectStart && selectEnd && e.button === 0) {
        const patternData = extractPatternFromSelection();
        if (patternData) {
            const name = prompt('请输入自定义图案名称：', `图案${Object.keys(patternCategories.custom.patterns).length + 1}`);
            if (name && name.trim()) {
                const id = 'custom_' + Date.now();
                patternCategories.custom.patterns[id] = {
                    name: name.trim(),
                    data: patternData
                };
                saveCustomPatterns();
                currentCategory = 'custom';
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.category === 'custom');
                });
                renderPatternButtons();
            }
        }
        exitSelectMode();
        return;
    }

    if (e.button === 1) {
        isPanning = false;
        canvas.style.cursor = currentTool === 'eraser' ? 'cell' : 'crosshair';
    } else if (e.button === 0 || e.button === 2) {
        isDrawing = false;
    }
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    isDrawing = false;
    canvas.style.cursor = currentTool === 'eraser' ? 'cell' : 'crosshair';
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 滚轮缩放
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldBefore = screenToWorld(mouseX, mouseY);
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.05, Math.min(8, scale * zoomFactor));
    
    if (newScale === scale) return;
    
    scale = newScale;
    const cellPixelSize = baseCellSize * scale;
    offsetX = mouseX - worldBefore.x * cellPixelSize;
    offsetY = mouseY - worldBefore.y * cellPixelSize;
    
    draw();
}, { passive: false });

// 键盘事件
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isSelecting) exitSelectMode();
        if (placingPattern) exitPlaceMode();
    }
    // 快捷键 E 切换橡皮擦
    if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        toggleEraser();
    }
});

// ========== 控件事件 ==========
document.getElementById('startBtn').addEventListener('click', function() {
    isRunning = !isRunning;
    this.textContent = isRunning ? '暂停' : '开始';
    this.classList.toggle('active', isRunning);
    lastTime = performance.now();
});

document.getElementById('stepBtn').addEventListener('click', () => {
    nextGeneration();
    draw();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    initGrid();
});

document.getElementById('randomBtn').addEventListener('click', () => {
    aliveCount = 0;
    for (let y = 1; y <= rows; y++) {
        const rowIdx = y * stride;
        for (let x = 1; x <= cols; x++) {
            const alive = Math.random() < 0.3 ? 1 : 0;
            currentGrid[rowIdx + x] = alive;
            aliveCount += alive;
        }
    }
    generation = 0;
    updateInfo();
    draw();
});

eraserBtn.addEventListener('click', toggleEraser);

document.getElementById('speedSlider').addEventListener('input', function() {
    speed = parseInt(this.value);
});

document.getElementById('brushSlider').addEventListener('input', function() {
    brushSize = parseInt(this.value);
});

document.getElementById('canvasSizeSlider').addEventListener('input', function() {
    const size = parseInt(this.value);
    cols = size;
    rows = size;
    initGrid();
});

// 分类切换
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        currentCategory = this.dataset.category;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        exitPlaceMode();
        renderPatternButtons();
    });
});

// 保存自定义图案按钮
document.getElementById('saveCustomBtn').addEventListener('click', function() {
    if (isSelecting) {
        exitSelectMode();
    } else {
        enterSelectMode();
    }
});

// 启动游戏
initGrid();
requestAnimationFrame(gameLoop);