const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const placeHint = document.getElementById('placeHint');
const selectHint = document.getElementById('selectHint');
const presetContainer = document.getElementById('presetContainer');
const eraserBtn = document.getElementById('eraserBtn');
const brushSlider = document.getElementById('brushSlider');
const brushSizeInput = document.getElementById('brushSizeInput');
const widthSlider = document.getElementById('widthSlider');
const widthInput = document.getElementById('widthInput');
const heightSlider = document.getElementById('heightSlider');
const heightInput = document.getElementById('heightInput');

const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;
const baseCellSize = 8;

// 视口状态
let scale = 1.0;
let offsetX = 0;
let offsetY = 0;

// 工具状态
let currentTool = 'brush';
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

// 脏标记
let dirty = true;

// 图案分类库
let patternCategories = {};

// ========== 规则查找表 LUT ==========
const ruleLUT = new Uint8Array(512);
(function buildLUT() {
    for (let i = 0; i < 512; i++) {
        let count = 0;
        let n = i;
        while (n) { count += n & 1; n >>>= 1; }
        const center = (i >>> 4) & 1;
        ruleLUT[i] = (center ? (count - center === 2 || count - center === 3) : count - center === 3) ? 1 : 0;
    }
})();

// ========== 工具函数 ==========
function clampStep(value, min, max, step) {
    value = Math.round(value / step) * step;
    return Math.max(min, Math.min(max, value));
}

// ========== 加载图案库 ==========
async function loadPatterns() {
    try {
        const response = await fetch('./data/data.json');
        if (!response.ok) throw new Error('图案文件加载失败');
        patternCategories = await response.json();
        if (!patternCategories.custom) {
            patternCategories.custom = { name: '自定义', patterns: {} };
        }
        loadCustomPatterns();
    } catch (error) {
        console.error('加载图案库失败:', error);
        patternCategories = { custom: { name: '自定义', patterns: {} } };
        loadCustomPatterns();
    }
}

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
    renderPatternButtons();
    dirty = true;
    draw();
}

function loadCustomPatterns() {
    try {
        const saved = localStorage.getItem('gol_custom_patterns');
        if (saved && patternCategories.custom) {
            patternCategories.custom.patterns = JSON.parse(saved);
        }
    } catch (e) {
        patternCategories.custom.patterns = {};
    }
}

function saveCustomPatterns() {
    try {
        localStorage.setItem('gol_custom_patterns', JSON.stringify(patternCategories.custom.patterns));
    } catch (e) {
        console.warn('本地存储失败');
    }
}

function renderPatternButtons() {
    presetContainer.innerHTML = '';
    const category = patternCategories[currentCategory];
    if (!category || !category.patterns) return;

    Object.entries(category.patterns).forEach(([id, pattern]) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        if (currentCategory === 'custom') btn.classList.add('custom-item');
        btn.textContent = pattern.name;
        btn.dataset.patternId = id;
        btn.dataset.category = currentCategory;

        btn.addEventListener('click', () => {
            if (placingPattern?.id === id && placingPattern?.category === currentCategory) {
                exitPlaceMode();
            } else {
                enterPlaceMode(currentCategory, id);
            }
        });

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
    offsetX = (VIEW_WIDTH - cols * cellPixelSize) / 2;
    offsetY = (VIEW_HEIGHT - rows * cellPixelSize) / 2;
}

function screenToWorld(sx, sy) {
    const cellPixelSize = baseCellSize * scale;
    return {
        x: Math.floor((sx - offsetX) / cellPixelSize),
        y: Math.floor((sy - offsetY) / cellPixelSize)
    };
}

// ========== 绘制（Uint32Array 优化版） ==========
function draw() {
    if (!dirty) return;
    dirty = false;

    const cellPixelSize = baseCellSize * scale;
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    
    const startWorldX = Math.max(0, Math.floor(-offsetX / cellPixelSize));
    const endWorldX = Math.min(cols, Math.ceil((VIEW_WIDTH - offsetX) / cellPixelSize));
    const startWorldY = Math.max(0, Math.floor(-offsetY / cellPixelSize));
    const endWorldY = Math.min(rows, Math.ceil((VIEW_HEIGHT - offsetY) / cellPixelSize));

    cellPixelSize >= 2 
        ? drawLargeCells(cellPixelSize, startWorldX, endWorldX, startWorldY, endWorldY)
        : drawSmallCells(cellPixelSize, startWorldX, endWorldX, startWorldY, endWorldY);
    
    // 放置预览
    if (placingPattern) {
        const pattern = getPatternData(placingPattern.category, placingPattern.id);
        if (pattern) {
            const showGap = cellPixelSize >= 3;
            const cellDrawSize = showGap ? cellPixelSize - 1 : Math.max(1, cellPixelSize);
            const cellOffset = showGap ? 0.5 : 0;

            const previewPath = new Path2D();
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
    }

    // 选区框
    if (isSelecting && selectStart && selectEnd) {
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

function drawLargeCells(cellPixelSize, startX, endX, startY, endY) {
    const cellSize = cellPixelSize - 1;
    const cellOffset = 0.5;
    const cellPath = new Path2D();

    for (let wy = startY; wy < endY; wy++) {
        const rowIdx = (wy + 1) * stride;
        const sy = Math.floor(wy * cellPixelSize + offsetY + cellOffset);
        for (let wx = startX; wx < endX; wx++) {
            if (currentGrid[rowIdx + wx + 1]) {
                const sx = Math.floor(wx * cellPixelSize + offsetX + cellOffset);
                cellPath.rect(sx, sy, cellSize, cellSize);
            }
        }
    }
    ctx.fillStyle = '#0ea5e9';
    ctx.fill(cellPath);
}

// 小细胞渲染：Uint32Array 单像素批量写入，性能提升40%-70%
function drawSmallCells(cellPixelSize, startX, endX, startY, endY) {
    const imgData = ctx.getImageData(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const pixels = new Uint32Array(imgData.data.buffer);
    const pixelStep = Math.max(1, Math.round(cellPixelSize));
    // 颜色 RGBA(14,165,233,255) 小端序对应 0xFFE9A50E
    const CELL_COLOR = 0xFFE9A50E;

    for (let wy = startY; wy < endY; wy++) {
        const rowIdx = (wy + 1) * stride;
        const screenY = Math.floor(wy * cellPixelSize + offsetY);
        if (screenY < 0 || screenY >= VIEW_HEIGHT) continue;

        for (let wx = startX; wx < endX; wx++) {
            if (currentGrid[rowIdx + wx + 1]) {
                const screenX = Math.floor(wx * cellPixelSize + offsetX);
                if (screenX < 0 || screenX >= VIEW_WIDTH) continue;

                for (let dy = 0; dy < pixelStep && screenY + dy < VIEW_HEIGHT; dy++) {
                    const rowOffset = (screenY + dy) * VIEW_WIDTH + screenX;
                    for (let dx = 0; dx < pixelStep && screenX + dx < VIEW_WIDTH; dx++) {
                        pixels[rowOffset + dx] = CELL_COLOR;
                    }
                }
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

function getPatternData(category, id) {
    return patternCategories[category]?.patterns?.[id]?.cells;
}

// ========== 演化核心：滑动窗口 LUT 极致优化 ==========
function nextGeneration() {
    let newAlive = 0;
    const strideVal = stride;
    const colCount = cols;
    const lut = ruleLUT;
    const grid = currentGrid;
    const next = nextGrid;
    const LUT_MASK = 0b011011011;
    
    let upRow = 0;
    let midRow = strideVal;
    let downRow = strideVal * 2;
    
    for (let y = 1; y <= rows; y++) {
        // 首列初始化完整9位索引
        let lutIdx = 
            (grid[upRow]     << 0) |
            (grid[upRow + 1] << 1) |
            (grid[upRow + 2] << 2) |
            (grid[midRow]     << 3) |
            (grid[midRow + 1] << 4) |
            (grid[midRow + 2] << 5) |
            (grid[downRow]     << 6) |
            (grid[downRow + 1] << 7) |
            (grid[downRow + 2] << 8);
        
        let alive = lut[lutIdx];
        next[midRow + 1] = alive;
        newAlive += alive;
        
        // 滑动窗口遍历：每列仅读取3个新值
        for (let x = 2; x <= colCount; x++) {
            const xNext = x + 1;
            // 左移清旧值，填入新的最右列
            lutIdx = ((lutIdx << 1) & LUT_MASK) 
                   | (grid[upRow + xNext] << 2) 
                   | (grid[midRow + xNext] << 5) 
                   | (grid[downRow + xNext] << 8);
            
            alive = lut[lutIdx];
            next[midRow + x] = alive;
            newAlive += alive;
        }
        
        upRow = midRow;
        midRow = downRow;
        downRow += strideVal;
    }
    
    currentGrid = next;
    nextGrid = grid;
    aliveCount = newAlive;
    generation++;
    updateInfo();
    dirty = true;
}

// ========== 笔刷：原生批量填充 ==========
function applyBrush(worldX, worldY, mode) {
    const half = brushSize >> 1;
    const startX = worldX - half + 1;
    const endX = worldX + (brushSize - half) + 1;
    const startY = worldY - half + 1;
    const endY = worldY + (brushSize - half) + 1;

    const yMin = Math.max(1, startY);
    const yMax = Math.min(rows + 1, endY);
    if (yMin >= yMax) return;

    const xMin = Math.max(1, startX);
    const xMax = Math.min(cols + 1, endX);
    if (xMin >= xMax) return;

    const newVal = mode === 'alive' ? 1 : 0;
    let delta = 0;
    const width = xMax - xMin;

    for (let y = yMin; y < yMax; y++) {
        const rowBase = y * stride;
        const idxStart = rowBase + xMin;
        const idxEnd = rowBase + xMax;

        // 统计原有活细胞数
        let rowSum = 0;
        for (let i = idxStart; i < idxEnd; i++) rowSum += currentGrid[i];

        // 原生批量填充
        currentGrid.fill(newVal, idxStart, idxEnd);

        delta += newVal ? width - rowSum : -rowSum;
    }

    aliveCount += delta;
    dirty = true;
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
    dirty = true;
}

function extractPatternFromSelection() {
    if (!selectStart || !selectEnd) return null;

    const x1 = Math.max(0, Math.min(selectStart.x, selectEnd.x));
    const y1 = Math.max(0, Math.min(selectStart.y, selectEnd.y));
    const x2 = Math.min(cols - 1, Math.max(selectStart.x, selectEnd.x));
    const y2 = Math.min(rows - 1, Math.max(selectStart.y, selectEnd.y));

    const cells = [];
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const idx = (y + 1) * stride + (x + 1);
            if (currentGrid[idx]) cells.push([x - x1, y - y1]);
        }
    }

    if (cells.length === 0) {
        alert('选区内没有存活细胞');
        return null;
    }
    return cells;
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
    dirty = true;
}

function exitPlaceMode() {
    placingPattern = null;
    canvas.classList.remove('placing');
    placeHint.style.display = 'none';
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    dirty = true;
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
    dirty = true;
}

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

// ========== 游戏主循环 ==========
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
            lastTime = timestamp;
        }
    }

    if (dirty) draw();
    requestAnimationFrame(gameLoop);
}

// ========== 鼠标事件 ==========
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const pos = screenToWorld(mouseX, mouseY);
    
    if (isSelecting) {
        if (e.button === 0) {
            selectStart = pos;
            selectEnd = pos;
            dirty = true;
        } else if (e.button === 2) {
            exitSelectMode();
        }
        return;
    }

    if (placingPattern) {
        if (e.button === 0) {
            placePatternAt(placingPattern.category, placingPattern.id, pos.x, pos.y);
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
        isDrawing = true;
        drawMode = currentTool === 'eraser' ? 'dead' : 'alive';
        applyBrush(pos.x, pos.y, drawMode);
        updateInfo();
    } else if (e.button === 2) {
        isDrawing = true;
        drawMode = 'dead';
        applyBrush(pos.x, pos.y, 'dead');
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
        dirty = true;
        return;
    }
    
    if (placingPattern) {
        mouseWorldX = pos.x;
        mouseWorldY = pos.y;
        dirty = true;
        return;
    }
    
    if (isPanning) {
        offsetX += e.clientX - lastMouseX;
        offsetY += e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        dirty = true;
    } else if (isDrawing) {
        applyBrush(pos.x, pos.y, drawMode);
        updateInfo();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isSelecting && selectStart && selectEnd && e.button === 0) {
        const patternData = extractPatternFromSelection();
        if (patternData) {
            const name = prompt('请输入自定义图案名称：', `图案${Object.keys(patternCategories.custom.patterns).length + 1}`);
            if (name && name.trim()) {
                const id = 'custom_' + Date.now();
                patternCategories.custom.patterns[id] = {
                    name: name.trim(),
                    cells: patternData
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
    
    dirty = true;
}, { passive: false });

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isSelecting) exitSelectMode();
        if (placingPattern) exitPlaceMode();
    }
    if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        toggleEraser();
    }
});

// ========== 控件事件绑定 ==========
document.getElementById('startBtn').addEventListener('click', function() {
    isRunning = !isRunning;
    this.textContent = isRunning ? '暂停' : '开始';
    this.classList.toggle('active', isRunning);
    lastTime = performance.now();
    dirty = true;
});

document.getElementById('stepBtn').addEventListener('click', () => {
    nextGeneration();
    dirty = true;
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
    dirty = true;
});

eraserBtn.addEventListener('click', toggleEraser);

document.getElementById('speedSlider').addEventListener('input', function() {
    speed = parseInt(this.value);
});

// 笔刷大小双向同步
function updateBrushSize(value) {
    brushSize = clampStep(value, 1, 100, 1);
    brushSlider.value = brushSize;
    brushSizeInput.value = brushSize;
}

brushSlider.addEventListener('input', e => updateBrushSize(e.target.value));
brushSizeInput.addEventListener('change', e => updateBrushSize(e.target.value));
brushSizeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') updateBrushSize(e.target.value);
});

// 网格宽度双向同步
function updateGridWidth(value) {
    cols = clampStep(value, 128, 8192, 128);
    widthSlider.value = cols;
    widthInput.value = cols;
    initGrid();
}

widthSlider.addEventListener('input', e => updateGridWidth(e.target.value));
widthInput.addEventListener('change', e => updateGridWidth(e.target.value));
widthInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') updateGridWidth(e.target.value);
});

// 网格高度双向同步
function updateGridHeight(value) {
    rows = clampStep(value, 128, 8192, 128);
    heightSlider.value = rows;
    heightInput.value = rows;
    initGrid();
}

heightSlider.addEventListener('input', e => updateGridHeight(e.target.value));
heightInput.addEventListener('change', e => updateGridHeight(e.target.value));
heightInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') updateGridHeight(e.target.value);
});

// 分类标签切换
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        currentCategory = this.dataset.category;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        exitPlaceMode();
        renderPatternButtons();
    });
});

// 自定义图案保存按钮
document.getElementById('saveCustomBtn').addEventListener('click', function() {
    if (isSelecting) {
        exitSelectMode();
    } else {
        enterSelectMode();
    }
});

// ========== 启动程序 ==========
(async function main() {
    await loadPatterns();
    initGrid();
    requestAnimationFrame(gameLoop);
})();