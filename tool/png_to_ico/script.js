// ========== 全局状态 ==========
let sourceImage = null;
let sizes = [16, 32, 48, 256];
let radiusPercent = 0;
let cropRegion = { x: 0, y: 0, width: 0, height: 0 };
let displayScale = 1;      // 画布像素 : 原图像素
let canvasScale = 1;       // 画布像素 : CSS显示像素
let isDraggingCrop = false;
let isResizingCrop = false;
let resizeCorner = null;
let dragStart = { x: 0, y: 0 };
let cropStart = { x: 0, y: 0, width: 0, height: 0 };

// ========== DOM 元素 ==========
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const radiusRange = document.getElementById('radiusRange');
const radiusValue = document.getElementById('radiusValue');
const sizeList = document.getElementById('sizeList');
const sizeInput = document.getElementById('sizeInput');
const addSizeBtn = document.getElementById('addSizeBtn');
const previewArea = document.getElementById('previewArea');
const generateBtn = document.getElementById('generateBtn');
const cropCanvas = document.getElementById('cropCanvas');
const cropCard = document.getElementById('cropCard');
const fileNameInput = document.getElementById('fileNameInput');

// ========== 初始化 ==========
renderSizeList();

// ========== 上传处理 ==========
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '#409eff';
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#c0c4cc';
});
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '#c0c4cc';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
    else alert('请上传图片格式文件');
});
fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadImage(file);
});

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            generateBtn.disabled = false;
            initCrop();
            renderAllPreviews();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ========== 裁剪初始化（限制最大高度） ==========
function initCrop() {
    const maxDisplayWidth = 500;
    const maxDisplayHeight = 360;
    const img = sourceImage;

    // 计算等比显示尺寸（不超过最大宽高）
    let displayW = img.width;
    let displayH = img.height;

    if (displayW > maxDisplayWidth) {
        displayH = displayH * (maxDisplayWidth / displayW);
        displayW = maxDisplayWidth;
    }
    if (displayH > maxDisplayHeight) {
        displayW = displayW * (maxDisplayHeight / displayH);
        displayH = maxDisplayHeight;
    }

    // 画布像素尺寸 = 显示尺寸 * 设备像素比，保证清晰
    const dpr = window.devicePixelRatio || 1;
    cropCanvas.width = displayW * dpr;
    cropCanvas.height = displayH * dpr;
    cropCanvas.style.width = displayW + 'px';
    cropCanvas.style.height = displayH + 'px';

    displayScale = (displayW * dpr) / img.width;
    canvasScale = dpr;

    // 默认居中最大正方形裁剪
    const cropSize = Math.min(img.width, img.height);
    cropRegion.width = cropSize;
    cropRegion.height = cropSize;
    cropRegion.x = (img.width - cropSize) / 2;
    cropRegion.y = (img.height - cropSize) / 2;

    drawCropCanvas();
    cropCard.style.display = 'block';
}

// ========== 绘制裁剪画布 ==========
function drawCropCanvas() {
    const ctx = cropCanvas.getContext('2d');
    const w = cropCanvas.width;
    const h = cropCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImage, 0, 0, w, h);

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    // 裁剪区域（画布像素坐标）
    const dx = cropRegion.x * displayScale;
    const dy = cropRegion.y * displayScale;
    const dw = cropRegion.width * displayScale;
    const dh = cropRegion.height * displayScale;

    // 清除裁剪区遮罩
    ctx.clearRect(dx, dy, dw, dh);
    ctx.drawImage(sourceImage, cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height, dx, dy, dw, dh);

    // 裁剪框边框
    ctx.strokeStyle = '#409eff';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, dy, dw, dh);

    // 四角调整手柄
    const handleSize = 8 * canvasScale;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#409eff';
    ctx.lineWidth = 1;

    const corners = [
        [dx, dy],
        [dx + dw, dy],
        [dx, dy + dh],
        [dx + dw, dy + dh]
    ];
    corners.forEach(([x, y]) => {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    });
}

// ========== 修复：鼠标坐标精准换算 ==========
function getMousePos(e) {
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getCornerAt(pos) {
    const dx = cropRegion.x * displayScale;
    const dy = cropRegion.y * displayScale;
    const dw = cropRegion.width * displayScale;
    const dh = cropRegion.height * displayScale;
    const handleSize = 12 * canvasScale;

    const cornerList = [
        { x: dx, y: dy, type: 'nw-resize' },
        { x: dx + dw, y: dy, type: 'ne-resize' },
        { x: dx, y: dy + dh, type: 'sw-resize' },
        { x: dx + dw, y: dy + dh, type: 'se-resize' }
    ];

    for (const corner of cornerList) {
        if (Math.abs(pos.x - corner.x) <= handleSize && Math.abs(pos.y - corner.y) <= handleSize) {
            return corner.type;
        }
    }
    return null;
}

function isInsideCrop(pos) {
    const dx = cropRegion.x * displayScale;
    const dy = cropRegion.y * displayScale;
    const dw = cropRegion.width * displayScale;
    const dh = cropRegion.height * displayScale;
    return pos.x >= dx && pos.x <= dx + dw && pos.y >= dy && pos.y <= dy + dh;
}

// ========== 裁剪交互事件 ==========
cropCanvas.addEventListener('mousedown', e => {
    const pos = getMousePos(e);
    const corner = getCornerAt(pos);

    if (corner) {
        isResizingCrop = true;
        resizeCorner = corner;
        dragStart = pos;
        cropStart = { ...cropRegion };
        e.preventDefault();
    } else if (isInsideCrop(pos)) {
        isDraggingCrop = true;
        dragStart = pos;
        cropStart = { ...cropRegion };
        e.preventDefault();
    }
});

cropCanvas.addEventListener('mousemove', e => {
    const pos = getMousePos(e);
    const corner = getCornerAt(pos);
    cropCanvas.style.cursor = corner || (isInsideCrop(pos) ? 'move' : 'default');
});

document.addEventListener('mousemove', e => {
    if (!isDraggingCrop && !isResizingCrop) return;

    const pos = getMousePos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const dxImg = dx / displayScale;
    const dyImg = dy / displayScale;

    if (isDraggingCrop) {
        let newX = cropStart.x + dxImg;
        let newY = cropStart.y + dyImg;
        newX = Math.max(0, Math.min(newX, sourceImage.width - cropRegion.width));
        newY = Math.max(0, Math.min(newY, sourceImage.height - cropRegion.height));
        cropRegion.x = newX;
        cropRegion.y = newY;
    } else if (isResizingCrop) {
        const deltaSize = (dxImg + dyImg) / 2;
        switch (resizeCorner) {
            case 'se-resize': {
                let size = Math.max(10, cropStart.width + deltaSize);
                size = Math.min(size, sourceImage.width - cropStart.x, sourceImage.height - cropStart.y);
                cropRegion.width = cropRegion.height = size;
                break;
            }
            case 'ne-resize': {
                let size = Math.max(10, cropStart.width + dxImg - dyImg);
                size = Math.min(size, sourceImage.width - cropStart.x, cropStart.y + cropStart.height);
                cropRegion.width = cropRegion.height = size;
                cropRegion.y = cropStart.y + cropStart.height - size;
                break;
            }
            case 'sw-resize': {
                let size = Math.max(10, cropStart.width - dxImg + dyImg);
                size = Math.min(size, cropStart.x + cropStart.width, sourceImage.height - cropStart.y);
                cropRegion.width = cropRegion.height = size;
                cropRegion.x = cropStart.x + cropStart.width - size;
                break;
            }
            case 'nw-resize': {
                let size = Math.max(10, cropStart.width - deltaSize);
                size = Math.min(size, cropStart.x + cropStart.width, cropStart.y + cropStart.height);
                cropRegion.width = cropRegion.height = size;
                cropRegion.x = cropStart.x + cropStart.width - size;
                cropRegion.y = cropStart.y + cropStart.height - size;
                break;
            }
        }
    }

    drawCropCanvas();
    renderAllPreviews();
});

document.addEventListener('mouseup', () => {
    isDraggingCrop = false;
    isResizingCrop = false;
    resizeCorner = null;
});

// ========== 圆角控制 ==========
radiusRange.addEventListener('input', e => {
    radiusPercent = parseInt(e.target.value);
    radiusValue.textContent = radiusPercent + '%';
    if (sourceImage) renderAllPreviews();
});

// ========== 尺寸管理 ==========
function renderSizeList() {
    sizeList.innerHTML = '';
    sizes.forEach((size, index) => {
        const item = document.createElement('div');
        item.className = 'size-item';
        item.innerHTML = `
            <span>${size}px</span>
            <button data-index="${index}">×</button>
        `;
        sizeList.appendChild(item);
    });
    sizeList.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', e => {
            const index = parseInt(e.target.dataset.index);
            sizes.splice(index, 1);
            renderSizeList();
            if (sourceImage) renderAllPreviews();
        });
    });
}

addSizeBtn.addEventListener('click', () => {
    const val = parseInt(sizeInput.value);
    if (isNaN(val) || val < 1 || val > 4096) {
        alert('请输入 1-4096 之间的像素值');
        return;
    }
    if (sizes.includes(val)) {
        alert('该尺寸已存在');
        return;
    }
    sizes.push(val);
    sizes.sort((a, b) => a - b);
    renderSizeList();
    if (sourceImage) renderAllPreviews();
});

// ========== 核心：绘制带圆角的图标 ==========
function drawRoundedIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const radius = size * radiusPercent / 100;

    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();

    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
        sourceImage,
        cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height,
        0, 0, size, size
    );

    return canvas;
}

// ========== 渲染所有预览 ==========
function renderAllPreviews() {
    previewArea.innerHTML = '';
    sizes.forEach(size => {
        const canvas = drawRoundedIcon(size);
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <div class="preview-box"></div>
            <p>${size}px</p>
        `;
        item.querySelector('.preview-box').appendChild(canvas);
        previewArea.appendChild(item);
    });
}

// ========== Canvas 转 PNG 二进制数据 ==========
function canvasToPngBuffer(canvas) {
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.readAsArrayBuffer(blob);
        }, 'image/png');
    });
}

// ========== 构造 ICO 文件 ==========
async function generateIco() {
    const pngBuffers = [];
    for (const size of sizes) {
        const canvas = drawRoundedIcon(size);
        const buf = await canvasToPngBuffer(canvas);
        pngBuffers.push({ size, data: buf });
    }

    const headerSize = 6;
    const entrySize = 16;
    const count = pngBuffers.length;
    let totalSize = headerSize + entrySize * count;
    pngBuffers.forEach(item => totalSize += item.data.length);

    const icoBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(icoBuffer);
    const icoArray = new Uint8Array(icoBuffer);

    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, count, true);

    let dataOffset = headerSize + entrySize * count;
    for (let i = 0; i < count; i++) {
        const { size, data } = pngBuffers[i];
        const entryOffset = headerSize + i * entrySize;

        view.setUint8(entryOffset, size <= 255 ? size : 0);
        view.setUint8(entryOffset + 1, size <= 255 ? size : 0);
        view.setUint8(entryOffset + 2, 0);
        view.setUint8(entryOffset + 3, 0);
        view.setUint16(entryOffset + 4, 1, true);
        view.setUint16(entryOffset + 6, 32, true);
        view.setUint32(entryOffset + 8, data.length, true);
        view.setUint32(entryOffset + 12, dataOffset, true);

        icoArray.set(data, dataOffset);
        dataOffset += data.length;
    }

    const fileName = fileNameInput.value.trim() || 'icon';
    const blob = new Blob([icoBuffer], { type: 'image/x-icon' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + '.ico';
    a.click();
    URL.revokeObjectURL(url);
}

generateBtn.addEventListener('click', generateIco);

window.addEventListener('resize', () => {
    if (sourceImage) initCrop();
});