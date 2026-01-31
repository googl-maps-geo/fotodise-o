document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- STATE MANAGEMENT ---
    let image = null;
    let imgElement = null;
    let cols = 3;
    let rows = 2;
    let orientation = 'portrait';
    let status = 'idle'; // 'idle', 'processing', 'ready'
    let currentTileIndex = 0;
    let processedTiles = [];
    let logs = "";
    let jsPdfLoaded = false; // Se valida tras la carga del DOM

    // --- DOM ELEMENTS ---
    const uploadView = document.getElementById('upload-view');
    const processingView = document.getElementById('processing-view');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('fileInput');
    
    const settingsPanel = document.getElementById('settings-panel');
    const colsInput = document.getElementById('cols-input');
    const rowsInput = document.getElementById('rows-input');
    const portraitBtn = document.getElementById('portrait-btn');
    const landscapeBtn = document.getElementById('landscape-btn');

    const startBtnContainer = document.getElementById('start-button-container');
    const startBtn = document.getElementById('start-btn');
    
    const processingStatusContainer = document.getElementById('processing-status-container');
    const processingStatusText = document.getElementById('processing-status-text');
    const progressBar = document.getElementById('progress-bar');
    const logsElement = document.getElementById('logs');

    const downloadContainer = document.getElementById('download-container');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    const viewerLabel = document.getElementById('viewer-label');
    const previewIdle = document.getElementById('preview-idle');
    const previewImg = document.getElementById('preview-img');
    const previewGrid = document.getElementById('preview-grid');
    const canvasProcessing = document.getElementById('canvas-processing');

    // Marcar jsPDF como cargado si está disponible
    jsPdfLoaded = !!(window.jspdf && window.jspdf.jsPDF);

    // --- EVENT LISTENERS ---
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageUpload);
    
    colsInput.addEventListener('change', (e) => {
        cols = Math.max(1, parseInt(e.target.value));
        updatePreviewGrid();
    });
    rowsInput.addEventListener('change', (e) => {
        rows = Math.max(1, parseInt(e.target.value));
        updatePreviewGrid();
    });

    portraitBtn.addEventListener('click', () => {
        orientation = 'portrait';
        updateOrientationButtons();
    });
    landscapeBtn.addEventListener('click', () => {
        orientation = 'landscape';
        updateOrientationButtons();
    });

    startBtn.addEventListener('click', startProcessing);
    downloadBtn.addEventListener('click', downloadPDF);
    resetBtn.addEventListener('click', () => {
        image = null;
        imgElement = null;
        previewImg.src = "";
        resetState();
        updateUI();
    });


    // --- UI UPDATE FUNCTIONS ---

    function updateUI() {
        if (status === 'idle') {
            uploadView.classList.toggle('hidden', image);
            processingView.classList.toggle('hidden', !image);
            
            settingsPanel.classList.remove('opacity-50', 'pointer-events-none');
            startBtnContainer.classList.remove('hidden');
            processingStatusContainer.classList.add('hidden');
            downloadContainer.classList.add('hidden');
            
            previewIdle.classList.remove('hidden');
            canvasProcessing.classList.add('hidden');
            viewerLabel.textContent = 'VISTA PREVIA';

        } else if (status === 'processing') {
            settingsPanel.classList.add('opacity-50', 'pointer-events-none');
            startBtnContainer.classList.add('hidden');
            processingStatusContainer.classList.remove('hidden');
            downloadContainer.classList.add('hidden');

            previewIdle.classList.add('hidden');
            canvasProcessing.classList.remove('hidden');
            viewerLabel.textContent = 'MONITOR DE RESTAURACIÓN EN TIEMPO REAL';
        
        } else if (status === 'ready') {
            settingsPanel.classList.add('opacity-50', 'pointer-events-none');
            startBtnContainer.classList.add('hidden');
            processingStatusContainer.classList.add('hidden');
            downloadContainer.classList.remove('hidden');
            logsElement.textContent = "¡Restauración Completa! Generando vista final.";
        }
    }

    function updateOrientationButtons() {
        if (orientation === 'portrait') {
            portraitBtn.classList.replace('bg-slate-800', 'bg-orange-600');
            portraitBtn.classList.add('text-white');
            landscapeBtn.classList.replace('bg-orange-600', 'bg-slate-800');
            landscapeBtn.classList.remove('text-white');
        } else {
            landscapeBtn.classList.replace('bg-slate-800', 'bg-orange-600');
            landscapeBtn.classList.add('text-white');
            portraitBtn.classList.replace('bg-orange-600', 'bg-slate-800');
            portraitBtn.classList.remove('text-white');
        }
    }

    function updatePreviewGrid() {
        previewGrid.innerHTML = '';
        previewGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        previewGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        for (let i = 0; i < cols * rows; i++) {
            const cell = document.createElement('div');
            cell.className = 'border border-white/20';
            previewGrid.appendChild(cell);
        }
    }
    
    function updateLogs(message) {
        logs = message;
        logsElement.textContent = logs;
    }

    function updateProgress() {
        processingStatusText.textContent = `Procesando Hoja ${currentTileIndex} de ${cols*rows}`;
        const percentage = (currentTileIndex / (cols * rows)) * 100;
        progressBar.style.width = `${percentage}%`;
    }


    // --- CORE LOGIC ---

    function handleImageUpload(e) {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    imgElement = img;
                    image = event.target.result;
                    previewImg.src = image;
                    resetState();
                    updateUI();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    function resetState() {
        status = 'idle';
        processedTiles = [];
        currentTileIndex = 0;
        updateLogs("");
        updatePreviewGrid();
        updateOrientationButtons();
    }

    // --- DEEP RESTORE FILTERS ---

    function applyColorCorrection(data) {
        const contrast = 1.2;
        const saturation = 1.3;
        const brightness = 10;
        const intercept = 128 * (1 - contrast);

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];
            r = r * contrast + intercept + brightness;
            g = g * contrast + intercept + brightness;
            b = b * contrast + intercept + brightness;
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = gray + (r - gray) * saturation;
            g = gray + (g - gray) * saturation;
            b = gray + (b - gray) * saturation;
            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    function applySharpening(ctx, w, h) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const src = imgData.data;
        const output = ctx.createImageData(w, h);
        const dst = output.data;
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const dstOff = (y * w + x) * 4;
                let r = 0, g = 0, b = 0;
                for (let cy = 0; cy < 3; cy++) {
                    for (let cx = 0; cx < 3; cx++) {
                        const scy = y + cy - 1;
                        const scx = x + cx - 1;
                        if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                            const srcOff = (scy * w + scx) * 4;
                            const wt = kernel[cy * 3 + cx];
                            r += src[srcOff] * wt;
                            g += src[srcOff + 1] * wt;
                            b += src[srcOff + 2] * wt;
                        }
                    }
                }
                dst[dstOff] = Math.min(255, Math.max(0, r));
                dst[dstOff + 1] = Math.min(255, Math.max(0, g));
                dst[dstOff + 2] = Math.min(255, Math.max(0, b));
                dst[dstOff + 3] = src[dstOff + 3];
            }
        }
        ctx.putImageData(output, 0, 0);
    }

    // --- SEQUENTIAL PROCESSING ENGINE ---

    function startProcessing() {
        if (!imgElement) return;
        status = 'processing';
        processedTiles = [];
        currentTileIndex = 0;
        updateLogs("Iniciando motor de restauración...");
        updateUI();
        
        setTimeout(() => processNextTile(0, []), 100);
    }

    async function processNextTile(index, currentTilesArray) {
        const totalTiles = cols * rows;

        if (index >= totalTiles) {
            processedTiles = currentTilesArray;
            status = 'ready';
            updateUI();
            return;
        }

        currentTileIndex = index + 1;
        updateProgress();
        const r = Math.floor(index / cols);
        const c = index % cols;

        updateLogs(`Cargando Hoja A4 #${index + 1} (Fila ${r+1}, Col ${c+1})...`);

        const dpi = 300;
        const pxPerMm = dpi / 25.4;
        const tileW_mm = orientation === 'portrait' ? 210 : 297;
        const tileH_mm = orientation === 'portrait' ? 297 : 210;
        const tileW_px = Math.ceil(tileW_mm * pxPerMm);
        const tileH_px = Math.ceil(tileH_mm * pxPerMm);

        const totalW_px = tileW_px * cols;
        const totalH_px = tileH_px * rows;
        const imgRatio = imgElement.width / imgElement.height;
        const wallRatio = totalW_px / totalH_px;
        
        let sX, sY, sW, sH;
        if (wallRatio > imgRatio) {
            sW = imgElement.width;
            sH = imgElement.width / wallRatio;
            sX = 0;
            sY = (imgElement.height - sH) / 2;
        } else {
            sH = imgElement.height;
            sW = imgElement.height * wallRatio;
            sY = 0;
            sX = (imgElement.width - sW) / 2;
        }

        const tileRelW = sW / cols;
        const tileRelH = sH / rows;
        const currentSX = sX + (c * tileRelW);
        const currentSY = sY + (r * tileRelH);

        const canvas = document.createElement('canvas');
        canvas.width = tileW_px;
        canvas.height = tileH_px;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        updateLogs(`Hoja #${index + 1}: Escalando a resolución 8K...`);
        ctx.drawImage(imgElement, currentSX, currentSY, tileRelW, tileRelH, 0, 0, tileW_px, tileH_px);

        const previewCtx = canvasProcessing.getContext('2d');
        canvasProcessing.width = tileW_px;
        canvasProcessing.height = tileH_px;
        previewCtx.drawImage(canvas, 0, 0);

        await new Promise(res => setTimeout(res, 300));

        updateLogs(`Hoja #${index + 1}: Corrigiendo colores y contraste...`);
        const imgData = ctx.getImageData(0, 0, tileW_px, tileH_px);
        applyColorCorrection(imgData.data);
        ctx.putImageData(imgData, 0, 0);
        
        previewCtx.drawImage(canvas, 0, 0);
        await new Promise(res => setTimeout(res, 300));

        updateLogs(`Hoja #${index + 1}: Definiendo bordes y eliminando borrosidad...`);
        applySharpening(ctx, tileW_px, tileH_px);
        
        previewCtx.drawImage(canvas, 0, 0);
        await new Promise(res => setTimeout(res, 200));

        const finalData = canvas.toDataURL('image/jpeg', 0.95);
        const newTiles = [...currentTilesArray, finalData];
        
        processNextTile(index + 1, newTiles);
    }

    function downloadPDF() {
        if (processedTiles.length === 0 || !jsPdfLoaded || !window.jspdf) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
        const w = orientation === 'portrait' ? 210 : 297;
        const h = orientation === 'portrait' ? 297 : 210;

        processedTiles.forEach((tileData, i) => {
            if (i > 0) doc.addPage();
            doc.addImage(tileData, 'JPEG', 0, 0, w, h);
        });

        doc.save(`Poster_Restaurado_${cols}x${rows}.pdf`);
    }

    // Initial call
    updatePreviewGrid();
    updateOrientationButtons();
    updateUI();
});