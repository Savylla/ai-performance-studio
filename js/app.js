// === AI Performance Studio - Main Application ===

let currentTab = 'image';
let syncTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSidebar();
  initPrompt();
  initImageSettings();
  initAudio();
  initProviderPills();
  initLightbox();
  initKeyboardShortcuts();
  initApiKeyModal();
});

// === TAB MANAGEMENT ===
function initTabs() {
  // Topbar tabs
  document.querySelectorAll('.topbar-link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });
  // Sidebar tabs
  document.querySelectorAll('.sidebar-nav .nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
      if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('open');
        document.querySelector('.sidebar-overlay')?.classList.remove('open');
      }
    });
  });
  // Audio sub-tabs
  document.querySelectorAll('.audio-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audio-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.audio-section').forEach(s => s.classList.remove('active'));
      const target = btn.dataset.audiotab;
      if (target === 'tts') {
        document.getElementById('audioTTS').classList.add('active');
        document.getElementById('generateAudioBtn').style.display = '';
        document.getElementById('recordBtn').style.display = 'none';
        document.getElementById('audioProviders').querySelector('.provider-label').textContent = 'TTS:';
        showTTSProviders();
      } else {
        document.getElementById('audioTranscribe').classList.add('active');
        document.getElementById('generateAudioBtn').style.display = 'none';
        document.getElementById('recordBtn').style.display = '';
        document.getElementById('audioProviders').querySelector('.provider-label').textContent = 'STT:';
        showSTTProviders();
      }
    });
  });
}

function switchTab(tab) {
  currentTab = tab;
  // Update topbar
  document.querySelectorAll('.topbar-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.topbar-link[data-tab="${tab}"]`)?.classList.add('active');
  // Update sidebar
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.sidebar-nav .nav-item[data-tab="${tab}"]`)?.classList.add('active');
  // Show tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1))?.classList.add('active');
  // Show tab settings
  document.querySelectorAll('.tab-settings').forEach(s => s.classList.remove('active'));
  document.getElementById('settings' + tab.charAt(0).toUpperCase() + tab.slice(1))?.classList.add('active');
  // Update prompt placeholder
  const placeholders = {
    image: 'Descreva a imagem que voce quer criar...',
    video: 'Descreva o video que voce quer criar...',
    audio: 'Digite o texto para converter em audio...',
    text: 'Digite seu prompt para gerar texto...'
  };
  document.getElementById('promptInput').placeholder = placeholders[tab] || placeholders.image;
  // Show/hide enhance & lang buttons based on tab
  const langBtns = document.getElementById('langButtons');
  const enhanceBtn = document.getElementById('enhanceBtn');
  if (tab === 'image') {
    langBtns.style.display = '';
    enhanceBtn.style.display = '';
  } else {
    langBtns.style.display = 'none';
    enhanceBtn.style.display = 'none';
  }
}

function showTTSProviders() {
  const pills = document.getElementById('audioProviders');
  pills.innerHTML = `
    <span class="provider-label">TTS:</span>
    <button class="provider-pill active" data-provider="browser-tts" title="Nativo do navegador, gratis ilimitado">
      <span class="dot free"></span> Browser Nativo
    </button>
    <button class="provider-pill" data-provider="pollinations-tts" title="Gratis, sem API key - vozes premium">
      <span class="dot free"></span> Pollinations TTS
    </button>
  `;
  document.getElementById('voiceSelector').style.display = '';
  initProviderPillsIn(pills);
  updateVoiceSelect();
}

function showSTTProviders() {
  const pills = document.getElementById('audioProviders');
  pills.innerHTML = `
    <span class="provider-label">STT:</span>
    <button class="provider-pill active" data-provider="browser-stt" title="Nativo do navegador, gratis ilimitado">
      <span class="dot free"></span> Browser Nativo
    </button>
    <button class="provider-pill" data-provider="pollinations-stt" title="Gratis, sem API key">
      <span class="dot free"></span> Pollinations STT
    </button>
  `;
  document.getElementById('voiceSelector').style.display = 'none';
  initProviderPillsIn(pills);
}

// === SIDEBAR ===
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  menuToggle.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  });
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }
  sidebarClose.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
}

// === PROMPT ===
function initPrompt() {
  const textarea = document.getElementById('promptInput');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // Enhance button (bilingual for image tab)
  document.getElementById('enhanceBtn').addEventListener('click', () => {
    if (!textarea.value.trim()) { showToast('Escreva um prompt primeiro', 'error'); return; }
    enhancePromptBilingual(textarea.value.trim());
  });

  // Language buttons
  document.getElementById('langPT').addEventListener('click', () => {
    document.getElementById('langPT').classList.add('active');
    document.getElementById('langEN').classList.remove('active');
  });
  document.getElementById('langEN').addEventListener('click', () => {
    document.getElementById('langEN').classList.add('active');
    document.getElementById('langPT').classList.remove('active');
  });

  // PT textarea edit -> auto sync to EN
  document.getElementById('promptPT').addEventListener('input', () => {
    clearTimeout(syncTimeout);
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando...';
    syncStatus.className = 'bilingual-sync';
    syncTimeout = setTimeout(() => syncPTtoEN(), 1500);
  });

  // Use English button
  document.getElementById('useEnglishBtn').addEventListener('click', () => {
    const enText = document.getElementById('promptEN').value.trim();
    if (enText) {
      document.getElementById('promptInput').value = enText;
      document.getElementById('promptInput').style.height = 'auto';
      document.getElementById('promptInput').style.height = document.getElementById('promptInput').scrollHeight + 'px';
      showToast('Prompt EN aplicado!', 'success');
    }
  });

  document.getElementById('closeBilingualBtn').addEventListener('click', () => {
    document.getElementById('bilingualArea').style.display = 'none';
  });

  // Generate button (top send button in prompt row)
  document.getElementById('generateBtn').addEventListener('click', handleGenerate);
  document.getElementById('generateBtnMain').addEventListener('click', handleGenerate);
  document.getElementById('generateVideoBtn')?.addEventListener('click', handleGenerate);
  document.getElementById('generateAudioBtn')?.addEventListener('click', handleGenerate);
  document.getElementById('generateTextBtn')?.addEventListener('click', handleGenerate);
  document.getElementById('recordBtn')?.addEventListener('click', startTranscription);
}

function handleGenerate() {
  switch (currentTab) {
    case 'image': startImageGeneration(); break;
    case 'video': startVideoGeneration(); break;
    case 'audio': startTTS(); break;
    case 'text': startTextGeneration(); break;
  }
}

// === PROVIDER PILLS ===
function initProviderPills() {
  document.querySelectorAll('.provider-pills').forEach(group => initProviderPillsIn(group));
}

function initProviderPillsIn(group) {
  group.querySelectorAll('.provider-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.provider-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      // Update voice selector for audio tab
      if (group.id === 'audioProviders') updateVoiceSelect();
    });
  });
}

function getActiveProvider(groupId) {
  return document.querySelector(`#${groupId} .provider-pill.active`)?.dataset.provider || '';
}

// === IMAGE SETTINGS ===
function initImageSettings() {
  document.querySelectorAll('.ratio-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelectorAll('.qty-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.getElementById('seedToggle').addEventListener('click', function() {
    this.classList.toggle('locked');
    if (this.classList.contains('locked')) {
      this.dataset.seed = Math.floor(Math.random() * 999999999);
      this.querySelector('span').textContent = '#' + this.dataset.seed;
    } else {
      delete this.dataset.seed;
      this.querySelector('span').textContent = 'Random';
    }
  });
}

// === GEMINI API CALLS ===
async function callGemini(prompt) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) { openApiKeyModal(); return null; }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 65536 }
      })
    }
  );

  if (!response.ok) {
    if ([400, 401, 403].includes(response.status)) {
      localStorage.removeItem('gemini_api_key');
      openApiKeyModal();
      throw new Error('API key invalida. Cole uma nova chave.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Erro ${response.status}`);
  }

  const data = await response.json();
  let text = '';
  const candidate = data.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) text = part.text.trim();
    }
  }
  return text;
}

// === ENHANCE PROMPT (BILINGUAL) ===
async function enhancePromptBilingual(original) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) { openApiKeyModal(); return; }

  const enhanceBtn = document.getElementById('enhanceBtn');
  enhanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  enhanceBtn.disabled = true;

  try {
    const result = await callGemini(
      `INSTRUCAO: Voce vai receber um prompt para geracao de imagem com IA. Faca o seguinte:

1. Melhore o prompt tornando-o mais detalhado e profissional para geracao de imagem.
2. Retorne o resultado em DUAS linguas: Portugues e Ingles.

FORMATO OBRIGATORIO (siga exatamente):
---PT---
(prompt melhorado em portugues aqui)
---EN---
(prompt melhorado em ingles aqui)

NAO escreva explicacoes, NAO escreva introducoes, NAO escreva nada fora do formato acima.

Prompt original: ${original}`
    );

    if (!result) throw new Error('Resposta vazia');

    let ptText = '', enText = '';
    const ptMatch = result.match(/---PT---\s*([\s\S]*?)\s*---EN---/);
    const enMatch = result.match(/---EN---\s*([\s\S]*?)$/);
    if (ptMatch) ptText = ptMatch[1].trim();
    if (enMatch) enText = enMatch[1].trim();
    if (!ptText && !enText) { ptText = result; enText = result; }

    document.getElementById('promptPT').value = ptText;
    document.getElementById('promptEN').value = enText;
    document.getElementById('bilingualArea').style.display = 'block';
    document.getElementById('syncStatus').innerHTML = '<i class="fas fa-check"></i> Sincronizado';
    document.getElementById('promptInput').value = enText;
    showToast('Prompt melhorado em PT e EN!', 'success');
  } catch (error) {
    console.error('Gemini error:', error);
    showToast(error.message || 'Erro ao melhorar prompt', 'error');
  } finally {
    enhanceBtn.innerHTML = '<i class="fas fa-magic"></i>';
    enhanceBtn.disabled = false;
  }
}

async function syncPTtoEN() {
  const ptText = document.getElementById('promptPT').value.trim();
  if (!ptText) return;
  const syncStatus = document.getElementById('syncStatus');
  syncStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
  syncStatus.className = 'bilingual-sync syncing';
  try {
    const enText = await callGemini(
      `INSTRUCAO: Traduza o texto abaixo para ingles. Este e um prompt para geracao de imagem com IA. Retorne SOMENTE a traducao, nada mais.\n\nTexto: ${ptText}`
    );
    if (enText) {
      document.getElementById('promptEN').value = enText;
      document.getElementById('promptInput').value = enText;
      syncStatus.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
      syncStatus.className = 'bilingual-sync';
    }
  } catch (error) {
    syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro';
    syncStatus.className = 'bilingual-sync';
  }
}

// =============================================
// === IMAGE GENERATION ===
// =============================================
const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
  'nano-banana-pro-preview',
  'gemini-2.5-flash-image'
];

async function startImageGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Escreva um prompt para gerar', 'error'); return; }

  const provider = getActiveProvider('imageProviders');
  const activeRatio = document.querySelector('.ratio-pill.active');
  const ratio = activeRatio?.dataset.ratio || '1:1';
  const w = parseInt(activeRatio?.dataset.w || 1024);
  const h = parseInt(activeRatio?.dataset.h || 1024);
  const qty = parseInt(document.querySelector('.qty-pill.active')?.dataset.qty || 1);
  const seed = document.getElementById('seedToggle').dataset.seed;

  // Check if Gemini key needed
  if (provider.startsWith('gemini') || provider === 'nano-banana-pro-preview') {
    if (!localStorage.getItem('gemini_api_key')) {
      openApiKeyModal();
      showToast('Configure sua API key do Gemini primeiro', 'error');
      return;
    }
  }

  // Show loading
  document.getElementById('displayEmpty').style.display = 'none';
  document.getElementById('displayResults').style.display = 'none';
  document.getElementById('displayLoading').style.display = 'block';
  setButtonLoading('generateBtnMain', true, 'Gerando...');

  const grid = document.getElementById('resultsMasonry');
  let success = 0;

  for (let i = 0; i < qty; i++) {
    const card = document.createElement('div');
    card.className = 'result-card loading';
    card.innerHTML = `<div class="card-loading-state"><div class="spinner-ring small"></div><span>Gerando ${i + 1}/${qty}...</span></div>`;
    grid.insertBefore(card, grid.firstChild);
    document.getElementById('displayLoading').style.display = 'none';
    document.getElementById('displayResults').style.display = 'block';

    let imageResult = null;

    if (provider.startsWith('pollinations')) {
      imageResult = await generateWithPollinations(prompt, provider, w, h, seed, i);
    } else if (provider === 'gemini-auto') {
      imageResult = await generateWithGemini(prompt, ratio, i, null);
    } else {
      imageResult = await generateWithGemini(prompt, ratio, i, provider);
    }

    if (imageResult) {
      success++;
      const imgSrc = imageResult.url || base64ToBlobUrl(imageResult.base64, imageResult.mimeType);
      card.classList.remove('loading');
      card.innerHTML = `
        <img src="${imgSrc}" alt="Generated" crossorigin="anonymous">
        <div class="result-card-overlay">
          <button title="Download" onclick="event.stopPropagation(); downloadImage('${imgSrc}', 'ai-image-${Date.now()}.png')"><i class="fas fa-download"></i></button>
          <button title="Favoritar" onclick="event.stopPropagation(); this.style.color='var(--accent)'"><i class="fas fa-heart"></i></button>
        </div>
        <div class="result-card-provider">${provider}</div>
      `;
      card.addEventListener('click', () => openLightbox(imgSrc, prompt, ratio));
    } else {
      card.classList.remove('loading');
      card.innerHTML = `<div class="card-error-state"><i class="fas fa-exclamation-triangle"></i><span>Erro - tente novamente</span></div>`;
    }

    if (i < qty - 1) await delay(1500);
  }

  setButtonLoading('generateBtnMain', false, 'Gerar');
  if (success > 0) showToast(`${success} imagem(ns) gerada(s)!`, 'success');
  else showToast('Erro ao gerar. Tente outro provedor.', 'error');
}

// --- Pollinations Image ---
async function generateWithPollinations(prompt, provider, w, h, seed, variation) {
  const modelMap = {
    'pollinations-flux': 'flux',
    'pollinations-turbo': 'turbo',
    'pollinations-sd': 'stable-diffusion'
  };
  const model = modelMap[provider] || 'flux';
  const seedParam = seed || (Date.now() + variation);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=${w}&height=${h}&seed=${seedParam}&nologo=true`;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ url });
    img.onerror = () => {
      console.warn(`Pollinations ${model} failed`);
      resolve(null);
    };
    img.src = url;
    // Timeout after 60s
    setTimeout(() => { if (!img.complete) resolve(null); }, 60000);
  });
}

// --- Gemini Image ---
async function generateWithGemini(prompt, ratio, variation, specificModel) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) return null;

  const ratioText = ratio !== '1:1' ? ` The image should have a ${ratio} aspect ratio.` : '';
  const variationText = variation > 0 ? ` Create a unique variation #${variation + 1}.` : '';
  const fullPrompt = `Generate an image: ${prompt}${ratioText}${variationText}`;
  const modelsToTry = specificModel ? [specificModel] : GEMINI_IMAGE_MODELS;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await delay(10000 * attempt);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 1.0 }
            })
          }
        );

        if (response.status === 429) {
          if (attempt < 2) continue;
          break;
        }
        if (!response.ok) break;

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
          }
        }
        break;
      } catch (e) { break; }
    }
  }
  return null;
}

// =============================================
// === VIDEO GENERATION ===
// =============================================
async function startVideoGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Escreva um prompt para o video', 'error'); return; }

  setButtonLoading('generateVideoBtn', true, 'Gerando...');
  showToast('Gerando video com Pollinations... isso pode levar alguns minutos', 'success');

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const videoUrl = `https://video.pollinations.ai/prompt/${encodedPrompt}?model=seedance`;

    const videoContainer = document.getElementById('videoResults');
    const videoGrid = document.getElementById('videoMasonry');
    document.querySelector('#tabVideo .display-empty').style.display = 'none';
    videoContainer.style.display = 'block';

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <video controls autoplay style="width:100%; border-radius: var(--radius-lg);">
        <source src="${videoUrl}" type="video/mp4">
        Seu navegador nao suporta video.
      </video>
      <div class="result-card-provider">Pollinations Seedance</div>
    `;
    videoGrid.insertBefore(card, videoGrid.firstChild);
    showToast('Video gerado!', 'success');
  } catch (e) {
    showToast('Erro ao gerar video: ' + e.message, 'error');
  } finally {
    setButtonLoading('generateVideoBtn', false, 'Gerar Video');
  }
}

// =============================================
// === AUDIO - TTS & TRANSCRIPTION ===
// =============================================
let speechRecognition = null;
let isRecording = false;

function initAudio() {
  updateVoiceSelect();
  // Load browser voices when available
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = updateVoiceSelect;
  }
}

function updateVoiceSelect() {
  const provider = getActiveProvider('audioProviders');
  const select = document.getElementById('voiceSelect');
  select.innerHTML = '';

  if (provider === 'browser-tts') {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length === 0) {
      select.innerHTML = '<option value="default">Voz Padrao</option>';
    } else {
      voices.forEach((v, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${v.name} (${v.lang})`;
        select.appendChild(opt);
      });
    }
  } else if (provider === 'pollinations-tts') {
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      select.appendChild(opt);
    });
  }
}

async function startTTS() {
  const text = document.getElementById('promptInput').value.trim();
  if (!text) { showToast('Digite texto para converter em audio', 'error'); return; }

  const provider = getActiveProvider('audioProviders');
  setButtonLoading('generateAudioBtn', true, 'Gerando...');

  try {
    if (provider === 'browser-tts') {
      await browserTTS(text);
    } else if (provider === 'pollinations-tts') {
      await pollinationsTTS(text);
    }
  } catch (e) {
    showToast('Erro TTS: ' + e.message, 'error');
  } finally {
    setButtonLoading('generateAudioBtn', false, 'Falar');
  }
}

function browserTTS(text) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) { reject(new Error('Seu navegador nao suporta TTS')); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const voiceIdx = document.getElementById('voiceSelect').value;
    if (voiceIdx !== 'default' && voices[voiceIdx]) {
      utterance.voice = voices[voiceIdx];
    }
    utterance.onend = () => { showToast('Audio reproduzido!', 'success'); resolve(); };
    utterance.onerror = (e) => reject(new Error(e.error));
    speechSynthesis.speak(utterance);

    // Show player area with note
    const playerArea = document.getElementById('ttsPlayerArea');
    playerArea.style.display = 'block';
    playerArea.innerHTML = '<div class="audio-playing-indicator"><i class="fas fa-volume-up fa-beat-fade"></i> Reproduzindo via Browser Nativo...</div>';
    document.querySelector('#audioTTS .audio-empty-state').style.display = 'none';
  });
}

async function pollinationsTTS(text) {
  const voice = document.getElementById('voiceSelect').value || 'alloy';
  const encodedText = encodeURIComponent(text);
  const url = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=${voice}`;

  showToast('Gerando audio com Pollinations...', 'success');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);

  const playerArea = document.getElementById('ttsPlayerArea');
  playerArea.style.display = 'block';
  document.querySelector('#audioTTS .audio-empty-state').style.display = 'none';

  const player = document.getElementById('ttsAudioPlayer');
  player.src = audioUrl;
  player.style.display = 'block';

  const downloadBtn = document.getElementById('ttsDownloadBtn');
  downloadBtn.style.display = '';
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts-${Date.now()}.mp3`;
    a.click();
    showToast('Download iniciado!', 'success');
  };

  playerArea.innerHTML = '';
  playerArea.appendChild(player);
  playerArea.appendChild(downloadBtn);
  player.play();
  showToast('Audio gerado com Pollinations!', 'success');
}

// --- Transcription ---
function startTranscription() {
  const provider = getActiveProvider('audioProviders');

  if (provider === 'browser-stt') {
    browserSTT();
  } else if (provider === 'pollinations-stt') {
    pollinationsSTT();
  }
}

function browserSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Seu navegador nao suporta reconhecimento de voz', 'error');
    return;
  }

  const recordBtn = document.getElementById('recordBtn');

  if (isRecording && speechRecognition) {
    speechRecognition.stop();
    isRecording = false;
    recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
    recordBtn.classList.remove('recording');
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'pt-BR';
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;

  let finalTranscript = '';

  speechRecognition.onstart = () => {
    isRecording = true;
    recordBtn.innerHTML = '<i class="fas fa-stop"></i> <span>Parar</span>';
    recordBtn.classList.add('recording');
    showToast('Gravando... fale agora', 'success');
  };

  speechRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    document.getElementById('transcriptionResult').style.display = 'block';
    document.querySelector('#audioTranscribe .audio-empty-state').style.display = 'none';
    document.getElementById('transcriptionText').innerHTML =
      finalTranscript + '<span style="color: var(--text-muted);">' + interim + '</span>';
  };

  speechRecognition.onerror = (e) => {
    showToast('Erro: ' + e.error, 'error');
    isRecording = false;
    recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
    recordBtn.classList.remove('recording');
  };

  speechRecognition.onend = () => {
    isRecording = false;
    recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
    recordBtn.classList.remove('recording');
    if (finalTranscript.trim()) showToast('Transcricao concluida!', 'success');
  };

  speechRecognition.start();
}

async function pollinationsSTT() {
  showToast('Gravando audio para Pollinations STT...', 'success');
  const recordBtn = document.getElementById('recordBtn');

  if (isRecording) {
    isRecording = false;
    recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
    recordBtn.classList.remove('recording');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          const response = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'openai-audio',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: 'Transcribe this audio to text. Return ONLY the transcription.' },
                  { type: 'input_audio', input_audio: { data: base64, format: 'webm' } }
                ]
              }]
            })
          });
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || 'Nenhum texto detectado';
          document.getElementById('transcriptionResult').style.display = 'block';
          document.querySelector('#audioTranscribe .audio-empty-state').style.display = 'none';
          document.getElementById('transcriptionText').textContent = text;
          showToast('Transcricao concluida!', 'success');
        } catch (e) {
          showToast('Erro na transcricao: ' + e.message, 'error');
        }
      };
      reader.readAsDataURL(blob);
    };

    isRecording = true;
    recordBtn.innerHTML = '<i class="fas fa-stop"></i> <span>Parar</span>';
    recordBtn.classList.add('recording');
    mediaRecorder.start();

    // Auto-stop after 30 seconds
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
        recordBtn.classList.remove('recording');
      }
    }, 30000);

    // Store reference so we can stop it
    recordBtn.onclick = () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
        recordBtn.classList.remove('recording');
      }
    };
  } catch (e) {
    showToast('Erro ao acessar microfone: ' + e.message, 'error');
  }
}

function copyTranscription() {
  const text = document.getElementById('transcriptionText').textContent;
  navigator.clipboard.writeText(text);
  showToast('Texto copiado!', 'success');
}

// =============================================
// === TEXT GENERATION ===
// =============================================
async function startTextGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Digite um prompt para gerar texto', 'error'); return; }

  const provider = getActiveProvider('textProviders');
  setButtonLoading('generateTextBtn', true, 'Gerando...');

  try {
    let result = '';
    let providerName = '';

    if (provider === 'gemini-text') {
      if (!localStorage.getItem('gemini_api_key')) { openApiKeyModal(); return; }
      result = await callGemini(prompt);
      providerName = 'Gemini 2.5 Pro';
    } else if (provider === 'pollinations-text-openai') {
      result = await pollinationsText(prompt, 'openai');
      providerName = 'Pollinations (OpenAI)';
    } else if (provider === 'pollinations-text-mistral') {
      result = await pollinationsText(prompt, 'mistral');
      providerName = 'Pollinations (Mistral)';
    } else if (provider === 'openrouter-text') {
      const key = localStorage.getItem('openrouter_api_key');
      if (!key) { openApiKeyModal(); showToast('Configure sua API key do OpenRouter', 'error'); return; }
      result = await openRouterText(prompt, key);
      providerName = 'OpenRouter Free';
    }

    if (result) {
      document.querySelector('#tabText .display-empty')?.parentElement &&
        (document.getElementById('textOutputArea').style.display = 'none');
      document.getElementById('textResultArea').style.display = 'block';
      document.getElementById('textProviderUsed').textContent = providerName;
      document.getElementById('textResultContent').textContent = result;
      showToast('Texto gerado!', 'success');
    }
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  } finally {
    setButtonLoading('generateTextBtn', false, 'Gerar Texto');
  }
}

async function pollinationsText(prompt, model) {
  const response = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function openRouterText(prompt, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'AI Performance Studio'
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function copyTextResult() {
  const text = document.getElementById('textResultContent').textContent;
  navigator.clipboard.writeText(text);
  showToast('Texto copiado!', 'success');
}

// =============================================
// === UTILITIES ===
// =============================================
function base64ToBlobUrl(base64, mimeType) {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  return URL.createObjectURL(new Blob([byteArray], { type: mimeType }));
}

function downloadImage(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Download iniciado!', 'success');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function setButtonLoading(id, loading, text) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${text}</span>`;
  } else {
    const icon = id.includes('Video') ? 'fa-bolt' : id.includes('Audio') ? 'fa-play' : id.includes('Text') ? 'fa-bolt' : 'fa-bolt';
    btn.innerHTML = `<i class="fas ${icon}"></i> <span>${text}</span>`;
  }
}

// === LIGHTBOX ===
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
}

function openLightbox(src, prompt, ratio) {
  const lightbox = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxInfo').innerHTML = `<p><strong>Prompt:</strong> ${prompt}</p><p><strong>Ratio:</strong> ${ratio}</p>`;
  document.getElementById('lightboxDownload').onclick = () => downloadImage(src, `ai-image-${Date.now()}.png`);
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// === KEYBOARD SHORTCUTS ===
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleGenerate(); }
    if (e.ctrlKey && e.key === '/') { e.preventDefault(); document.getElementById('promptInput').focus(); }
  });
}

// === API KEY MODAL ===
function initApiKeyModal() {
  const modal = document.createElement('div');
  modal.id = 'apiKeyModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3><i class="fas fa-key" style="color: var(--accent); margin-right: 8px;"></i>Configurar API Keys</h3>
        <button class="btn-tiny" onclick="closeApiKeyModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 14px;">
          APIs com <span class="dot free" style="display:inline-block;"></span> <strong>verde</strong> nao precisam de key.
          APIs com <span class="dot key" style="display:inline-block;"></span> <strong>amarelo</strong> precisam de key gratuita.
        </p>

        <div class="setting-group">
          <label><i class="fas fa-robot" style="color: #4285f4;"></i> Gemini API Key <span style="color:var(--text-muted);">(Imagem + Texto + Melhorar)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="geminiKeyInput" placeholder="Cole sua API key do Gemini...">
            <button class="btn-tiny" id="toggleGeminiKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://aistudio.google.com/apikey" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-route" style="color: #a855f7;"></i> OpenRouter API Key <span style="color:var(--text-muted);">(Texto - modelos gratis)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="openrouterKeyInput" placeholder="Cole sua API key do OpenRouter...">
            <button class="btn-tiny" id="toggleOpenrouterKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://openrouter.ai/keys" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div style="margin-top: 10px; padding: 8px 10px; background: var(--accent-subtle); border-radius: var(--radius-md); font-size: 0.75rem; color: var(--text-secondary);">
          <i class="fas fa-shield-halved" style="color: var(--accent);"></i>
          Suas chaves ficam salvas apenas no seu navegador.
          <br><strong>Pollinations.ai</strong> (imagem, video, audio, texto) funciona sem nenhuma key.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeApiKeyModal()">Cancelar</button>
        <button class="btn-primary" id="saveApiKeysBtn"><i class="fas fa-check"></i> Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('saveApiKeysBtn').addEventListener('click', () => {
    const geminiKey = document.getElementById('geminiKeyInput').value.trim();
    const openrouterKey = document.getElementById('openrouterKeyInput').value.trim();
    if (geminiKey) localStorage.setItem('gemini_api_key', geminiKey);
    if (openrouterKey) localStorage.setItem('openrouter_api_key', openrouterKey);
    closeApiKeyModal();
    showToast('API keys salvas!', 'success');
    updateApiKeyStatus();
  });

  // Toggle visibility
  document.getElementById('toggleGeminiKey').addEventListener('click', () => {
    const input = document.getElementById('geminiKeyInput');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('toggleOpenrouterKey').addEventListener('click', () => {
    const input = document.getElementById('openrouterKeyInput');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  updateApiKeyStatus();
}

function openApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  document.getElementById('geminiKeyInput').value = localStorage.getItem('gemini_api_key') || '';
  document.getElementById('openrouterKeyInput').value = localStorage.getItem('openrouter_api_key') || '';
  modal.classList.add('open');
}

function closeApiKeyModal() {
  document.getElementById('apiKeyModal').classList.remove('open');
  updateApiKeyStatus();
}

function updateApiKeyStatus() {
  const hasGemini = !!localStorage.getItem('gemini_api_key');
  const hasOpenRouter = !!localStorage.getItem('openrouter_api_key');
  const display = document.getElementById('creditsDisplay');
  if (hasGemini || hasOpenRouter) {
    const parts = [];
    if (hasGemini) parts.push('Gemini');
    if (hasOpenRouter) parts.push('OpenRouter');
    display.innerHTML = `<i class="fas fa-check-circle" style="color: var(--green);"></i> <span>${parts.join(' + ')} conectado</span>`;
  } else {
    display.innerHTML = '<i class="fas fa-key"></i> <span>Configurar APIs</span>';
  }
  display.onclick = openApiKeyModal;
}

// === TOAST ===
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
