const themeToggle = document.getElementById('themeToggle');
const API_URL = 'https://pixelmorph.onrender.com';
const root = document.documentElement;
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const convertBtn = document.getElementById('convertBtn');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const targetFormat = document.getElementById('targetFormat');
const formatSelect = document.getElementById('targetFormat');
const pendingConversions = [];

const activeTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (activeTheme === 'dark' || (!activeTheme && prefersDark)) {
	root.classList.add('dark');
}

setTimeout(() => {
	const adFrames = document.querySelectorAll('.ad-slot ins');
	const hasRenderedAd = Array.from(adFrames).some((slot) => slot.querySelector('iframe, img, script') || slot.children.length > 0);

	if (!hasRenderedAd) {
		document.body.classList.add('ads-blocked');
	}
}, 3500);

themeToggle.addEventListener('click', () => {
	root.classList.toggle('dark');
	localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
});

selectFileBtn.addEventListener('click', () => fileInput.click());
convertBtn.addEventListener('click', executarConversoesPendentes);

['dragenter', 'dragover'].forEach((eventName) => {
	dropZone.addEventListener(eventName, (event) => {
		event.preventDefault();
		event.stopPropagation();
		dropZone.classList.add('is-active');
	});
});

['dragleave', 'drop'].forEach((eventName) => {
	dropZone.addEventListener(eventName, (event) => {
		event.preventDefault();
		event.stopPropagation();
		dropZone.classList.remove('is-active');
	});
});

dropZone.addEventListener('drop', (event) => {
	const files = Array.from(event.dataTransfer.files || []);
	handleSelectedFiles(files);
});

fileInput.addEventListener('change', (event) => {
	const files = Array.from(event.target.files || []);
	handleSelectedFiles(files);
	fileInput.value = '';
});

function handleSelectedFiles(files) {
	if (!files.length) {
		return;
	}

	if (fileList.firstElementChild && fileList.firstElementChild.textContent.includes('Nenhum arquivo')) {
		fileList.innerHTML = '';
	}

	files.forEach((file) => {
		if (!isImageFile(file)) {
			createInvalidFileItem(file);
			return;
		}

		createFileItem(file);
	});

	updateCount();
	updateConvertButtonState();
}

function isImageFile(file) {
	return file.type.startsWith('image/');
}

function createFileItem(file) {
	const item = document.createElement('li');
	item.className = 'rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50';

	const selectedFormat = getSelectedFormat();
	const target = selectedFormat.toUpperCase();
	const readableSize = `${(file.size / 1024).toFixed(1)} KB`;

	item.innerHTML = `
		<div class="flex items-center justify-between gap-3 text-sm">
			<div>
				<p class="font-medium text-slate-800 dark:text-slate-100">${file.name}</p>
				<p class="text-xs text-slate-500 dark:text-slate-400">${readableSize} • Destino: ${target}</p>
			</div>
			<span class="status text-xs font-medium text-brand-600">Preparando...</span>
		</div>
		<div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
			<div class="progress h-full w-0 rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-300"></div>
		</div>
	`;

	fileList.prepend(item);

	const status = item.querySelector('.status');
	const progressBar = item.querySelector('.progress');
	pendingConversions.push({ file, selectedFormat, item, status, progressBar });
}

function createInvalidFileItem(file) {
	const item = document.createElement('li');
	item.className = 'rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30';
	item.innerHTML = `
		<div class="flex items-center justify-between gap-3 text-sm">
			<div>
				<p class="font-medium text-rose-700 dark:text-rose-300">${file.name || 'Arquivo sem nome'}</p>
				<p class="text-xs text-rose-600/90 dark:text-rose-400">Arquivo ignorado: formato nao suportado.</p>
			</div>
			<span class="text-xs font-medium text-rose-600 dark:text-rose-400">Invalido</span>
		</div>
	`;

	fileList.prepend(item);
	updateConvertButtonState();
}

async function executarConversoesPendentes() {
	if (!pendingConversions.length) {
		return;
	}

	setConvertButtonProcessing(true);

	while (pendingConversions.length) {
		const conversion = pendingConversions.shift();
		await processarConversao(conversion.file, conversion.selectedFormat, conversion.status, conversion.progressBar, conversion.item);
	}

	setConvertButtonProcessing(false);
	updateConvertButtonState();
}

async function processarConversao(file, selectedFormat, status, progressBar, item) {
	let progress = 0;
	status.textContent = 'Enviando...';
	item.classList.add('animate-pulse');

	const timer = setInterval(() => {
		const increment = Math.floor(Math.random() * 12) + 6;
		progress = Math.min(progress + increment, 90);
		progressBar.style.width = `${progress}%`;
	}, 250);

	try {
		await enviarParaConversao(file, selectedFormat);
		clearInterval(timer);
		progressBar.style.width = '100%';
		status.textContent = 'Concluido';
		status.classList.remove('text-brand-600');
		status.classList.add('text-emerald-600');
	} catch {
		clearInterval(timer);
		progressBar.style.width = '100%';
		status.textContent = 'Falha no envio';
		status.classList.remove('text-brand-600');
		status.classList.add('text-rose-600');
	} finally {
		item.classList.remove('animate-pulse');
	}
}

async function enviarParaConversao(file, selectedFormat) {
	const formData = new FormData();
	formData.append('file', file);
	const formatParam = (formatSelect?.value || selectedFormat || 'jpg').toLowerCase();
	const selectedFromUi = formatSelect?.value || formatParam;
	let response;

	try {
		response = await fetch(`${API_URL}/convert?format=${selectedFromUi}`, {
			method: 'POST',
			body: formData
		});
	} catch {
		const startupMessage = 'O servidor esta iniciando, por favor aguarde alguns segundos...';
		alert(startupMessage);
		throw new Error(startupMessage);
	}

	if (!response.ok) {
		let message = 'Falha ao converter arquivo.';
		try {
			const data = await response.json();
			if (data?.detail) {
				message = data.detail;
			}
		} catch {
			// Mantem a mensagem padrao quando a resposta nao e JSON.
		}
		throw new Error(message);
	}

	const blob = await response.blob();
	const fileName = getDownloadFileName(response.headers.get('content-disposition'), file.name, formatParam);
	const blobUrl = URL.createObjectURL(blob);

	const tempLink = document.createElement('a');
	tempLink.href = blobUrl;
	tempLink.download = fileName;
	tempLink.style.display = 'none';
	document.body.appendChild(tempLink);
	tempLink.click();
	tempLink.remove();
	URL.revokeObjectURL(blobUrl);
}

function getDownloadFileName(contentDisposition, originalName, selectedFormat) {
	const fallbackName = buildNameFromOriginal(originalName, selectedFormat);

	if (contentDisposition) {
		const match = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
		if (match && match[1]) {
			const serverName = decodeURIComponent(match[1].trim().replace(/"/g, ''));
			return ensureOutputExtension(serverName, fallbackName, selectedFormat);
		}
	}

	return fallbackName;
}

function buildNameFromOriginal(originalName, selectedFormat) {
	const extension = normalizeOutputExtension(selectedFormat);
	const safeName = originalName || `convertida.${extension}`;
	const baseName = safeName.includes('.') ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
	return `${baseName}.${extension}`;
}

function ensureOutputExtension(fileName, fallbackName, selectedFormat) {
	const extension = normalizeOutputExtension(selectedFormat);

	if (!fileName) {
		return fallbackName;
	}

	if (fileName.toLowerCase().endsWith(`.${extension}`)) {
		return fileName;
	}
	if (extension === 'jpg' && fileName.toLowerCase().endsWith('.jpeg')) {
		return fileName;
	}

	const baseName = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
	return `${baseName}.${extension}`;
}

function getSelectedFormat() {
	const selected = (targetFormat?.value || 'jpg').toLowerCase();
	if (selected === 'png' || selected === 'jpg' || selected === 'jpeg' || selected === 'webp') {
		return selected;
	}
	return 'jpg';
}

function normalizeOutputExtension(format) {
	if (format === 'png') {
		return 'png';
	}
	if (format === 'webp') {
		return 'webp';
	}
	return 'jpg';
}

function updateCount() {
	const total = fileList.children.length;
	fileCount.textContent = `${total} ${total === 1 ? 'arquivo' : 'arquivos'}`;
}

function setConvertButtonProcessing(isProcessing) {
	if (isProcessing) {
		convertBtn.disabled = true;
		convertBtn.textContent = 'Processando...';
		return;
	}

	convertBtn.textContent = 'Converter';
}

function updateConvertButtonState() {
	if (convertBtn.textContent === 'Processando...') {
		return;
	}

	convertBtn.disabled = pendingConversions.length === 0;
}
