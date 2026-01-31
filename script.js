// script.js
// Lógica para dividir imagen y generar PDF en hojas A4

// Cargar jsPDF desde el CDN si no está en local
if (typeof window.jspdf === 'undefined') {
	const script = document.createElement('script');
	script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
	document.head.appendChild(script);
}


const imageInput = document.getElementById('imageInput');
const colsInput = document.getElementById('cols');
const rowsInput = document.getElementById('rows');
const generateBtn = document.getElementById('generateBtn');

const previewDiv = document.getElementById('preview');
const cropContainer = document.getElementById('crop-container');
const cropImage = document.getElementById('crop-image');
const cropBtn = document.getElementById('cropBtn');
const printBtn = document.getElementById('printBtn');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const messageDiv = document.getElementById('message');

function showLoader(text = 'Procesando...') {
	loaderText.textContent = text;
	loader.style.display = 'flex';
}
function hideLoader() {
	loader.style.display = 'none';
}
function showMessage(msg, success = true) {
	messageDiv.textContent = msg;
	messageDiv.style.background = success ? '#1976d2' : '#d32f2f';
	messageDiv.style.display = 'block';
	setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
}

let loadedImage = null;
let cropper = null;
let croppedCanvas = null;
let lastPdfBlobUrl = null;


imageInput.addEventListener('change', (e) => {
	const file = e.target.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = function (evt) {
		cropImage.src = evt.target.result;
		cropContainer.style.display = 'block';
		previewDiv.style.display = 'none';
		if (cropper) {
			cropper.destroy();
		}
		cropper = new Cropper(cropImage, {
			viewMode: 1,
			autoCropArea: 1,
			movable: true,
			zoomable: true,
			scalable: true,
			aspectRatio: NaN
		});
	};
	reader.readAsDataURL(file);
});

cropBtn.addEventListener('click', () => {
	if (cropper) {
		croppedCanvas = cropper.getCroppedCanvas();
		cropContainer.style.display = 'none';
		previewDiv.style.display = 'block';
		// Convertir el canvas recortado a un objeto Image
		const img = new Image();
		img.onload = function () {
			loadedImage = img;
			showPreview(loadedImage);
		};
		img.src = croppedCanvas.toDataURL('image/png');
		cropper.destroy();
		cropper = null;
	}
});

function showPreview(img) {
	previewDiv.innerHTML = '';
	const canvas = document.createElement('canvas');
	canvas.width = img.width;
	canvas.height = img.height;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0);

	// Ajuste automático de color para impresión (simulación)
	// Aumentar contraste y saturación
	let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	let data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		// Aumentar saturación y contraste
		let r = data[i], g = data[i+1], b = data[i+2];
		// Convertir a HSL
		let mx = Math.max(r, g, b), mn = Math.min(r, g, b);
		let l = (mx + mn) / 2 / 255;
		let s = 0, h = 0;
		if (mx !== mn) {
			let d = mx - mn;
			s = l > 0.5 ? d / (2*255 - mx - mn) : d / (mx + mn);
			switch(mx){
				case r: h = (g-b)/d + (g < b ? 6 : 0); break;
				case g: h = (b-r)/d + 2; break;
				case b: h = (r-g)/d + 4; break;
			}
			h /= 6;
		}
		// Aumentar saturación
		s = Math.min(1, s * 1.25);
		// Aumentar contraste
		l = Math.min(1, Math.max(0, (l - 0.5) * 1.15 + 0.5));
		// Convertir de nuevo a RGB
		function hslToRgb(h, s, l) {
			let r, g, b;
			if(s === 0){ r = g = b = l; }
			else {
				function hue2rgb(p, q, t){
					if(t < 0) t += 1;
					if(t > 1) t -= 1;
					if(t < 1/6) return p + (q - p) * 6 * t;
					if(t < 1/2) return q;
					if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
					return p;
				}
				let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
				let p = 2 * l - q;
				r = hue2rgb(p, q, h + 1/3);
				g = hue2rgb(p, q, h);
				b = hue2rgb(p, q, h - 1/3);
			}
			return [r * 255, g * 255, b * 255];
		}
		let rgb = hslToRgb(h, s, l);
		data[i] = rgb[0];
		data[i+1] = rgb[1];
		data[i+2] = rgb[2];
	}
	ctx.putImageData(imageData, 0, 0);

	// Dibujar líneas de corte según columnas y filas
	const cols = parseInt(colsInput.value, 10);
	const rows = parseInt(rowsInput.value, 10);
	ctx.save();
	ctx.strokeStyle = 'rgba(255,0,0,0.7)';
	ctx.lineWidth = 2;
	// Líneas verticales
	for (let c = 1; c < cols; c++) {
		const x = (img.width / cols) * c;
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, img.height);
		ctx.stroke();
	}
	// Líneas horizontales
	for (let r = 1; r < rows; r++) {
		const y = (img.height / rows) * r;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(img.width, y);
		ctx.stroke();
	}
	ctx.restore();

	// Responsive preview
	canvas.style.maxWidth = '98vw';
	canvas.style.maxHeight = '60vh';
	previewDiv.appendChild(canvas);
}
// Actualizar vista previa al cambiar filas/columnas
colsInput.addEventListener('input', () => {
	if (loadedImage) showPreview(loadedImage);
});
rowsInput.addEventListener('input', () => {
	if (loadedImage) showPreview(loadedImage);
});


generateBtn.addEventListener('click', async () => {
	if (!loadedImage) {
		showMessage('Primero selecciona una imagen.', false);
		return;
	}
	const cols = parseInt(colsInput.value, 10);
	const rows = parseInt(rowsInput.value, 10);
	if (cols < 1 || rows < 1) {
		showMessage('Columnas y filas deben ser mayores a 0.', false);
		return;
	}
	showLoader('Generando PDF...');
	try {
		await generatePDF(loadedImage, cols, rows);
		hideLoader();
		showMessage('¡PDF generado con éxito!');
	} catch (e) {
		hideLoader();
		showMessage('Error al generar el PDF.', false);
	}
});

printBtn.addEventListener('click', () => {
	if (lastPdfBlobUrl) {
		const win = window.open(lastPdfBlobUrl, '_blank');
		if (win) {
			win.onload = function() {
				win.focus();
				win.print();
			};
		}
	}
});

async function generatePDF(img, cols, rows) {
	// Tamaño A4 en puntos (1 pt = 1/72 in)
	const a4Width = 595.28; // 210mm
	const a4Height = 841.89; // 297mm

	// Calcular tamaño de cada segmento en px
	const segWidth = Math.floor(img.width / cols);
	const segHeight = Math.floor(img.height / rows);

	// Crear PDF
	const { jsPDF } = window.jspdf || window.jspdf || {};
	if (!jsPDF) {
		alert('No se pudo cargar jsPDF.');
		return;
	}
	const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			// Crear canvas temporal para cada segmento
			const canvas = document.createElement('canvas');
			canvas.width = segWidth;
			canvas.height = segHeight;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(
				img,
				col * segWidth,
				row * segHeight,
				segWidth,
				segHeight,
				0,
				0,
				segWidth,
				segHeight
			);
			// Convertir a dataURL
			const imgData = canvas.toDataURL('image/jpeg', 1.0);
			// Calcular escala para llenar A4 sin bordes
			const scale = Math.min(a4Width / segWidth, a4Height / segHeight);
			const w = segWidth * scale;
			const h = segHeight * scale;
			// Centrar en la hoja
			const x = (a4Width - w) / 2;
			const y = (a4Height - h) / 2;
			pdf.addImage(imgData, 'JPEG', x, y, w, h);
			// No agregar página extra al final
			if (!(row === rows - 1 && col === cols - 1)) {
				pdf.addPage();
			}
		}
	}
	// Guardar PDF y habilitar impresión
	const pdfBlob = pdf.output('blob');
	if (lastPdfBlobUrl) {
		URL.revokeObjectURL(lastPdfBlobUrl);
	}
	lastPdfBlobUrl = URL.createObjectURL(pdfBlob);
	printBtn.disabled = false;
	// Descargar PDF automáticamente
	pdf.save('poster_a4.pdf');
}
