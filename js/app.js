// === AI Performance Studio - Main Application ===

let currentTab = 'image';
let syncTimeout = null;

// === USER-SCOPED API KEY STORAGE ===
const API_KEY_NAMES = [
  'gemini_api_key', 'openrouter_api_key', 'groq_api_key',
  'together_api_key', 'huggingface_api_key', 'pexels_api_key'
];

function getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('google_user') || 'null');
    return user?.sub || null;
  } catch(e) { return null; }
}

function getApiKey(keyName) {
  const uid = getUserId();
  if (!uid) return '';
  return localStorage.getItem(`user_${uid}_${keyName}`) || '';
}

function setApiKey(keyName, value) {
  const uid = getUserId();
  if (!uid) return;
  if (value) {
    localStorage.setItem(`user_${uid}_${keyName}`, value);
  } else {
    localStorage.removeItem(`user_${uid}_${keyName}`);
  }
}

function clearActiveApiKeys() {
  // Keys are stored per-user, nothing to clear globally
  // Just update UI
  updateApiKeyStatus();
}

function loadUserApiKeys() {
  // Just update UI - keys are read on-demand via getApiKey()
  updateApiKeyStatus();
}

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
  initMoodboard();
  initGoogleAuth();
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
  // Hide bottom bar for non-generation tabs
  const bottomBar = document.querySelector('.bottom-bar');
  if (['moodboard', 'gallery', 'history'].includes(tab)) {
    bottomBar.style.display = 'none';
  } else {
    bottomBar.style.display = '';
  }
}

function showTTSProviders() {
  const pills = document.getElementById('audioProviders');
  pills.innerHTML = `
    <div class="provider-group">
      <button class="provider-group-btn active" data-default="browser-tts"><span class="dot free"></span> Browser <i class="fas fa-chevron-down"></i></button>
      <div class="provider-dropdown">
        <button class="provider-drop-item active" data-provider="browser-tts"><span class="dot free"></span> Nativo TTS</button>
      </div>
    </div>
    <div class="provider-group">
      <button class="provider-group-btn" data-default="pollinations-tts"><span class="dot free"></span> Pollinations <i class="fas fa-chevron-down"></i></button>
      <div class="provider-dropdown">
        <button class="provider-drop-item" data-provider="pollinations-tts"><span class="dot free"></span> TTS Premium</button>
      </div>
    </div>
    <div class="provider-group">
      <button class="provider-group-btn" data-default="hf-tts-speecht5"><span class="dot key"></span> HuggingFace <i class="fas fa-chevron-down"></i></button>
      <div class="provider-dropdown">
        <button class="provider-drop-item" data-provider="hf-tts-speecht5"><span class="dot key"></span> SpeechT5</button>
        <button class="provider-drop-item" data-provider="hf-tts-bark"><span class="dot key"></span> Bark</button>
      </div>
    </div>
  `;
  document.getElementById('voiceSelector').style.display = '';
  initProviderPillsIn(pills);
  updateVoiceSelect();
}

function showSTTProviders() {
  const pills = document.getElementById('audioProviders');
  pills.innerHTML = `
    <div class="provider-group">
      <button class="provider-group-btn active" data-default="browser-stt"><span class="dot free"></span> Browser <i class="fas fa-chevron-down"></i></button>
      <div class="provider-dropdown">
        <button class="provider-drop-item active" data-provider="browser-stt"><span class="dot free"></span> Nativo STT</button>
      </div>
    </div>
    <div class="provider-group">
      <button class="provider-group-btn" data-default="pollinations-stt"><span class="dot free"></span> Pollinations <i class="fas fa-chevron-down"></i></button>
      <div class="provider-dropdown">
        <button class="provider-drop-item" data-provider="pollinations-stt"><span class="dot free"></span> STT</button>
      </div>
    </div>
    <div class="provider-group">
      <button class="provider-group-btn" data-default="hf-stt-whisper"><span class="dot key"></span> HuggingFace <i class="fas fa-chevron-down"></i></button>
      <div class="provider-dropdown">
        <button class="provider-drop-item" data-provider="hf-stt-whisper"><span class="dot key"></span> Whisper</button>
      </div>
    </div>
  `;
  document.getElementById('voiceSelector').style.display = 'none';
  initProviderPillsIn(pills);
}

// === SIDEBAR ===
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  if (!menuToggle || !sidebarClose) return; // No sidebar in full layout

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

// === PROVIDER PILLS & DROPDOWN GROUPS ===
function initProviderPills() {
  document.querySelectorAll('.provider-pills').forEach(group => initProviderPillsIn(group));
}

function initProviderPillsIn(group) {
  // Old flat pills (legacy support for dynamic audio pills)
  group.querySelectorAll('.provider-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.provider-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (group.id === 'audioProviders') updateVoiceSelect();
    });
  });

  // New dropdown group system
  group.querySelectorAll('.provider-group').forEach(provGroup => {
    const groupBtn = provGroup.querySelector('.provider-group-btn');

    groupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = provGroup.classList.contains('open');
      closeDropdownPopup();
      if (!wasOpen) {
        showDropdownPopup(groupBtn, provGroup, group);
      }
      // Activate this group
      group.querySelectorAll('.provider-group-btn').forEach(b => b.classList.remove('active'));
      groupBtn.classList.add('active');
      if (group.id === 'audioProviders') updateVoiceSelect();
    });
  });
}

function getActiveProvider(groupId) {
  const container = document.getElementById(groupId);
  // Check new dropdown system first
  const activeGroup = container?.querySelector('.provider-group-btn.active');
  if (activeGroup) {
    // Find the active item within that group's dropdown
    const group = activeGroup.closest('.provider-group');
    const activeItem = group?.querySelector('.provider-drop-item.active');
    return activeItem?.dataset.provider || activeGroup.dataset.default || '';
  }
  // Fallback to old flat pills
  return container?.querySelector('.provider-pill.active')?.dataset.provider || '';
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
const GEMINI_TEXT_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

async function callGemini(prompt) {
  const apiKey = getApiKey('gemini_api_key');
  if (!apiKey) { openApiKeyModal(); return null; }

  for (const model of GEMINI_TEXT_FALLBACK_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
          setApiKey('gemini_api_key', '');
          openApiKeyModal();
          throw new Error('API key invalida. Cole uma nova chave.');
        }
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || '';
        // If quota exceeded, try next model
        if (response.status === 429 || errMsg.toLowerCase().includes('quota')) {
          console.warn(`Quota exceeded for ${model}, trying next...`);
          continue;
        }
        throw new Error(errMsg || `Erro ${response.status}`);
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
    } catch (err) {
      // If it's an auth error, don't retry
      if (err.message.includes('invalida')) throw err;
      console.warn(`callGemini failed with ${model}:`, err.message);
      continue;
    }
  }
  throw new Error('Todos os modelos Gemini estao com quota esgotada. Tente novamente mais tarde.');
}

// === ENHANCE PROMPT (BILINGUAL) ===
async function enhancePromptBilingual(original) {
  const apiKey = getApiKey('gemini_api_key');
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

  // Check if API key is needed
  if (provider.startsWith('gemini') || provider === 'nano-banana-pro-preview') {
    if (!getApiKey('gemini_api_key')) {
      openApiKeyModal();
      showToast('Configure sua API key do Gemini primeiro', 'error');
      return;
    }
  }
  if (provider.startsWith('together-')) {
    if (!getApiKey('together_api_key')) {
      openApiKeyModal();
      showToast('Configure sua API key do Together AI primeiro', 'error');
      return;
    }
  }
  if (provider.startsWith('hf-')) {
    if (!getApiKey('huggingface_api_key')) {
      openApiKeyModal();
      showToast('Configure sua API key do HuggingFace primeiro', 'error');
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
    } else if (provider.startsWith('together-')) {
      imageResult = await generateWithTogether(prompt, provider, w, h, seed, i);
    } else if (provider.startsWith('hf-')) {
      imageResult = await generateWithHuggingFace(prompt, provider, w, h);
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
    'pollinations-flux-realism': 'flux-realism',
    'pollinations-flux-anime': 'flux-anime',
    'pollinations-flux-3d': 'flux-3d',
    'pollinations-flux-cablyai': 'flux-cablyai',
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
  const apiKey = getApiKey('gemini_api_key');
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

// --- Together AI Image ---
const TOGETHER_IMAGE_MODELS = {
  'together-flux-schnell': 'black-forest-labs/FLUX.1-schnell-Free',
  'together-flux-dev': 'black-forest-labs/FLUX.1-dev'
};

async function generateWithTogether(prompt, provider, w, h, seed, variation) {
  const apiKey = getApiKey('together_api_key');
  if (!apiKey) return null;
  const model = TOGETHER_IMAGE_MODELS[provider] || 'black-forest-labs/FLUX.1-schnell-Free';
  const steps = model.includes('schnell') ? 4 : 20;

  try {
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        width: w,
        height: h,
        steps: steps,
        n: 1,
        seed: seed ? parseInt(seed) + variation : undefined,
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return { base64: b64, mimeType: 'image/png' };
    return null;
  } catch (e) {
    console.warn('Together AI error:', e);
    return null;
  }
}

// --- HuggingFace Image ---
const HF_IMAGE_MODELS = {
  'hf-flux-dev': 'black-forest-labs/FLUX.1-dev',
  'hf-sdxl': 'stabilityai/stable-diffusion-xl-base-1.0',
  'hf-sd35': 'stabilityai/stable-diffusion-3.5-large',
  'hf-openjourney': 'prompthero/openjourney-v4',
  'hf-realistic-vision': 'SG161222/Realistic_Vision_V5.1_noVAE',
  'hf-sd15': 'runwayml/stable-diffusion-v1-5'
};

async function generateWithHuggingFace(prompt, provider, w, h) {
  const apiKey = getApiKey('huggingface_api_key');
  if (!apiKey) return null;
  const model = HF_IMAGE_MODELS[provider] || 'black-forest-labs/FLUX.1-dev';

  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width: w, height: h }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return { url };
  } catch (e) {
    console.warn('HuggingFace error:', e);
    return null;
  }
}

// --- Groq Text ---
async function groqText(prompt, apiKey, model) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// =============================================
// === VIDEO GENERATION ===
// =============================================
const POLLINATIONS_VIDEO_MODELS = {
  'pollinations-video-seedance': 'seedance',
  'pollinations-video-hunyuan': 'hunyuan',
  'pollinations-video-wan': 'wan-2.1'
};

async function startVideoGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Escreva um prompt para o video', 'error'); return; }

  const provider = getActiveProvider('videoProviders');
  setButtonLoading('generateVideoBtn', true, 'Gerando...');

  // HuggingFace video
  if (provider === 'hf-video') {
    if (!getApiKey('huggingface_api_key')) {
      openApiKeyModal();
      showToast('Configure sua API key do HuggingFace primeiro', 'error');
      setButtonLoading('generateVideoBtn', false, 'Gerar Video');
      return;
    }
    await generateVideoHuggingFace(prompt);
    setButtonLoading('generateVideoBtn', false, 'Gerar Video');
    return;
  }

  // Pollinations video
  const model = POLLINATIONS_VIDEO_MODELS[provider] || 'seedance';
  showToast(`Gerando video com ${model}... isso pode levar alguns minutos`, 'success');

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const videoUrl = `https://video.pollinations.ai/prompt/${encodedPrompt}?model=${model}`;

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
      <div class="result-card-provider">Pollinations ${model}</div>
    `;
    videoGrid.insertBefore(card, videoGrid.firstChild);
    showToast('Video gerado!', 'success');
  } catch (e) {
    showToast('Erro ao gerar video: ' + e.message, 'error');
  } finally {
    setButtonLoading('generateVideoBtn', false, 'Gerar Video');
  }
}

async function generateVideoHuggingFace(prompt) {
  const apiKey = getApiKey('huggingface_api_key');
  showToast('Gerando video com AnimateDiff... pode demorar', 'success');
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/ByteDance/AnimateDiff-Lightning', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const videoUrl = URL.createObjectURL(blob);

    const videoContainer = document.getElementById('videoResults');
    const videoGrid = document.getElementById('videoMasonry');
    document.querySelector('#tabVideo .display-empty').style.display = 'none';
    videoContainer.style.display = 'block';

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <video controls autoplay loop style="width:100%; border-radius: var(--radius-lg);">
        <source src="${videoUrl}" type="video/mp4">
      </video>
      <div class="result-card-provider">HuggingFace AnimateDiff</div>
    `;
    videoGrid.insertBefore(card, videoGrid.firstChild);
    showToast('Video gerado!', 'success');
  } catch (e) {
    showToast('Erro ao gerar video: ' + e.message, 'error');
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
  } else if (provider.startsWith('hf-tts')) {
    select.innerHTML = '<option value="default">Voz Padrao</option>';
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
    } else if (provider === 'hf-tts-speecht5') {
      await huggingFaceTTS(text, 'microsoft/speecht5_tts');
    } else if (provider === 'hf-tts-bark') {
      await huggingFaceTTS(text, 'suno/bark-small');
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

// --- HuggingFace TTS ---
async function huggingFaceTTS(text, model) {
  const apiKey = getApiKey('huggingface_api_key');
  if (!apiKey) { openApiKeyModal(); throw new Error('Configure API key do HuggingFace'); }

  showToast(`Gerando audio com ${model.split('/')[1]}...`, 'success');

  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ inputs: text })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

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
    a.download = `tts-hf-${Date.now()}.wav`;
    a.click();
    showToast('Download iniciado!', 'success');
  };

  playerArea.innerHTML = '';
  playerArea.appendChild(player);
  playerArea.appendChild(downloadBtn);
  player.play();
  showToast(`Audio gerado com ${model.split('/')[1]}!`, 'success');
}

// --- Transcription ---
function startTranscription() {
  const provider = getActiveProvider('audioProviders');

  if (provider === 'browser-stt') {
    browserSTT();
  } else if (provider === 'pollinations-stt') {
    pollinationsSTT();
  } else if (provider === 'hf-stt-whisper') {
    huggingFaceSTT();
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

async function huggingFaceSTT() {
  const apiKey = getApiKey('huggingface_api_key');
  if (!apiKey) { openApiKeyModal(); showToast('Configure API key do HuggingFace', 'error'); return; }

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
      showToast('Transcrevendo com Whisper...', 'success');

      try {
        const response = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: blob
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.text || 'Nenhum texto detectado';
        document.getElementById('transcriptionResult').style.display = 'block';
        document.querySelector('#audioTranscribe .audio-empty-state').style.display = 'none';
        document.getElementById('transcriptionText').textContent = text;
        showToast('Transcricao concluida com Whisper!', 'success');
      } catch (e) {
        showToast('Erro na transcricao: ' + e.message, 'error');
      }
    };

    isRecording = true;
    recordBtn.innerHTML = '<i class="fas fa-stop"></i> <span>Parar</span>';
    recordBtn.classList.add('recording');
    mediaRecorder.start();
    showToast('Gravando... fale agora (max 30s)', 'success');

    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Gravar</span>';
        recordBtn.classList.remove('recording');
      }
    }, 30000);

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
// Gemini text models map
const GEMINI_TEXT_MODELS = {
  'gemini-text-2.5-pro': { model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  'gemini-text-2.5-flash': { model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  'gemini-text-2.0-flash': { model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  'gemini-text-2.0-flash-lite': { model: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
  'gemini-text-1.5-pro': { model: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  'gemini-text-1.5-flash': { model: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
};

// Groq text models map
const GROQ_TEXT_MODELS = {
  'groq-text-llama33-70b': { model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B' },
  'groq-text-llama31-8b': { model: 'llama-3.1-8b-instant', name: 'Groq Llama 3.1 8B' },
  'groq-text-llama3-70b': { model: 'llama3-70b-8192', name: 'Groq Llama 3 70B' },
  'groq-text-llama3-8b': { model: 'llama3-8b-8192', name: 'Groq Llama 3 8B' },
  'groq-text-mixtral': { model: 'mixtral-8x7b-32768', name: 'Groq Mixtral 8x7B' },
  'groq-text-gemma2': { model: 'gemma2-9b-it', name: 'Groq Gemma 2 9B' },
  'groq-text-deepseek-r1': { model: 'deepseek-r1-distill-llama-70b', name: 'Groq DeepSeek R1 70B' },
  'groq-text-qwen-qwq': { model: 'qwen-qwq-32b', name: 'Groq Qwen QwQ 32B' }
};

// Pollinations text models map
const POLLINATIONS_TEXT_MODELS = {
  'pollinations-text-openai': { model: 'openai', name: 'Pollinations GPT-4o Mini' },
  'pollinations-text-mistral': { model: 'mistral', name: 'Pollinations Mistral' },
  'pollinations-text-mistral-large': { model: 'mistral-large', name: 'Pollinations Mistral Large' },
  'pollinations-text-llama': { model: 'llama', name: 'Pollinations Llama 3.3' },
  'pollinations-text-deepseek': { model: 'deepseek', name: 'Pollinations DeepSeek V3' },
  'pollinations-text-deepseek-r1': { model: 'deepseek-r1', name: 'Pollinations DeepSeek R1' },
  'pollinations-text-qwen': { model: 'qwen', name: 'Pollinations Qwen 2.5' },
  'pollinations-text-qwen-coder': { model: 'qwen-coder', name: 'Pollinations Qwen Coder' },
  'pollinations-text-command-r-plus': { model: 'command-r-plus', name: 'Pollinations Command R+' },
  'pollinations-text-phi': { model: 'phi', name: 'Pollinations Phi-4' },
  'pollinations-text-searchgpt': { model: 'searchgpt', name: 'Pollinations SearchGPT' },
  'pollinations-text-unity': { model: 'unity', name: 'Pollinations Unity' },
  'pollinations-text-hormoz': { model: 'hormoz', name: 'Pollinations Hormoz' }
};

// OpenRouter free models map
const OPENROUTER_TEXT_MODELS = {
  'or-gemma2-9b': { model: 'google/gemma-2-9b-it:free', name: 'OpenRouter Gemma 2 9B' },
  'or-llama32-3b': { model: 'meta-llama/llama-3.2-3b-instruct:free', name: 'OpenRouter Llama 3.2 3B' },
  'or-phi3-mini': { model: 'microsoft/phi-3-mini-128k-instruct:free', name: 'OpenRouter Phi-3 Mini' },
  'or-zephyr-7b': { model: 'huggingfaceh4/zephyr-7b-beta:free', name: 'OpenRouter Zephyr 7B' },
  'or-mistral-7b': { model: 'mistralai/mistral-7b-instruct:free', name: 'OpenRouter Mistral 7B' },
  'or-capybara-7b': { model: 'nousresearch/nous-capybara-7b:free', name: 'OpenRouter Capybara 7B' },
  'or-toppy-m-7b': { model: 'undi95/toppy-m-7b:free', name: 'OpenRouter Toppy M 7B' },
  'or-mythomist-7b': { model: 'gryphe/mythomist-7b:free', name: 'OpenRouter MythoMist 7B' }
};

async function startTextGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Digite um prompt para gerar texto', 'error'); return; }

  const provider = getActiveProvider('textProviders');
  setButtonLoading('generateTextBtn', true, 'Gerando...');

  try {
    let result = '';
    let providerName = '';

    if (GEMINI_TEXT_MODELS[provider]) {
      if (!getApiKey('gemini_api_key')) { openApiKeyModal(); return; }
      const cfg = GEMINI_TEXT_MODELS[provider];
      result = await callGeminiModel(prompt, cfg.model);
      providerName = cfg.name;
    } else if (POLLINATIONS_TEXT_MODELS[provider]) {
      const cfg = POLLINATIONS_TEXT_MODELS[provider];
      result = await pollinationsText(prompt, cfg.model);
      providerName = cfg.name;
    } else if (GROQ_TEXT_MODELS[provider]) {
      const key = getApiKey('groq_api_key');
      if (!key) { openApiKeyModal(); showToast('Configure sua API key do Groq', 'error'); return; }
      const cfg = GROQ_TEXT_MODELS[provider];
      result = await groqText(prompt, key, cfg.model);
      providerName = cfg.name;
    } else if (OPENROUTER_TEXT_MODELS[provider]) {
      const key = getApiKey('openrouter_api_key');
      if (!key) { openApiKeyModal(); showToast('Configure sua API key do OpenRouter', 'error'); return; }
      const cfg = OPENROUTER_TEXT_MODELS[provider];
      result = await openRouterText(prompt, key, cfg.model);
      providerName = cfg.name;
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

// Generic Gemini text call with model selector
async function callGeminiModel(prompt, model) {
  const apiKey = getApiKey('gemini_api_key');
  if (!apiKey) { openApiKeyModal(); return null; }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
      setApiKey('gemini_api_key', '');
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

async function openRouterText(prompt, apiKey, model) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'AI Performance Studio'
    },
    body: JSON.stringify({
      model: model || 'openrouter/auto',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }
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
// === DROPDOWN POPUP SYSTEM ===
let activePopup = null;
let activePopupGroup = null;

function showDropdownPopup(btn, provGroup, group) {
  closeDropdownPopup();
  const dropdown = provGroup.querySelector('.provider-dropdown');
  if (!dropdown) return;

  // Create popup element appended to documentElement (html) to escape all clipping
  const popup = document.createElement('div');
  popup.className = 'dropdown-popup';
  popup.innerHTML = dropdown.innerHTML;
  document.documentElement.appendChild(popup);

  // Force critical inline styles so no CSS can hide/clip it
  const rect = btn.getBoundingClientRect();
  const popH = popup.offsetHeight;
  const popW = popup.offsetWidth;
  let top = rect.top - popH - 8;
  let left = rect.left + (rect.width / 2) - (popW / 2);
  if (top < 4) top = rect.bottom + 8;
  if (left < 4) left = 4;
  if (left + popW > window.innerWidth - 4) left = window.innerWidth - popW - 4;

  popup.style.cssText = `
    position: fixed !important;
    top: ${top}px !important;
    left: ${left}px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  `;

  // Add click handlers to popup items
  popup.querySelectorAll('.provider-drop-item').forEach(popItem => {
    popItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const provider = popItem.dataset.provider;
      // Update original dropdown active state
      dropdown.querySelectorAll('.provider-drop-item').forEach(i => i.classList.remove('active'));
      const origItem = dropdown.querySelector(`[data-provider="${provider}"]`);
      if (origItem) origItem.classList.add('active');
      // Update all groups
      group.querySelectorAll('.provider-group-btn').forEach(b => b.classList.remove('active'));
      group.querySelectorAll('.provider-drop-item').forEach(i => i.classList.remove('active'));
      if (origItem) origItem.classList.add('active');
      btn.classList.add('active');
      btn.dataset.default = provider;
      // Update button text
      const dotClass = btn.querySelector('.dot')?.className || 'dot key';
      const modelName = popItem.textContent.trim();
      btn.innerHTML = `<span class="${dotClass}"></span> ${modelName} <i class="fas fa-chevron-down"></i>`;
      closeDropdownPopup();
      if (group.id === 'audioProviders') updateVoiceSelect();
    });
  });

  activePopup = popup;
  activePopupGroup = provGroup;
  provGroup.classList.add('open');

  // Prevent popup clicks from closing
  popup.addEventListener('click', (e) => e.stopPropagation());
}

function closeDropdownPopup() {
  // Remove any popup wherever it lives
  document.querySelectorAll('.dropdown-popup').forEach(p => p.remove());
  activePopup = null;
  if (activePopupGroup) {
    activePopupGroup.classList.remove('open');
    activePopupGroup = null;
  }
}

// Close popup when clicking anywhere
document.addEventListener('click', () => closeDropdownPopup());

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

        <div class="setting-group">
          <label><i class="fas fa-bolt" style="color: #f97316;"></i> Groq API Key <span style="color:var(--text-muted);">(Texto - ultra rapido)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="groqKeyInput" placeholder="Cole sua API key do Groq...">
            <button class="btn-tiny" id="toggleGroqKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://console.groq.com/keys" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-cubes" style="color: #06b6d4;"></i> Together AI API Key <span style="color:var(--text-muted);">(Imagem - FLUX Schnell)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="togetherKeyInput" placeholder="Cole sua API key do Together AI...">
            <button class="btn-tiny" id="toggleTogetherKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://api.together.xyz/settings/api-keys" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-face-smile" style="color: #fbbf24;"></i> HuggingFace API Key <span style="color:var(--text-muted);">(Imagem - FLUX.1-dev)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="huggingfaceKeyInput" placeholder="Cole sua API key do HuggingFace...">
            <button class="btn-tiny" id="toggleHuggingfaceKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://huggingface.co/settings/tokens" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-camera" style="color: #05a081;"></i> Pexels API Key <span style="color:var(--text-muted);">(Moodboard - busca de imagens)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="pexelsKeyInput" placeholder="Cole sua API key do Pexels...">
            <button class="btn-tiny" id="togglePexelsKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://www.pexels.com/api/new/" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
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
    if (!getUserId()) {
      showToast('Faca login com Google primeiro para salvar API keys', 'error');
      return;
    }
    const keys = {
      gemini_api_key: document.getElementById('geminiKeyInput').value.trim(),
      openrouter_api_key: document.getElementById('openrouterKeyInput').value.trim(),
      groq_api_key: document.getElementById('groqKeyInput').value.trim(),
      together_api_key: document.getElementById('togetherKeyInput').value.trim(),
      huggingface_api_key: document.getElementById('huggingfaceKeyInput').value.trim(),
      pexels_api_key: document.getElementById('pexelsKeyInput').value.trim()
    };
    for (const [k, v] of Object.entries(keys)) {
      setApiKey(k, v);
    }
    closeApiKeyModal();
    showToast('API keys salvas!', 'success');
    updateApiKeyStatus();
  });

  // Toggle visibility
  ['Gemini', 'Openrouter', 'Groq', 'Together', 'Huggingface', 'Pexels'].forEach(name => {
    document.getElementById(`toggle${name}Key`).addEventListener('click', () => {
      const input = document.getElementById(`${name.toLowerCase()}KeyInput`);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  updateApiKeyStatus();
}

function openApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  document.getElementById('geminiKeyInput').value = getApiKey('gemini_api_key') || '';
  document.getElementById('openrouterKeyInput').value = getApiKey('openrouter_api_key') || '';
  document.getElementById('groqKeyInput').value = getApiKey('groq_api_key') || '';
  document.getElementById('togetherKeyInput').value = getApiKey('together_api_key') || '';
  document.getElementById('huggingfaceKeyInput').value = getApiKey('huggingface_api_key') || '';
  document.getElementById('pexelsKeyInput').value = getApiKey('pexels_api_key') || '';
  modal.classList.add('open');
}

function closeApiKeyModal() {
  document.getElementById('apiKeyModal').classList.remove('open');
  updateApiKeyStatus();
}

function updateApiKeyStatus() {
  const providers = {
    Gemini: !!getApiKey('gemini_api_key'),
    OpenRouter: !!getApiKey('openrouter_api_key'),
    Groq: !!getApiKey('groq_api_key'),
    Together: !!getApiKey('together_api_key'),
    HuggingFace: !!getApiKey('huggingface_api_key'),
    Pexels: !!getApiKey('pexels_api_key')
  };
  const display = document.getElementById('creditsDisplay');
  if (display) {
    const connected = Object.entries(providers).filter(([,v]) => v).map(([k]) => k);
    if (connected.length > 0) {
      const label = connected.length <= 2 ? connected.join(' + ') : `${connected.length} APIs`;
      display.innerHTML = `<i class="fas fa-check-circle" style="color: var(--green);"></i> <span>${label} conectado</span>`;
    } else {
      display.innerHTML = '<i class="fas fa-key"></i> <span>Configurar APIs</span>';
    }
    display.onclick = openApiKeyModal;
  }
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

// === MOODBOARD ===
let moodboardItems = [];
let pexelsPage = 1;
let pexelsQuery = '';

const GOOGLE_FONTS_TOP = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Inter',
  'Playfair Display', 'Merriweather', 'Oswald', 'Nunito', 'Bebas Neue',
  'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Satisfy', 'Great Vibes',
  'Space Grotesk', 'DM Sans', 'Outfit', 'Sora', 'Urbanist', 'Archivo Black'
];

function initMoodboard() {
  // Load saved board
  const saved = localStorage.getItem('moodboard_items');
  if (saved) { try { moodboardItems = JSON.parse(saved); } catch(e) {} }
  renderMoodboard();

  // Search
  document.getElementById('moodboardSearchBtn').addEventListener('click', searchPexels);
  document.getElementById('moodboardSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchPexels();
  });
  document.getElementById('moodboardCloseResults').addEventListener('click', () => {
    document.getElementById('moodboardSearchResults').style.display = 'none';
  });
  document.getElementById('moodboardLoadMore').addEventListener('click', () => {
    pexelsPage++;
    searchPexels(true);
  });

  // Palette
  document.getElementById('moodboardPaletteBtn').addEventListener('click', () => {
    togglePanel('moodboardPalettePanel');
    generatePalette();
  });
  document.getElementById('moodboardClosePalette').addEventListener('click', () => {
    document.getElementById('moodboardPalettePanel').style.display = 'none';
  });
  document.getElementById('moodboardGenPalette').addEventListener('click', generatePalette);
  document.getElementById('moodboardAddPalette').addEventListener('click', addPaletteToBoard);

  // Fonts
  document.getElementById('moodboardFontBtn').addEventListener('click', () => {
    togglePanel('moodboardFontPanel');
    renderFontPanel();
  });
  document.getElementById('moodboardCloseFont').addEventListener('click', () => {
    document.getElementById('moodboardFontPanel').style.display = 'none';
  });

  // Note
  document.getElementById('moodboardNoteBtn').addEventListener('click', addNoteToBoard);

  // Clear
  document.getElementById('moodboardClearBtn').addEventListener('click', () => {
    if (moodboardItems.length === 0) return;
    if (confirm('Limpar todo o moodboard?')) {
      moodboardItems = [];
      saveMoodboard();
      renderMoodboard();
      showToast('Moodboard limpo', 'success');
    }
  });
}

function togglePanel(panelId) {
  const panels = ['moodboardSearchResults', 'moodboardPalettePanel', 'moodboardFontPanel'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (id === panelId) {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    } else {
      el.style.display = 'none';
    }
  });
}

// --- Pexels Search ---
async function searchPexels(append = false) {
  const key = getApiKey('pexels_api_key');
  if (!key) { showToast('Configure sua Pexels API Key em Configuracoes', 'error'); return; }

  const query = document.getElementById('moodboardSearch').value.trim();
  if (!query) { showToast('Digite algo para buscar', 'error'); return; }

  if (!append) { pexelsPage = 1; pexelsQuery = query; }

  document.getElementById('moodboardSearchResults').style.display = '';
  document.getElementById('moodboardPalettePanel').style.display = 'none';
  document.getElementById('moodboardFontPanel').style.display = 'none';
  const grid = document.getElementById('moodboardResultsGrid');
  if (!append) grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Buscando...</div>';

  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(pexelsQuery)}&per_page=20&page=${pexelsPage}`, {
      headers: { Authorization: key }
    });
    if (!res.ok) throw new Error('Erro na API Pexels: ' + res.status);
    const data = await res.json();

    if (!append) grid.innerHTML = '';
    document.getElementById('moodboardResultsTitle').textContent = `"${pexelsQuery}" — ${data.total_results} resultados`;

    data.photos.forEach(photo => {
      const card = document.createElement('div');
      card.className = 'moodboard-result-card';
      card.innerHTML = `<img src="${photo.src.medium}" alt="${photo.alt || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${photo.photographer}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
      card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        addImageToBoard(photo.src.large, photo.photographer, photo.avg_color);
      });
      grid.appendChild(card);
    });

    document.getElementById('moodboardLoadMore').style.display = data.next_page ? '' : 'none';
  } catch(e) {
    if (!append) grid.innerHTML = '';
    showToast(e.message, 'error');
  }
}

// --- Board Items ---
function addImageToBoard(url, photographer, avgColor) {
  moodboardItems.push({ type: 'image', url, photographer, avgColor, id: Date.now() });
  saveMoodboard();
  renderMoodboard();
  showToast('Imagem adicionada ao board!', 'success');
}

function addNoteToBoard() {
  const text = prompt('Digite sua nota:');
  if (!text) return;
  moodboardItems.push({ type: 'note', text, id: Date.now() });
  saveMoodboard();
  renderMoodboard();
}

function addPaletteToBoard() {
  const colors = [];
  document.querySelectorAll('#moodboardPaletteColors .moodboard-color-swatch').forEach(el => {
    colors.push(el.dataset.color);
  });
  if (colors.length === 0) return;
  moodboardItems.push({ type: 'palette', colors, id: Date.now() });
  saveMoodboard();
  renderMoodboard();
  showToast('Paleta adicionada ao board!', 'success');
}

function addFontToBoard(fontName) {
  moodboardItems.push({ type: 'font', fontName, id: Date.now() });
  saveMoodboard();
  renderMoodboard();
  showToast(`Fonte "${fontName}" adicionada!`, 'success');
}

function removeFromBoard(id) {
  moodboardItems = moodboardItems.filter(i => i.id !== id);
  saveMoodboard();
  renderMoodboard();
}

function saveMoodboard() {
  localStorage.setItem('moodboard_items', JSON.stringify(moodboardItems));
}

function renderMoodboard() {
  const board = document.getElementById('moodboardBoard');
  const empty = document.getElementById('moodboardEmpty');

  // Remove all items except empty state
  board.querySelectorAll('.moodboard-item').forEach(el => el.remove());

  if (moodboardItems.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  moodboardItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'moodboard-item moodboard-item-' + item.type;

    if (item.type === 'image') {
      el.innerHTML = `
        <img src="${item.url}" alt="" loading="lazy">
        <div class="moodboard-item-info">
          <span><i class="fas fa-camera"></i> ${item.photographer}</span>
        </div>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'palette') {
      el.innerHTML = `
        <div class="moodboard-palette-strip">
          ${item.colors.map(c => `<div class="moodboard-palette-cell" style="background:${c};" title="${c}"><span>${c}</span></div>`).join('')}
        </div>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'note') {
      el.innerHTML = `
        <div class="moodboard-note-content"><i class="fas fa-sticky-note"></i> ${item.text}</div>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'font') {
      // Load the font
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(item.fontName)}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      el.innerHTML = `
        <div class="moodboard-font-preview" style="font-family:'${item.fontName}',sans-serif;">
          <span class="moodboard-font-name">${item.fontName}</span>
          <span class="moodboard-font-sample">The quick brown fox jumps over the lazy dog</span>
          <span class="moodboard-font-sample-pt">A raposa marrom rapida salta sobre o cao preguicoso</span>
        </div>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    }

    el.querySelector('.moodboard-item-remove').addEventListener('click', () => removeFromBoard(item.id));
    board.appendChild(el);
  });
}

// --- Color Palette ---
async function generatePalette() {
  const seedHex = document.getElementById('moodboardColorSeed').value.replace('#', '');
  const container = document.getElementById('moodboardPaletteColors');
  container.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted);">Gerando...</div>';

  try {
    // Use The Color API for scheme generation
    const res = await fetch(`https://www.thecolorapi.com/scheme?hex=${seedHex}&mode=analogic&count=5&format=json`);
    if (!res.ok) throw new Error('Erro na Color API');
    const data = await res.json();

    container.innerHTML = '';
    data.colors.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'moodboard-color-swatch';
      swatch.dataset.color = c.hex.value;
      swatch.style.background = c.hex.value;
      swatch.innerHTML = `<span>${c.hex.value}</span><span class="color-name">${c.name.value}</span>`;
      swatch.title = `${c.name.value} (${c.hex.value})`;
      swatch.addEventListener('click', () => {
        navigator.clipboard.writeText(c.hex.value).then(() => showToast(`Copiado: ${c.hex.value}`, 'success'));
      });
      container.appendChild(swatch);
    });
  } catch(e) {
    // Fallback: generate random palette locally
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const hue = (parseInt(seedHex.slice(0,2), 16) + i * 60) % 360;
      const hex = hslToHex(hue, 70, 50 + i * 5);
      const swatch = document.createElement('div');
      swatch.className = 'moodboard-color-swatch';
      swatch.dataset.color = hex;
      swatch.style.background = hex;
      swatch.innerHTML = `<span>${hex}</span>`;
      container.appendChild(swatch);
    }
  }
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// --- Fonts ---
function renderFontPanel() {
  const grid = document.getElementById('moodboardFontGrid');
  grid.innerHTML = '';

  // Load fonts
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS_TOP.map(f => `family=${encodeURIComponent(f)}`).join('&')}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);

  GOOGLE_FONTS_TOP.forEach(fontName => {
    const card = document.createElement('div');
    card.className = 'moodboard-font-card';
    card.innerHTML = `
      <span class="moodboard-fc-name">${fontName}</span>
      <span class="moodboard-fc-sample" style="font-family:'${fontName}',sans-serif;">Aa Bb Cc 123</span>
      <button class="moodboard-add-btn" title="Adicionar"><i class="fas fa-plus"></i></button>
    `;
    card.querySelector('.moodboard-add-btn').addEventListener('click', () => addFontToBoard(fontName));
    grid.appendChild(card);
  });
}

// === GOOGLE AUTH ===
// Google OAuth - Client ID is public by design, security is enforced by
// Authorized JavaScript Origins in Google Cloud Console (only savylla.github.io)
const GOOGLE_CLIENT_ID = '85799521822-i5qg186cusmc6ruvbmgrg38m0vuiv5ih.apps.googleusercontent.com';
const ALLOWED_ORIGINS = ['https://savylla.github.io', 'http://localhost', 'http://127.0.0.1'];

function isAllowedOrigin() {
  return ALLOWED_ORIGINS.some(origin => window.location.origin.startsWith(origin));
}

function initGoogleAuth() {
  // Check if user is already logged in
  const savedUser = localStorage.getItem('google_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      updateUserUI(user);
    } catch(e) {}
  }

  // Login button
  document.getElementById('googleLoginBtn').addEventListener('click', () => {
    if (!isAllowedOrigin()) {
      showToast('Login disponivel apenas no dominio oficial', 'error');
      return;
    }
    startGoogleLogin(GOOGLE_CLIENT_ID);
  });

  // Topbar avatar click
  document.getElementById('topbarAvatar').addEventListener('click', (e) => {
    e.stopPropagation();
    const savedUser = localStorage.getItem('google_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (confirm(`Logado como ${user.name}\n${user.email}\n\nDeseja sair?`)) {
        googleLogout();
      }
    } else {
      if (!isAllowedOrigin()) {
        showToast('Login disponivel apenas no dominio oficial', 'error');
        return;
      }
      try {
        startGoogleLogin(GOOGLE_CLIENT_ID);
      } catch(err) {
        console.error('Google Login error:', err);
        showToast('Erro ao iniciar login. Recarregue a pagina.', 'error');
      }
    }
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', googleLogout);
}

function startGoogleLogin(clientId) {
  try {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false
    });
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: use the One Tap or popup
        google.accounts.id.renderButton(
          document.createElement('div'),
          { theme: 'filled_black', size: 'large' }
        );
        // Try the popup approach
        google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'profile email',
          callback: (response) => {
            if (response.access_token) {
              fetchGoogleUserInfo(response.access_token);
            }
          }
        }).requestAccessToken();
      }
    });
  } catch(e) {
    showToast('Erro ao iniciar login Google: ' + e.message, 'error');
  }
}

function handleGoogleCredential(response) {
  // Decode JWT token
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  const user = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
    sub: payload.sub
  };
  localStorage.setItem('google_user', JSON.stringify(user));
  updateUserUI(user);
  loadUserApiKeys();
  showToast(`Bem-vindo, ${user.name}!`, 'success');
}

async function fetchGoogleUserInfo(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    const user = {
      name: data.name,
      email: data.email,
      picture: data.picture,
      sub: data.sub
    };
    localStorage.setItem('google_user', JSON.stringify(user));
    updateUserUI(user);
    loadUserApiKeys();
    showToast(`Bem-vindo, ${user.name}!`, 'success');
  } catch(e) {
    showToast('Erro ao obter dados do usuario', 'error');
  }
}

function updateUserUI(user) {
  // Topbar avatar
  const topAvatar = document.getElementById('topbarAvatarImg');
  topAvatar.src = user.picture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.email;
  topAvatar.style.display = 'block';
  const defaultIcon = document.querySelector('.avatar-default-icon');
  if (defaultIcon) defaultIcon.style.display = 'none';
  document.getElementById('topbarAvatar').title = user.name;
  // Show logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = '';
  // Update API key status for this user
  updateApiKeyStatus();
}

function googleLogout() {
  localStorage.removeItem('google_user');
  const topAvatarImg = document.getElementById('topbarAvatarImg');
  topAvatarImg.src = '';
  topAvatarImg.style.display = 'none';
  const defaultIcon = document.querySelector('.avatar-default-icon');
  if (defaultIcon) defaultIcon.style.display = '';
  document.getElementById('topbarAvatar').title = 'Clique para login';
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'none';
  // Clear API key status (keys stay stored per-user, just not accessible now)
  updateApiKeyStatus();
  showToast('Voce saiu da conta', 'success');
}
