// === AI Performance Studio - Main Application ===

let currentTab = 'image';
let syncTimeout = null;

// === USER-SCOPED API KEY STORAGE ===
const API_KEY_NAMES = [
  'gemini_api_key', 'openrouter_api_key', 'groq_api_key',
  'together_api_key', 'huggingface_api_key', 'pexels_api_key',
  'pixabay_api_key', 'unsplash_api_key', 'freesound_api_key',
  'higgsfield_credentials'
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
  initStoryboard();
  initImageToVideo();
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
        document.getElementById('generateBtnMain').style.display = '';
        document.getElementById('speakBtn').style.display = '';
        document.getElementById('recordBtn').style.display = 'none';
        showTTSProviders();
      } else {
        document.getElementById('audioTranscribe').classList.add('active');
        document.getElementById('generateBtnMain').style.display = 'none';
        document.getElementById('speakBtn').style.display = 'none';
        document.getElementById('recordBtn').style.display = '';
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
    text: 'Digite seu prompt para gerar texto...',
    moodboard: 'Descreva a imagem que voce quer criar...'
  };
  document.getElementById('promptInput').placeholder = placeholders[tab] || placeholders.image;
  // Show/hide enhance & lang buttons for all generation tabs
  const langBtns = document.getElementById('langButtons');
  const enhanceBtn = document.getElementById('enhanceBtn');
  const isGenTab = ['image', 'video', 'audio', 'text', 'moodboard'].includes(tab);
  langBtns.style.display = isGenTab ? '' : 'none';
  enhanceBtn.style.display = isGenTab ? '' : 'none';
  // Hide bottom bar for non-generation tabs
  const bottomBar = document.querySelector('.bottom-bar');
  if (['gallery', 'history', 'storyboard'].includes(tab)) {
    bottomBar.style.display = 'none';
  } else {
    bottomBar.style.display = '';
  }
  // Show/hide shared bottom row for generation tabs
  const sharedRow = document.getElementById('sharedBottomRow');
  if (sharedRow) {
    sharedRow.style.display = ['gallery', 'history', 'storyboard'].includes(tab) ? 'none' : '';
  }
  // Show/hide ratio pills (only for image, video, moodboard)
  const ratioGroup = document.getElementById('ratioGroup');
  if (ratioGroup) {
    ratioGroup.style.display = ['image', 'video', 'moodboard'].includes(tab) ? '' : 'none';
  }
  // Show/hide speak button (only for audio TTS)
  const speakBtn = document.getElementById('speakBtn');
  if (speakBtn) {
    speakBtn.style.display = tab === 'audio' ? '' : 'none';
  }
  // Update generate button text per tab
  const genMain = document.getElementById('generateBtnMain');
  if (genMain) {
    genMain.style.display = '';
    const genTexts = {
      image: 'Gerar',
      video: 'Gerar Video',
      audio: 'Gerar',
      text: 'Gerar Texto',
      moodboard: 'Gerar'
    };
    genMain.querySelector('span').textContent = genTexts[tab] || 'Gerar';
  }
  // Load gallery when switching to gallery tab
  if (tab === 'gallery') renderGallery();
  if (tab === 'history') renderHistory();
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

  // Language buttons - show bilingual area + copy text to prompt field
  function showBilingualArea() {
    const biArea = document.getElementById('bilingualArea');
    biArea.style.display = 'block';
    biArea.classList.remove('collapsed');
  }

  document.getElementById('langPT').addEventListener('click', () => {
    document.getElementById('langPT').classList.add('active');
    document.getElementById('langEN').classList.remove('active');
    showBilingualArea();
    const ptText = document.getElementById('promptPT').value.trim();
    // If PT is empty but main prompt has text, populate PT and trigger translation
    if (!ptText && document.getElementById('promptInput').value.trim()) {
      document.getElementById('promptPT').value = document.getElementById('promptInput').value;
      syncPTtoEN();
    } else if (ptText) {
      const promptInput = document.getElementById('promptInput');
      promptInput.value = ptText;
      promptInput.style.height = 'auto';
      promptInput.style.height = promptInput.scrollHeight + 'px';
    }
  });
  document.getElementById('langEN').addEventListener('click', () => {
    document.getElementById('langEN').classList.add('active');
    document.getElementById('langPT').classList.remove('active');
    showBilingualArea();
    const enText = document.getElementById('promptEN').value.trim();
    // If EN is empty but main prompt has text, populate EN and trigger translation
    if (!enText && document.getElementById('promptInput').value.trim()) {
      document.getElementById('promptEN').value = document.getElementById('promptInput').value;
      syncENtoPT();
    } else if (enText) {
      const promptInput = document.getElementById('promptInput');
      promptInput.value = enText;
      promptInput.style.height = 'auto';
      promptInput.style.height = promptInput.scrollHeight + 'px';
    }
  });

  // PT textarea edit -> auto sync to EN
  document.getElementById('promptPT').addEventListener('input', () => {
    clearTimeout(syncTimeout);
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando PT...';
    syncStatus.className = 'bilingual-sync';
    // Also update prompt field if PT is active
    if (document.getElementById('langPT').classList.contains('active')) {
      document.getElementById('promptInput').value = document.getElementById('promptPT').value;
    }
    syncTimeout = setTimeout(() => syncPTtoEN(), 1500);
  });

  // EN textarea edit -> auto sync to PT (make EN editable)
  document.getElementById('promptEN').addEventListener('input', () => {
    clearTimeout(syncTimeout);
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando EN...';
    syncStatus.className = 'bilingual-sync';
    // Also update prompt field if EN is active
    if (document.getElementById('langEN').classList.contains('active')) {
      document.getElementById('promptInput').value = document.getElementById('promptEN').value;
    }
    syncTimeout = setTimeout(() => syncENtoPT(), 1500);
  });

  // Prompt field edit -> sync to active language field + translate to other
  let promptSyncTimeout;
  document.getElementById('promptInput').addEventListener('input', () => {
    const biArea = document.getElementById('bilingualArea');
    if (biArea.style.display === 'none') return;
    clearTimeout(promptSyncTimeout);
    clearTimeout(syncTimeout);
    const isPT = document.getElementById('langPT').classList.contains('active');
    const promptText = document.getElementById('promptInput').value;
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando...';
    syncStatus.className = 'bilingual-sync';
    if (isPT) {
      document.getElementById('promptPT').value = promptText;
      promptSyncTimeout = setTimeout(() => syncPTtoEN(), 1500);
    } else {
      document.getElementById('promptEN').value = promptText;
      promptSyncTimeout = setTimeout(() => syncENtoPT(), 1500);
    }
  });

  // Use English button - collapse instead of hide
  document.getElementById('useEnglishBtn').addEventListener('click', () => {
    const enText = document.getElementById('promptEN').value.trim();
    if (enText) {
      document.getElementById('promptInput').value = enText;
      document.getElementById('promptInput').style.height = 'auto';
      document.getElementById('promptInput').style.height = document.getElementById('promptInput').scrollHeight + 'px';
      showToast('Prompt EN aplicado!', 'success');
    }
    // Collapse the bilingual area
    document.getElementById('bilingualArea').classList.add('collapsed');
  });

  document.getElementById('closeBilingualBtn').addEventListener('click', () => {
    document.getElementById('bilingualArea').style.display = 'none';
    document.getElementById('bilingualArea').classList.remove('collapsed');
  });

  // Drag handle for bilingual area - swipe/drag to resize or collapse/expand
  initBilingualDrag();

  // Generate button (top send button in prompt row)
  document.getElementById('generateBtn').addEventListener('click', handleGenerate);
  document.getElementById('generateBtnMain').addEventListener('click', handleGenerate);
  document.getElementById('recordBtn')?.addEventListener('click', startTranscription);
  document.getElementById('speakBtn')?.addEventListener('click', speakPreview);
}

function speakPreview() {
  const text = document.getElementById('promptInput').value.trim();
  if (!text) { showToast('Digite texto para falar', 'error'); return; }
  if (!window.speechSynthesis) { showToast('Seu navegador nao suporta TTS', 'error'); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const voiceIdx = document.getElementById('voiceSelect').value;
  if (voiceIdx !== 'default' && voices[voiceIdx]) {
    utterance.voice = voices[voiceIdx];
  }
  utterance.onend = () => showToast('Audio reproduzido!', 'success');
  utterance.onerror = (e) => showToast('Erro ao falar: ' + e.error, 'error');
  speechSynthesis.speak(utterance);
  showToast('Reproduzindo...', 'success');
}

function handleGenerate() {
  switch (currentTab) {
    case 'image': startImageGeneration(); break;
    case 'video': startVideoGeneration(); break;
    case 'audio': startTTS(); break;
    case 'text': startTextGeneration(); break;
    case 'moodboard': startMoodboardGeneration(); break;
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
    // Re-run prompt enhance with the current prompt text
    const promptInput = document.getElementById('promptInput');
    const currentText = promptInput.value.trim();
    if (!currentText) {
      showToast('Digite um prompt primeiro', 'error');
      return;
    }
    enhancePromptBilingual(currentText);
  });

  // Reference file upload
  initRefUpload();
}

// === REFERENCE FILE UPLOAD ===
let referenceFiles = [];

function initRefUpload() {
  const btn = document.getElementById('refUploadBtn');
  const input = document.getElementById('refFileInput');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    if (referenceFiles.length > 0) {
      // If files already loaded, show menu to add more or clear
      if (confirm(`${referenceFiles.length} arquivo(s) carregado(s).\n\nOK = Adicionar mais\nCancelar = Remover todos`)) {
        input.click();
      } else {
        clearRefFiles();
      }
    } else {
      input.click();
    }
  });

  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const totalFiles = referenceFiles.length + files.length;
    if (totalFiles > 15) {
      showToast(`Maximo 15 arquivos. Voce tem ${referenceFiles.length}, tentou adicionar ${files.length}.`, 'error');
      input.value = '';
      return;
    }

    // Process each file
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        referenceFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: ev.target.result // base64 data URL
        });
        updateRefUploadUI();

        // If on Moodboard tab, also add file to the board
        if (currentTab === 'moodboard') {
          addRefFileToMoodboard(file, ev.target.result);
        }
      };
      reader.readAsDataURL(file);
    });

    input.value = ''; // Reset for next selection
  });
}

function updateRefUploadUI() {
  const btn = document.getElementById('refUploadBtn');
  const count = document.getElementById('refUploadCount');
  if (referenceFiles.length > 0) {
    btn.classList.add('active');
    count.style.display = 'flex';
    count.textContent = referenceFiles.length;
  } else {
    btn.classList.remove('active');
    count.style.display = 'none';
  }
}

function clearRefFiles() {
  referenceFiles = [];
  updateRefUploadUI();
  showToast('Arquivos removidos', 'success');
}

function getReferenceFiles() {
  return referenceFiles;
}

function addRefFileToMoodboard(file, dataUrl) {
  if (file.type.startsWith('image/')) {
    addImageToBoard(dataUrl, file.name, null);
  } else if (file.type.startsWith('video/')) {
    moodboardItems.push({ type: 'video', url: dataUrl, provider: file.name, id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Video adicionado ao board!', 'success');
  } else if (file.type.startsWith('audio/')) {
    moodboardItems.push({ type: 'audio', url: dataUrl, provider: file.name, id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Audio adicionado ao board!', 'success');
  } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    // Read as text and add as note
    const text = atob(dataUrl.split(',')[1]);
    const snippet = text.substring(0, 200);
    moodboardItems.push({ type: 'note', text: `[${file.name}] ${snippet}`, id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Texto adicionado como nota!', 'success');
  } else {
    // Generic file - add as note with filename
    moodboardItems.push({ type: 'note', text: `Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Arquivo adicionado ao board!', 'success');
  }
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
  const enhanceBtn = document.getElementById('enhanceBtn');
  enhanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  enhanceBtn.disabled = true;

  try {
    const result = await pollinationsText(
      `INSTRUCAO: Voce vai receber um prompt para geracao de imagem com IA. Faca o seguinte:

1. Melhore o prompt tornando-o mais detalhado e profissional para geracao de imagem.
2. Retorne o resultado em DUAS linguas: Portugues e Ingles.

FORMATO OBRIGATORIO (siga exatamente):
---PT---
(prompt melhorado em portugues aqui)
---EN---
(prompt melhorado em ingles aqui)

NAO escreva explicacoes, NAO escreva introducoes, NAO escreva nada fora do formato acima.

Prompt original: ${original}`,
      'openai'
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
    const biArea = document.getElementById('bilingualArea');
    biArea.style.display = 'block';
    biArea.classList.remove('collapsed');
    document.getElementById('syncStatus').innerHTML = '<i class="fas fa-check"></i> Sincronizado';
    document.getElementById('promptInput').value = enText;
    showToast('Prompt melhorado em PT e EN!', 'success');
  } catch (error) {
    console.error('Enhance error:', error);
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
  syncStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduzindo PT→EN...';
  syncStatus.className = 'bilingual-sync syncing';
  try {
    const enText = await pollinationsText(
      `INSTRUCAO: Traduza o texto abaixo para ingles. Este e um prompt para geracao de imagem com IA. Retorne SOMENTE a traducao, nada mais.\n\nTexto: ${ptText}`,
      'openai'
    );
    if (enText) {
      document.getElementById('promptEN').value = enText;
      // Update prompt field based on active language
      const isEN = document.getElementById('langEN').classList.contains('active');
      document.getElementById('promptInput').value = isEN ? enText : ptText;
      syncStatus.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
      syncStatus.className = 'bilingual-sync';
    }
  } catch (error) {
    syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro';
    syncStatus.className = 'bilingual-sync';
  }
}

async function syncENtoPT() {
  const enText = document.getElementById('promptEN').value.trim();
  if (!enText) return;
  const syncStatus = document.getElementById('syncStatus');
  syncStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduzindo EN→PT...';
  syncStatus.className = 'bilingual-sync syncing';
  try {
    const ptText = await pollinationsText(
      `INSTRUCAO: Traduza o texto abaixo para portugues brasileiro. Este e um prompt para geracao de imagem com IA. Retorne SOMENTE a traducao, nada mais.\n\nTexto: ${enText}`,
      'openai'
    );
    if (ptText) {
      document.getElementById('promptPT').value = ptText;
      const isPT = document.getElementById('langPT').classList.contains('active');
      document.getElementById('promptInput').value = isPT ? ptText : enText;
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
  if (provider.startsWith('higgs-')) {
    if (!getApiKey('higgsfield_credentials')) {
      openApiKeyModal();
      showToast('Configure suas credenciais do Higgsfield primeiro (Key ID:Key Secret)', 'error');
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
      if (!imageResult) {
        console.log('Pollinations failed, falling back to Stable Horde...');
        card.querySelector('.card-loading-state span').textContent = 'Pollinations falhou, tentando Stable Horde...';
        imageResult = await generateWithStableHorde(prompt, w, h);
      }
    } else if (provider.startsWith('horde')) {
      imageResult = await generateWithStableHorde(prompt, w, h);
    } else if (provider.startsWith('together-')) {
      imageResult = await generateWithTogether(prompt, provider, w, h, seed, i);
    } else if (provider.startsWith('higgs-')) {
      card.querySelector('.card-loading-state span').textContent = `Gerando com Higgsfield ${HIGGSFIELD_IMAGE_MODELS[provider]?.name || ''}... pode demorar`;
      imageResult = await generateWithHiggsfield(prompt, provider, w, h);
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
      const providerLabel = HIGGSFIELD_IMAGE_MODELS[provider]?.name || provider;
      card.innerHTML = `
        <img src="${imgSrc}" alt="Generated" crossorigin="anonymous">
        <div class="result-card-overlay">
          <button title="Download" onclick="event.stopPropagation(); downloadImage('${imgSrc}', 'ai-image-${Date.now()}.png')"><i class="fas fa-download"></i></button>
          <button title="Favoritar" onclick="event.stopPropagation(); this.style.color='var(--accent)'"><i class="fas fa-heart"></i></button>
        </div>
        <div class="result-card-provider">${providerLabel}</div>
      `;
      card.addEventListener('click', () => openLightbox(imgSrc, prompt, ratio));
      // Save to gallery + history
      saveImageToGallery(imgSrc, prompt, providerLabel);
      saveToHistory({ type: 'image', prompt, provider: providerLabel, status: 'success', detail: ratio });
    } else {
      card.classList.remove('loading');
      card.innerHTML = `<div class="card-error-state"><i class="fas fa-exclamation-triangle"></i><span>Erro - tente novamente</span></div>`;
      saveToHistory({ type: 'image', prompt, provider, status: 'error', detail: 'Falha na geracao' });
    }

    if (i < qty - 1) await delay(1500);
  }

  setButtonLoading('generateBtnMain', false, 'Gerar');
  if (success > 0) showToast(`${success} imagem(ns) gerada(s)!`, 'success');
  else showToast('Erro ao gerar. Tente outro provedor.', 'error');
}

// --- Moodboard Image Generation ---
async function startMoodboardGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Escreva um prompt para gerar', 'error'); return; }

  const provider = getActiveProvider('moodboardProviders');
  const activeRatio = document.querySelector('.ratio-pill.active');
  const ratio = activeRatio?.dataset.ratio || '1:1';
  const w = parseInt(activeRatio?.dataset.w || 1024);
  const h = parseInt(activeRatio?.dataset.h || 1024);
  const qty = parseInt(document.querySelector('.qty-pill.active')?.dataset.qty || 1);
  const seed = document.getElementById('seedToggle').dataset.seed;

  // Check API keys
  if (provider.startsWith('gemini') || provider === 'nano-banana-pro-preview') {
    if (!getApiKey('gemini_api_key')) { openApiKeyModal(); showToast('Configure sua API key do Gemini primeiro', 'error'); return; }
  }
  if (provider.startsWith('together-')) {
    if (!getApiKey('together_api_key')) { openApiKeyModal(); showToast('Configure sua API key do Together AI primeiro', 'error'); return; }
  }
  if (provider.startsWith('hf-')) {
    if (!getApiKey('huggingface_api_key')) { openApiKeyModal(); showToast('Configure sua API key do HuggingFace primeiro', 'error'); return; }
  }

  setButtonLoading('generateBtnMain', true, 'Gerando...');
  let success = 0;

  for (let i = 0; i < qty; i++) {
    let imageResult = null;

    if (provider.startsWith('pollinations')) {
      imageResult = await generateWithPollinations(prompt, provider, w, h, seed, i);
      if (!imageResult) imageResult = await generateWithStableHorde(prompt, w, h);
    } else if (provider.startsWith('horde')) {
      imageResult = await generateWithStableHorde(prompt, w, h);
    } else if (provider.startsWith('together-')) {
      imageResult = await generateWithTogether(prompt, provider, w, h, seed, i);
    } else if (provider.startsWith('higgs-')) {
      imageResult = await generateWithHiggsfield(prompt, provider, w, h);
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
      const providerLabel = HIGGSFIELD_IMAGE_MODELS[provider]?.name || provider;
      addImageToBoard(imgSrc, 'AI Generated (' + providerLabel + ')', null);
      // Save to gallery + history
      saveImageToGallery(imgSrc, prompt, providerLabel);
      saveToHistory({ type: 'moodboard', prompt, provider: providerLabel, status: 'success', detail: 'Imagem gerada' });
    }

    if (i < qty - 1) await delay(1500);
  }

  setButtonLoading('generateBtnMain', false, 'Gerar');
  if (success > 0) showToast(`${success} imagem(ns) adicionada(s) ao moodboard!`, 'success');
  else showToast('Erro ao gerar. Tente outro provedor.', 'error');
}

// --- Pollinations Image ---
async function generateWithPollinations(prompt, provider, w, h, seed, variation) {
  const seedParam = seed || (Date.now() + variation);
  // Truncate prompt to avoid URL too long errors
  const truncated = prompt.length > 300 ? prompt.substring(0, 300) : prompt;
  const encodedPrompt = encodeURIComponent(truncated);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&seed=${seedParam}&nologo=true`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await delay(2000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        console.warn(`Pollinations attempt ${attempt + 1} failed: HTTP ${response.status}`);
        continue;
      }
      const blob = await response.blob();
      if (blob.size < 1000) { console.warn('Pollinations returned empty/tiny image'); continue; }
      return { url: URL.createObjectURL(blob) };
    } catch (e) {
      console.warn(`Pollinations attempt ${attempt + 1} error:`, e.message);
    }
  }
  return null;
}

// --- Stable Horde Image (Free, no API key) ---
async function generateWithStableHorde(prompt, w, h) {
  try {
    // Use 512x512 for anonymous — most compatible with available workers
    const size = 512;
    const submitRes = await fetch('https://stablehorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': '0000000000', 'Client-Agent': 'AI-Performance-Studio:1.0' },
      body: JSON.stringify({
        prompt: prompt.substring(0, 500),
        params: { width: size, height: size, steps: 20, sampler_name: 'k_euler', cfg_scale: 7 },
        nsfw: true,
        censor_nsfw: false,
        trusted_workers: false,
        r2: true
      })
    });
    if (!submitRes.ok) {
      const errBody = await submitRes.text().catch(() => '');
      console.warn('Stable Horde submit failed:', submitRes.status, errBody);
      return null;
    }
    const submitData = await submitRes.json();
    const id = submitData.id;
    if (!id) { console.warn('Stable Horde: no job id returned', submitData); return null; }
    console.log('Stable Horde job submitted:', id);

    // Poll for result (max 180s)
    for (let i = 0; i < 60; i++) {
      await delay(3000);
      try {
        const checkRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${id}`, {
          headers: { 'Client-Agent': 'AI-Performance-Studio:1.0' }
        });
        if (!checkRes.ok) { console.warn('Stable Horde check failed:', checkRes.status); continue; }
        const status = await checkRes.json();
        console.log(`Stable Horde poll ${i + 1}: done=${status.done}, wait=${status.wait_time}s, queue=${status.queue_position}`);
        if (status.faulted) { console.warn('Stable Horde generation faulted'); return null; }
        if (status.done && status.generations?.length > 0) {
          const imgUrl = status.generations[0].img;
          if (!imgUrl) continue;
          // Fetch image and convert to blob URL to avoid CORS issues
          try {
            const imgRes = await fetch(imgUrl);
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              return { url: URL.createObjectURL(blob) };
            }
          } catch (e2) {
            console.warn('Stable Horde image fetch failed, using direct URL');
          }
          return { url: imgUrl };
        }
      } catch (pollErr) {
        console.warn('Stable Horde poll error:', pollErr);
      }
    }
    console.warn('Stable Horde timeout after 180s');
    return null;
  } catch (e) {
    console.warn('Stable Horde error:', e);
    return null;
  }
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
          console.warn(`Gemini ${model} rate limited (429), attempt ${attempt + 1}/3`);
          if (attempt < 2) continue;
          break;
        }
        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.warn(`Gemini ${model} error: HTTP ${response.status}`, errBody.substring(0, 200));
          break;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
          }
        }
        console.warn(`Gemini ${model}: no image in response`, JSON.stringify(data).substring(0, 200));
        break;
      } catch (e) {
        console.warn(`Gemini ${model} exception:`, e.message);
        break;
      }
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
    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
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

// --- Higgsfield Image ---
const HIGGSFIELD_IMAGE_MODELS = {
  'higgs-nano-banana': { endpoint: '/v1/text2image/nano-banana', name: 'Nano Banana' },
  'higgs-soul': { endpoint: '/v1/text2image/soul', name: 'Higgsfield Soul' },
  'higgs-seedream': { endpoint: '/v1/text2image/seedream', name: 'Seedream 4.0' },
  'higgs-gpt-image': { endpoint: '/v1/text2image/gpt-image', name: 'GPT Image 1.5' },
  'higgs-z-image': { endpoint: '/v1/text2image/z-image', name: 'Z-Image' },
  'higgs-kling-o1': { endpoint: '/v1/text2image/kling', name: 'Kling O1' },
  'higgs-flux2-pro': { endpoint: '/v1/text2image/flux.2-pro', name: 'FLUX.2 Pro' }
};

function getHiggsfieldAspectRatio(w, h) {
  const ratio = w / h;
  if (ratio > 1.6) return '16:9';
  if (ratio > 1.2) return '3:2';
  if (ratio < 0.625) return '9:16';
  if (ratio < 0.83) return '2:3';
  return '1:1';
}

async function generateWithHiggsfield(prompt, provider, w, h) {
  const credentials = getApiKey('higgsfield_credentials');
  if (!credentials) return null;
  const modelInfo = HIGGSFIELD_IMAGE_MODELS[provider];
  if (!modelInfo) return null;

  const aspectRatio = getHiggsfieldAspectRatio(w, h);

  try {
    // Submit generation request
    const submitResponse = await fetch(`https://platform.higgsfield.ai${modelInfo.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${credentials}`
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatio,
          width: w,
          height: h
        }
      })
    });

    if (!submitResponse.ok) {
      const err = await submitResponse.json().catch(() => ({}));
      throw new Error(err.message || err.error || `HTTP ${submitResponse.status}`);
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.id || submitData.request_id;
    if (!requestId) throw new Error('No request ID returned');

    // Poll for completion
    const maxPollTime = 300000; // 5 min
    const pollInterval = 3000; // 3 sec
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      await delay(pollInterval);

      const statusResponse = await fetch(`https://platform.higgsfield.ai/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${credentials}` }
      });

      if (!statusResponse.ok) continue;
      const statusData = await statusResponse.json();
      const status = statusData.status || statusData.jobs?.[0]?.status;

      if (status === 'completed') {
        const imageUrl = statusData.jobs?.[0]?.results?.raw?.url
          || statusData.output?.url
          || statusData.result?.url
          || statusData.url;
        if (imageUrl) return { url: imageUrl };
        throw new Error('Completed but no image URL found');
      }

      if (status === 'failed') throw new Error('Generation failed on Higgsfield');
      if (status === 'nsfw') throw new Error('Content rejected by moderation (NSFW)');
    }

    throw new Error('Timeout - generation took too long');
  } catch (e) {
    console.warn('Higgsfield error:', e);
    if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
      showToast('Higgsfield: erro de CORS. A API pode nao aceitar chamadas diretas do navegador. Veja o console para detalhes.', 'error');
    }
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
const HF_VIDEO_MODELS = {
  'hf-video-animatediff': 'ByteDance/AnimateDiff-Lightning',
  'hf-video-wan': 'Wan-AI/Wan2.1-T2V-1.3B'
};

async function startVideoGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) { showToast('Escreva um prompt para o video', 'error'); return; }

  const provider = getActiveProvider('videoProviders');
  setButtonLoading('generateBtnMain', true, 'Gerando...');

  if (!getApiKey('huggingface_api_key')) {
    openApiKeyModal();
    showToast('Configure sua API key do HuggingFace para gerar videos', 'error');
    setButtonLoading('generateBtnMain', false, 'Gerar');
    return;
  }

  const model = HF_VIDEO_MODELS[provider] || 'ByteDance/AnimateDiff-Lightning';
  const modelName = model.split('/').pop();
  await generateVideoHuggingFace(prompt, model, modelName);
  setButtonLoading('generateBtnMain', false, 'Gerar');
}

async function generateVideoHuggingFace(prompt, model, modelName) {
  const apiKey = getApiKey('huggingface_api_key');
  showToast(`Gerando video com ${modelName}... pode demorar`, 'success');
  try {
    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errMsg = err.error || `HTTP ${response.status}`;
      // Detect permission error and show helpful message
      if (errMsg.includes('permissions') || errMsg.includes('Inference Providers')) {
        showToast('Erro: Seu token HuggingFace precisa da permissao "Inference Providers". Crie um novo token em huggingface.co/settings/tokens com essa permissao.', 'error');
      } else {
        showToast('Erro ao gerar video: ' + errMsg, 'error');
      }
      saveToHistory({ type: 'video', prompt, provider: modelName, status: 'error', detail: errMsg });
      return;
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
      <div class="result-card-provider">HuggingFace ${modelName}</div>
    `;
    videoGrid.insertBefore(card, videoGrid.firstChild);
    showToast('Video gerado!', 'success');
    saveVideoToGallery(blob, prompt, `HuggingFace ${modelName}`);
    saveToHistory({ type: 'video', prompt, provider: `HuggingFace ${modelName}`, status: 'success' });
  } catch (e) {
    showToast('Erro ao gerar video: ' + e.message, 'error');
  }
}

// =============================================
// === IMAGE-TO-VIDEO (TikTok Creative Studio Style) ===
// =============================================

let i2vLoadedImage = null;
let i2vPreviewAnim = null;
let i2vCurrentRatio = '1:1';
let i2vCurrentFilter = 'none';
let i2vCaptionPos = 'bottom';
let i2vCaptionStyle = 'modern';

function initImageToVideo() {
  // Video sub-tabs
  document.querySelectorAll('.video-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.video-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.video-section').forEach(s => s.classList.remove('active'));
      const target = btn.dataset.videotab;
      document.getElementById(target === 'img2video' ? 'videoImg2Video' : 'videoText2Video')?.classList.add('active');
    });
  });

  const uploadArea = document.getElementById('i2vUploadArea');
  const fileInput = document.getElementById('i2vFileInput');
  if (!uploadArea) return;

  // Upload handlers
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadI2VImage(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadI2VImage(fileInput.files[0]);
  });

  // Effect cards
  document.querySelectorAll('.i2v-effect-card').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.i2v-effect-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Aspect ratio pills
  document.querySelectorAll('.i2v-aspect-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.i2v-aspect-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      i2vCurrentRatio = btn.dataset.ratio;
      if (i2vLoadedImage) i2vApplyRatio();
    });
  });

  // Filter buttons
  document.querySelectorAll('.i2v-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.i2v-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      i2vCurrentFilter = btn.dataset.filter;
      if (i2vLoadedImage) i2vDrawFrame(0);
    });
  });

  // Caption position pills
  document.querySelectorAll('.i2v-pos-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.i2v-pos-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      i2vCaptionPos = btn.dataset.pos;
    });
  });

  // Caption style pills
  document.querySelectorAll('.i2v-style-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.i2v-style-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      i2vCaptionStyle = btn.dataset.style;
    });
  });

  // Range sliders
  document.getElementById('i2vDuration')?.addEventListener('input', e => {
    document.getElementById('i2vDurationVal').textContent = e.target.value + 's';
  });
  document.getElementById('i2vIntensity')?.addEventListener('input', e => {
    document.getElementById('i2vIntensityVal').textContent = e.target.value;
  });
  document.getElementById('i2vFps')?.addEventListener('input', e => {
    document.getElementById('i2vFpsVal').textContent = e.target.value;
  });

  // Buttons
  document.getElementById('i2vPreviewBtn')?.addEventListener('click', () => runI2VPreview());
  document.getElementById('i2vCanvasOverlay')?.addEventListener('click', () => runI2VPreview());
  document.getElementById('i2vGenerateBtn')?.addEventListener('click', () => generateI2VVideo());
  document.getElementById('i2vResetBtn')?.addEventListener('click', () => resetI2V());
  document.getElementById('i2vNewBtn')?.addEventListener('click', () => resetI2V());
  document.getElementById('i2vEditAgainBtn')?.addEventListener('click', () => {
    document.getElementById('i2vResult').style.display = 'none';
    document.getElementById('i2vEditor').style.display = '';
  });
  document.getElementById('i2vSmartEffectBtn')?.addEventListener('click', () => i2vSmartEffect());
}

function loadI2VImage(file) {
  if (file.size > 10 * 1024 * 1024) {
    showToast('Imagem muito grande! Maximo 10MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      i2vLoadedImage = img;
      document.getElementById('i2vFileName').textContent = file.name;
      document.getElementById('i2vUploadArea').style.display = 'none';
      document.getElementById('i2vEditor').style.display = '';
      document.getElementById('i2vResult').style.display = 'none';
      i2vApplyRatio();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function i2vApplyRatio() {
  const canvas = document.getElementById('i2vCanvas');
  const container = canvas.parentElement;
  const maxW = Math.min(container?.clientWidth || 600, 640);

  const baseRatios = { '1:1': [1, 1], '9:16': [9, 16], '16:9': [16, 9], '4:5': [4, 5] };
  const [rw, rh] = baseRatios[i2vCurrentRatio] || [1, 1];

  let w = maxW;
  let h = Math.round(w * (rh / rw));
  // Cap height to avoid huge canvas on portrait
  const maxH = Math.min(window.innerHeight * 0.55, 640);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h * (rw / rh));
  }

  canvas.width = w;
  canvas.height = h;
  i2vDrawFrame(0);
}

function resetI2V() {
  if (i2vPreviewAnim) { cancelAnimationFrame(i2vPreviewAnim); i2vPreviewAnim = null; }
  i2vLoadedImage = null;
  document.getElementById('i2vUploadArea').style.display = '';
  document.getElementById('i2vEditor').style.display = 'none';
  document.getElementById('i2vResult').style.display = 'none';
  document.getElementById('i2vFileInput').value = '';
  document.getElementById('i2vCanvasOverlay')?.classList.remove('hidden');
}

function getI2VEffect() {
  return document.querySelector('.i2v-effect-card.active')?.dataset.effect || 'zoom-in';
}

// Color filter application
function i2vApplyFilter(ctx, w, h, filter) {
  if (filter === 'none') return;
  const filters = {
    cinematic: () => { ctx.fillStyle = 'rgba(0,0,30,0.15)'; ctx.fillRect(0,0,w,h); ctx.globalCompositeOperation = 'color'; ctx.fillStyle = 'rgba(200,170,130,0.1)'; ctx.fillRect(0,0,w,h); ctx.globalCompositeOperation = 'source-over'; },
    warm: () => { ctx.fillStyle = 'rgba(255,140,50,0.12)'; ctx.fillRect(0,0,w,h); },
    cool: () => { ctx.fillStyle = 'rgba(50,100,255,0.1)'; ctx.fillRect(0,0,w,h); },
    vintage: () => { ctx.fillStyle = 'rgba(180,150,100,0.18)'; ctx.fillRect(0,0,w,h); ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0,0,w,h); },
    bw: () => {
      const imageData = ctx.getImageData(0,0,w,h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
        d[i] = d[i+1] = d[i+2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
    },
    dramatic: () => { ctx.fillStyle = 'rgba(50,0,80,0.15)'; ctx.fillRect(0,0,w,h); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0,0,w,h); },
    vibrant: () => {
      const imageData = ctx.getImageData(0,0,w,h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * 1.15);
        d[i+1] = Math.min(255, d[i+1] * 1.1);
        d[i+2] = Math.min(255, d[i+2] * 1.15);
      }
      ctx.putImageData(imageData, 0, 0);
    }
  };
  if (filters[filter]) filters[filter]();
}

// Draw caption with styles
function i2vDrawCaption(ctx, canvasW, canvasH) {
  const caption = document.getElementById('i2vCaption')?.value.trim();
  if (!caption) return;

  const fontSize = Math.max(14, Math.min(canvasW, canvasH) * 0.045);
  ctx.save();
  ctx.textAlign = 'center';

  // Position
  let textY;
  if (i2vCaptionPos === 'top') textY = fontSize + 20;
  else if (i2vCaptionPos === 'center') textY = canvasH / 2;
  else textY = canvasH - 24;

  ctx.textBaseline = i2vCaptionPos === 'top' ? 'top' : 'bottom';
  if (i2vCaptionPos === 'center') ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(caption); // measure after font set below

  // Styles
  switch (i2vCaptionStyle) {
    case 'bold':
      ctx.font = `900 ${fontSize * 1.1}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const m1 = ctx.measureText(caption);
      ctx.fillRect(canvasW/2 - m1.width/2 - 14, textY - fontSize - 8, m1.width + 28, fontSize * 1.4 + 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(caption, canvasW / 2, textY);
      break;
    case 'neon':
      ctx.font = `bold ${fontSize}px 'Space Grotesk', sans-serif`;
      ctx.shadowColor = '#AD39FB';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#fff';
      ctx.fillText(caption, canvasW / 2, textY);
      ctx.shadowBlur = 40;
      ctx.fillText(caption, canvasW / 2, textY);
      break;
    case 'minimal':
      ctx.font = `400 ${fontSize * 0.85}px 'Inter', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(caption, canvasW / 2, textY);
      break;
    default: // modern
      ctx.font = `bold ${fontSize}px 'Space Grotesk', sans-serif`;
      const m2 = ctx.measureText(caption);
      const padX = 14, padY = 7;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const bgY = i2vCaptionPos === 'top' ? textY - 4 : textY - fontSize - padY;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(canvasW/2 - m2.width/2 - padX, bgY, m2.width + padX*2, fontSize + padY*2, 8);
        ctx.fill();
      } else {
        ctx.fillRect(canvasW/2 - m2.width/2 - padX, bgY, m2.width + padX*2, fontSize + padY*2);
      }
      ctx.fillStyle = '#fff';
      ctx.fillText(caption, canvasW / 2, textY);
  }
  ctx.restore();
}

function i2vDrawFrame(progress) {
  if (!i2vLoadedImage) return;
  const canvas = document.getElementById('i2vCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const effect = getI2VEffect();
  const intensity = parseInt(document.getElementById('i2vIntensity')?.value || 5);

  const maxScale = 1 + (intensity * 0.04);
  const maxPan = intensity * (Math.max(w, h) * 0.04);
  const t = progress;

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  let scale = 1, tx = 0, ty = 0, rot = 0;

  switch (effect) {
    case 'zoom-in': scale = 1 + (maxScale - 1) * t; break;
    case 'zoom-out': scale = maxScale - (maxScale - 1) * t; break;
    case 'pan-left': tx = -maxPan * t; scale = 1.05; break;
    case 'pan-right': tx = maxPan * t; scale = 1.05; break;
    case 'pan-up': ty = -maxPan * t; scale = 1.05; break;
    case 'pan-down': ty = maxPan * t; scale = 1.05; break;
    case 'zoom-pan-right': scale = 1 + (maxScale - 1) * t * 0.6; tx = maxPan * t * 0.7; break;
    case 'rotate-zoom':
      scale = 1 + (maxScale - 1) * t * 0.5;
      rot = (intensity * 1.2) * t * (Math.PI / 180);
      break;
    case 'ken-burns':
      // Classic Ken Burns: slow zoom + slight pan
      scale = 1 + (maxScale - 1) * t * 0.7;
      tx = maxPan * 0.3 * Math.sin(t * Math.PI);
      ty = -maxPan * 0.2 * t;
      break;
    case 'dolly-zoom':
      // Dolly zoom: zoom in center while pulling back edges
      const dollyT = Math.sin(t * Math.PI);
      scale = 1 + (maxScale - 1) * 0.6 * dollyT;
      break;
    case 'tilt-shift':
      // Tilt: slight vertical shift + zoom
      scale = 1 + (maxScale - 1) * t * 0.3;
      ty = maxPan * 0.5 * Math.sin(t * Math.PI * 2);
      break;
    case 'parallax':
      // Simulate parallax with oscillating horizontal movement
      scale = 1.1;
      tx = maxPan * 0.6 * Math.sin(t * Math.PI);
      ty = maxPan * 0.15 * Math.cos(t * Math.PI);
      break;
  }

  ctx.translate(w / 2, h / 2);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2 + tx, -h / 2 + ty);

  // Draw image covering canvas (cover fit)
  const imgRatio = i2vLoadedImage.width / i2vLoadedImage.height;
  const canvasRatio = w / h;
  let drawW, drawH, drawX, drawY;
  if (imgRatio > canvasRatio) {
    drawH = h; drawW = h * imgRatio;
    drawX = (w - drawW) / 2; drawY = 0;
  } else {
    drawW = w; drawH = w / imgRatio;
    drawX = 0; drawY = (h - drawH) / 2;
  }
  ctx.drawImage(i2vLoadedImage, drawX, drawY, drawW, drawH);
  ctx.restore();

  // Apply filter
  i2vApplyFilter(ctx, w, h, i2vCurrentFilter);

  // Draw caption
  i2vDrawCaption(ctx, w, h);
}

function runI2VPreview() {
  if (!i2vLoadedImage) return;
  if (i2vPreviewAnim) { cancelAnimationFrame(i2vPreviewAnim); i2vPreviewAnim = null; }
  document.getElementById('i2vCanvasOverlay')?.classList.add('hidden');

  const duration = parseInt(document.getElementById('i2vDuration').value) * 1000;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    i2vDrawFrame(eased);

    if (progress < 1) {
      i2vPreviewAnim = requestAnimationFrame(animate);
    } else {
      document.getElementById('i2vCanvasOverlay')?.classList.remove('hidden');
    }
  }
  i2vPreviewAnim = requestAnimationFrame(animate);
}

// AI Smart Effect: use Pollinations text to pick the best effect from prompt
async function i2vSmartEffect() {
  const prompt = document.getElementById('i2vPrompt')?.value.trim();
  if (!prompt) { showToast('Escreva um prompt descrevendo o movimento desejado', 'error'); return; }

  const btn = document.getElementById('i2vSmartEffectBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...';

  try {
    const effects = ['zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','zoom-pan-right','rotate-zoom','ken-burns','dolly-zoom','tilt-shift','parallax'];
    const result = await pollinationsText(
      `Voce e um assistente de edicao de video. O usuario quer este movimento: "${prompt}"
Escolha O MELHOR efeito da lista: ${effects.join(', ')}
Responda APENAS com o nome do efeito (ex: zoom-in). Nada mais.`,
      'openai'
    );

    const chosen = result.trim().toLowerCase().replace(/[^a-z-]/g, '');
    const match = effects.find(e => chosen.includes(e)) || 'zoom-in';

    // Activate the chosen effect
    document.querySelectorAll('.i2v-effect-card').forEach(b => b.classList.remove('active'));
    document.querySelector(`.i2v-effect-card[data-effect="${match}"]`)?.classList.add('active');

    // Also suggest intensity
    let suggestedIntensity = 5;
    if (prompt.match(/lent|suave|gentle|slow|soft/i)) suggestedIntensity = 3;
    if (prompt.match(/rapido|forte|fast|intense|dramatic/i)) suggestedIntensity = 8;
    document.getElementById('i2vIntensity').value = suggestedIntensity;
    document.getElementById('i2vIntensityVal').textContent = suggestedIntensity;

    showToast(`IA escolheu: ${match} (intensidade ${suggestedIntensity})`, 'success');

    // Auto-preview
    if (i2vLoadedImage) runI2VPreview();

  } catch (e) {
    showToast('Erro ao analisar prompt: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Escolher efeito com IA';
  }
}

async function generateI2VVideo() {
  if (!i2vLoadedImage) return;
  if (i2vPreviewAnim) { cancelAnimationFrame(i2vPreviewAnim); i2vPreviewAnim = null; }

  const btn = document.getElementById('i2vGenerateBtn');
  const progressDiv = document.getElementById('i2vProgress');
  const progressFill = document.getElementById('i2vProgressFill');
  const progressText = document.getElementById('i2vProgressText');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando video...';
  progressDiv.style.display = 'flex';
  progressFill.style.width = '0%';
  document.getElementById('i2vCanvasOverlay')?.classList.add('hidden');

  const canvas = document.getElementById('i2vCanvas');
  const ctx = canvas.getContext('2d');
  const effect = getI2VEffect();
  const duration = parseInt(document.getElementById('i2vDuration').value);
  const fps = parseInt(document.getElementById('i2vFps')?.value || 30);
  const totalFrames = duration * fps;

  try {
    const stream = canvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 });
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const videoReady = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = reject;
    });

    recorder.start();

    for (let frame = 0; frame <= totalFrames; frame++) {
      const progress = frame / totalFrames;
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      i2vDrawFrame(eased);

      // Update progress bar
      const pct = Math.round((frame / totalFrames) * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = pct + '%';

      await new Promise(r => setTimeout(r, 1000 / fps));
    }

    recorder.stop();
    const videoBlob = await videoReady;
    const videoUrl = URL.createObjectURL(videoBlob);

    // Show result
    document.getElementById('i2vEditor').style.display = 'none';
    const resultVideo = document.getElementById('i2vResultVideo');
    resultVideo.src = videoUrl;
    document.getElementById('i2vDownloadBtn').href = videoUrl;
    document.getElementById('i2vResultEffect').textContent = effect;
    document.getElementById('i2vResultDuration').textContent = duration + 's';
    document.getElementById('i2vResultRes').textContent = `${canvas.width}x${canvas.height}`;
    document.getElementById('i2vResult').style.display = '';

    showToast('Video gerado com sucesso!', 'success');
    saveVideoToGallery(videoBlob, `Image-to-Video (${effect})`, 'Browser Canvas');
    saveToHistory({ type: 'video', prompt: `Image-to-Video: ${effect}, ${i2vCurrentRatio}, ${i2vCurrentFilter}`, provider: 'Browser (Canvas)', status: 'success' });

  } catch (e) {
    showToast('Erro ao gerar video: ' + e.message, 'error');
    console.error('I2V error:', e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-video"></i> Gerar Video';
    progressDiv.style.display = 'none';
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
  setButtonLoading('generateBtnMain', true, 'Gerando...');

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
    setButtonLoading('generateBtnMain', false, 'Gerar');
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
  // Save to gallery
  saveAudioToGallery(blob, text, 'Pollinations TTS');
  saveToHistory({ type: 'audio', prompt: text, provider: 'Pollinations TTS', status: 'success' });
}

// --- HuggingFace TTS ---
async function huggingFaceTTS(text, model) {
  const apiKey = getApiKey('huggingface_api_key');
  if (!apiKey) { openApiKeyModal(); throw new Error('Configure API key do HuggingFace'); }

  showToast(`Gerando audio com ${model.split('/')[1]}...`, 'success');

  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
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
  // Save to gallery
  saveAudioToGallery(blob, text, `HuggingFace ${model.split('/')[1]}`);
  saveToHistory({ type: 'audio', prompt: text, provider: `HuggingFace ${model.split('/')[1]}`, status: 'success' });
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
        const response = await fetch('https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3', {
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
  setButtonLoading('generateBtnMain', true, 'Gerando...');

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
      // Save to gallery
      saveTextToGallery(result, prompt, providerName);
      saveToHistory({ type: 'text', prompt, provider: providerName, status: 'success' });
    }
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
    saveToHistory({ type: 'text', prompt, provider: providerName || 'unknown', status: 'error', detail: e.message });
  } finally {
    setButtonLoading('generateBtnMain', false, 'Gerar');
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
// === STORYBOARD ===
// =============================================
function initStoryboard() {
  // Panel count pills
  document.querySelectorAll('.sb-pill:not(.style-pill)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sb-pill:not(.style-pill)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // Style pills
  document.querySelectorAll('.sb-pill.style-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sb-pill.style-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // Generate button
  document.getElementById('storyboardGenerateBtn')?.addEventListener('click', generateStoryboard);
}

async function generateStoryboard() {
  const storyPrompt = document.getElementById('storyboardPrompt').value.trim();
  if (!storyPrompt) { showToast('Descreva sua historia primeiro', 'error'); return; }

  const panelCount = parseInt(document.querySelector('.sb-pill:not(.style-pill).active')?.dataset.panels || 4);
  const style = document.querySelector('.sb-pill.style-pill.active')?.dataset.style || 'cinematic';
  const grid = document.getElementById('storyboardGrid');
  const btn = document.getElementById('storyboardGenerateBtn');

  // Style descriptions for image prompts
  const styleDesc = {
    cinematic: 'cinematic film still, dramatic lighting, depth of field, 35mm film',
    comic: 'comic book panel, bold outlines, vibrant colors, speech bubbles style',
    anime: 'anime style, detailed illustration, cel shading, vibrant colors',
    watercolor: 'watercolor painting, soft brush strokes, artistic, delicate colors'
  };

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando roteiro...';
  document.getElementById('storyboardEmpty').style.display = 'none';
  grid.innerHTML = '';

  try {
    // Step 1: Use AI to break story into panel descriptions
    showToast('Criando roteiro do storyboard...', 'success');
    const scriptResult = await pollinationsText(
      `INSTRUCAO: Voce e um roteirista de storyboard. Quebre a historia abaixo em exatamente ${panelCount} paineis visuais.

Para cada painel, escreva UMA descricao visual curta em INGLES (maximo 80 palavras) que descreva a CENA visualmente (personagens, acoes, cenario, iluminacao). Nao inclua dialogos.

FORMATO OBRIGATORIO (siga exatamente, sem nada extra):
---PANEL 1---
(descricao visual em ingles)
---PANEL 2---
(descricao visual em ingles)
... ate ---PANEL ${panelCount}---

Historia: ${storyPrompt}`,
      'openai'
    );

    // Parse panels
    const panels = [];
    for (let i = 1; i <= panelCount; i++) {
      const regex = new RegExp(`---PANEL ${i}---\\s*([\\s\\S]*?)(?=---PANEL ${i + 1}---|$)`);
      const match = scriptResult.match(regex);
      if (match) panels.push(match[1].trim());
    }

    if (panels.length === 0) {
      showToast('Erro ao criar roteiro. Tente novamente.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> Gerar Story Board';
      return;
    }

    // Step 2: Create panel cards with loading state
    panels.forEach((desc, i) => {
      const card = document.createElement('div');
      card.className = 'storyboard-panel';
      card.innerHTML = `
        <div class="sb-panel-number">${i + 1}</div>
        <div class="sb-panel-image loading">
          <div class="spinner-ring small"></div>
          <span>Gerando painel ${i + 1}/${panels.length}...</span>
        </div>
        <div class="sb-panel-caption">${desc}</div>
      `;
      grid.appendChild(card);
    });

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando imagens...';
    showToast(`Gerando ${panels.length} paineis... isso pode levar alguns minutos`, 'success');

    // Step 3: Generate images for each panel
    for (let i = 0; i < panels.length; i++) {
      const imagePrompt = `${panels[i]}, ${styleDesc[style]}, storyboard panel, high quality`;
      const card = grid.children[i];
      const imgContainer = card.querySelector('.sb-panel-image');

      try {
        // Try Stable Horde (free, reliable)
        const result = await generateWithStableHorde(imagePrompt, 512, 512);
        if (result?.url) {
          imgContainer.classList.remove('loading');
          imgContainer.innerHTML = `<img src="${result.url}" alt="Panel ${i + 1}">`;
          continue;
        }
      } catch (e) { console.warn(`Panel ${i + 1} Horde failed:`, e); }

      // Fallback: Pollinations
      try {
        const result = await generateWithPollinations(imagePrompt, 'pollinations-default', 512, 512, null, i);
        if (result?.url) {
          imgContainer.classList.remove('loading');
          imgContainer.innerHTML = `<img src="${result.url}" alt="Panel ${i + 1}">`;
          continue;
        }
      } catch (e) { console.warn(`Panel ${i + 1} Pollinations failed:`, e); }

      // Both failed
      imgContainer.classList.remove('loading');
      imgContainer.innerHTML = `<div class="sb-panel-error"><i class="fas fa-exclamation-triangle"></i> Erro</div>`;
    }

    showToast('Story Board gerado!', 'success');
    saveToHistory({ type: 'storyboard', prompt: storyPrompt, provider: 'Stable Horde', status: 'success', detail: `${panels.length} paineis` });

  } catch (e) {
    console.error('Storyboard error:', e);
    showToast('Erro ao gerar storyboard: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Gerar Story Board';
  }
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

// === BILINGUAL DRAG/SWIPE ===
function initBilingualDrag() {
  const handle = document.getElementById('bilingualDragHandle');
  const area = document.getElementById('bilingualArea');
  const collapsible = document.getElementById('bilingualCollapsible');
  if (!handle || !area || !collapsible) return;

  let startY = 0;
  let startHeight = 0;
  let isDragging = false;

  function onStart(e) {
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    // If collapsed, use 0 as start height
    if (area.classList.contains('collapsed')) {
      startHeight = 0;
    } else {
      startHeight = collapsible.scrollHeight;
    }
    collapsible.style.transition = 'none';
    collapsible.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - currentY; // positive = dragging up (expand), negative = dragging down (collapse)
    let newHeight = startHeight + deltaY;
    newHeight = Math.max(0, Math.min(newHeight, 400));
    collapsible.style.maxHeight = newHeight + 'px';
    collapsible.style.opacity = newHeight < 30 ? '0' : '1';
  }

  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    collapsible.style.transition = '';

    const currentHeight = parseInt(collapsible.style.maxHeight) || 0;

    if (currentHeight < 50) {
      // Collapse
      area.classList.add('collapsed');
      collapsible.style.maxHeight = '';
      collapsible.style.opacity = '';
    } else {
      // Expand
      area.classList.remove('collapsed');
      collapsible.style.maxHeight = '';
      collapsible.style.opacity = '';
      collapsible.style.overflow = '';
    }
  }

  // Click on handle to toggle
  handle.addEventListener('click', (e) => {
    if (isDragging) return;
    area.classList.toggle('collapsed');
  });

  // Mouse events
  handle.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);

  // Touch events
  handle.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

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
          <label><i class="fas fa-camera" style="color: #05a081;"></i> Pexels API Key <span style="color:var(--text-muted);">(Moodboard - imagens + videos)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="pexelsKeyInput" placeholder="Cole sua API key do Pexels...">
            <button class="btn-tiny" id="togglePexelsKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://www.pexels.com/api/new/" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-image" style="color: #4ecb71;"></i> Pixabay API Key <span style="color:var(--text-muted);">(Moodboard - imagens + videos)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="pixabayKeyInput" placeholder="Cole sua API key do Pixabay...">
            <button class="btn-tiny" id="togglePixabayKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://pixabay.com/api/docs/" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-camera-retro" style="color: #111;background:#fff;padding:2px 4px;border-radius:3px;"></i> Unsplash API Key <span style="color:var(--text-muted);">(Moodboard - imagens)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="unsplashKeyInput" placeholder="Cole sua Access Key do Unsplash...">
            <button class="btn-tiny" id="toggleUnsplashKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://unsplash.com/developers" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div class="setting-group">
          <label><i class="fas fa-music" style="color: #f59e0b;"></i> Freesound API Key <span style="color:var(--text-muted);">(Moodboard - audio/SFX)</span></label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="freesoundKeyInput" placeholder="Cole sua API key do Freesound...">
            <button class="btn-tiny" id="toggleFreesoundKey"><i class="fas fa-eye"></i></button>
          </div>
          <a href="https://freesound.org/apiv2/apply/" target="_blank" style="color: var(--accent); font-size: 0.75rem;">Criar chave gratis aqui</a>
        </div>

        <div style="margin-top: 12px; padding: 8px 10px; background: linear-gradient(135deg, #c8ff0022, #c8ff0008); border: 1px solid #c8ff0033; border-radius: var(--radius-md);">
          <div class="setting-group" style="margin:0;">
            <label><i class="fas fa-star" style="color: #c8ff00;"></i> Higgsfield Credentials <span style="color:var(--text-muted);">(Imagem - modelos UNLIMITED)</span></label>
            <div style="display: flex; gap: 6px;">
              <input type="password" class="input-field" id="higgsfieldKeyInput" placeholder="Cole KEY_ID:KEY_SECRET do Higgsfield...">
              <button class="btn-tiny" id="toggleHiggsfieldKey"><i class="fas fa-eye"></i></button>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
              Formato: <code style="background:#333;padding:1px 4px;border-radius:3px;">KEY_ID:KEY_SECRET</code> &mdash; Pegue em cloud.higgsfield.ai
            </div>
            <a href="https://cloud.higgsfield.ai" target="_blank" style="color: #c8ff00; font-size: 0.75rem;">Pegar credenciais aqui</a>
          </div>
        </div>

        <div style="margin-top: 10px; padding: 8px 10px; background: var(--accent-subtle); border-radius: var(--radius-md); font-size: 0.75rem; color: var(--text-secondary);">
          <i class="fas fa-shield-halved" style="color: var(--accent);"></i>
          Suas chaves ficam salvas apenas no seu navegador.
          <br><strong>Pollinations.ai</strong> e <strong>Openverse</strong> funcionam sem nenhuma key.
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
      pexels_api_key: document.getElementById('pexelsKeyInput').value.trim(),
      pixabay_api_key: document.getElementById('pixabayKeyInput').value.trim(),
      unsplash_api_key: document.getElementById('unsplashKeyInput').value.trim(),
      freesound_api_key: document.getElementById('freesoundKeyInput').value.trim(),
      higgsfield_credentials: document.getElementById('higgsfieldKeyInput').value.trim()
    };
    for (const [k, v] of Object.entries(keys)) {
      setApiKey(k, v);
    }
    closeApiKeyModal();
    showToast('API keys salvas!', 'success');
    updateApiKeyStatus();
  });

  // Toggle visibility
  ['Gemini', 'Openrouter', 'Groq', 'Together', 'Huggingface', 'Pexels', 'Pixabay', 'Unsplash', 'Freesound', 'Higgsfield'].forEach(name => {
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
  document.getElementById('pixabayKeyInput').value = getApiKey('pixabay_api_key') || '';
  document.getElementById('unsplashKeyInput').value = getApiKey('unsplash_api_key') || '';
  document.getElementById('freesoundKeyInput').value = getApiKey('freesound_api_key') || '';
  document.getElementById('higgsfieldKeyInput').value = getApiKey('higgsfield_credentials') || '';
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
    Pexels: !!getApiKey('pexels_api_key'),
    Higgsfield: !!getApiKey('higgsfield_credentials')
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
let mbSearchPage = 1;
let mbSearchQuery = '';
let currentMBSource = 'pexels';

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

  // Source selector
  document.querySelectorAll('.mb-source').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mb-source').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMBSource = btn.dataset.source;
      const placeholders = {
        'pexels': 'Buscar imagens (Pexels)...',
        'pixabay': 'Buscar imagens (Pixabay)...',
        'unsplash': 'Buscar imagens (Unsplash)...',
        'openverse': 'Buscar imagens (Openverse)...',
        'pexels-video': 'Buscar videos (Pexels)...',
        'pixabay-video': 'Buscar videos (Pixabay)...',
        'freesound': 'Buscar sons (Freesound)...',
        'openverse-audio': 'Buscar audio (Openverse)...'
      };
      document.getElementById('moodboardSearch').placeholder = placeholders[currentMBSource] || 'Buscar...';
    });
  });

  // Search
  document.getElementById('moodboardSearchBtn').addEventListener('click', () => moodboardSearch());
  document.getElementById('moodboardSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') moodboardSearch();
  });
  document.getElementById('moodboardCloseResults').addEventListener('click', () => {
    document.getElementById('moodboardSearchResults').style.display = 'none';
  });
  document.getElementById('moodboardLoadMore').addEventListener('click', () => {
    mbSearchPage++;
    moodboardSearch(true);
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

  // Files Panel
  document.getElementById('moodboardFilesBtn').addEventListener('click', () => {
    togglePanel('moodboardFilesPanel');
    renderMoodboardFiles();
  });
  document.getElementById('moodboardCloseFiles').addEventListener('click', () => {
    document.getElementById('moodboardFilesPanel').style.display = 'none';
  });
  document.querySelectorAll('.mb-file-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mb-file-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMoodboardFiles(btn.dataset.type);
    });
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
  const panels = ['moodboardSearchResults', 'moodboardPalettePanel', 'moodboardFontPanel', 'moodboardFilesPanel'];
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
async function moodboardSearch(append = false) {
  const query = document.getElementById('moodboardSearch').value.trim();
  if (!query) { showToast('Digite algo para buscar', 'error'); return; }
  if (!append) { mbSearchPage = 1; mbSearchQuery = query; }

  togglePanel('moodboardSearchResults');
  document.getElementById('moodboardSearchResults').style.display = '';
  const grid = document.getElementById('moodboardResultsGrid');
  if (!append) grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Buscando...</div>';

  const src = currentMBSource;
  try {
    if (src === 'pexels') await searchPexelsImages(append);
    else if (src === 'pixabay') await searchPixabayImages(append);
    else if (src === 'unsplash') await searchUnsplashImages(append);
    else if (src === 'openverse') await searchOpenverseImages(append);
    else if (src === 'pexels-video') await searchPexelsVideos(append);
    else if (src === 'pixabay-video') await searchPixabayVideos(append);
    else if (src === 'freesound') await searchFreesound(append);
    else if (src === 'openverse-audio') await searchOpenverseAudio(append);
  } catch (e) {
    if (!append) grid.innerHTML = '';
    showToast(e.message, 'error');
  }
}

// --- Pexels Images ---
async function searchPexelsImages(append) {
  const key = getApiKey('pexels_api_key');
  if (!key) { showToast('Configure sua Pexels API Key em Configuracoes', 'error'); return; }
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(mbSearchQuery)}&per_page=20&page=${mbSearchPage}`, { headers: { Authorization: key } });
  if (!res.ok) throw new Error('Erro Pexels: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Pexels: "${mbSearchQuery}" — ${data.total_results} resultados`;
  data.photos.forEach(photo => {
    const card = document.createElement('div');
    card.className = 'moodboard-result-card';
    card.innerHTML = `<img src="${photo.src.medium}" alt="${photo.alt || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${photo.photographer}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => { e.stopPropagation(); addImageToBoard(photo.src.large, photo.photographer, photo.avg_color); });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.next_page ? '' : 'none';
}

// --- Pixabay Images ---
async function searchPixabayImages(append) {
  const key = getApiKey('pixabay_api_key');
  if (!key) { showToast('Configure sua Pixabay API Key em Configuracoes', 'error'); return; }
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(mbSearchQuery)}&image_type=photo&per_page=20&page=${mbSearchPage}`);
  if (!res.ok) throw new Error('Erro Pixabay: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Pixabay: "${mbSearchQuery}" — ${data.totalHits} resultados`;
  data.hits.forEach(img => {
    const card = document.createElement('div');
    card.className = 'moodboard-result-card';
    card.innerHTML = `<img src="${img.webformatURL}" alt="${img.tags}" loading="lazy"><div class="moodboard-result-overlay"><span>${img.user}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => { e.stopPropagation(); addImageToBoard(img.largeImageURL, img.user, null); });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.hits.length === 20 ? '' : 'none';
}

// --- Unsplash Images ---
async function searchUnsplashImages(append) {
  const key = getApiKey('unsplash_api_key');
  if (!key) { showToast('Configure sua Unsplash API Key em Configuracoes', 'error'); return; }
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(mbSearchQuery)}&per_page=20&page=${mbSearchPage}&client_id=${key}`);
  if (!res.ok) throw new Error('Erro Unsplash: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Unsplash: "${mbSearchQuery}" — ${data.total} resultados`;
  data.results.forEach(photo => {
    const card = document.createElement('div');
    card.className = 'moodboard-result-card';
    card.innerHTML = `<img src="${photo.urls.small}" alt="${photo.alt_description || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${photo.user.name}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => { e.stopPropagation(); addImageToBoard(photo.urls.regular, photo.user.name, photo.color); });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.total_pages > mbSearchPage ? '' : 'none';
}

// --- Openverse Images (no key needed) ---
async function searchOpenverseImages(append) {
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(mbSearchQuery)}&page_size=20&page=${mbSearchPage}`);
  if (!res.ok) throw new Error('Erro Openverse: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Openverse: "${mbSearchQuery}" — ${data.result_count} resultados`;
  data.results.forEach(img => {
    const card = document.createElement('div');
    card.className = 'moodboard-result-card';
    card.innerHTML = `<img src="${img.thumbnail || img.url}" alt="${img.title || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${img.creator || 'CC'}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => { e.stopPropagation(); addImageToBoard(img.url, img.creator || 'Creative Commons', null); });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.page_count > mbSearchPage ? '' : 'none';
}

// --- Pexels Videos ---
async function searchPexelsVideos(append) {
  const key = getApiKey('pexels_api_key');
  if (!key) { showToast('Configure sua Pexels API Key em Configuracoes', 'error'); return; }
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(mbSearchQuery)}&per_page=15&page=${mbSearchPage}`, { headers: { Authorization: key } });
  if (!res.ok) throw new Error('Erro Pexels Videos: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Pexels Videos: "${mbSearchQuery}" — ${data.total_results} resultados`;
  data.videos.forEach(video => {
    const thumb = video.image;
    const videoFile = video.video_files.find(f => f.quality === 'sd') || video.video_files[0];
    const card = document.createElement('div');
    card.className = 'moodboard-result-card';
    card.innerHTML = `<div style="position:relative;"><img src="${thumb}" alt="" loading="lazy"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><i class="fas fa-play-circle" style="font-size:2rem;color:rgba(255,255,255,0.85);"></i></div></div><div class="moodboard-result-overlay"><span>${video.user.name}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      moodboardItems.push({ type: 'video', url: videoFile.link, provider: video.user.name, id: Date.now() });
      saveMoodboard(); renderMoodboard();
      showToast('Video adicionado ao board!', 'success');
    });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.total_results > mbSearchPage * 15 ? '' : 'none';
}

// --- Pixabay Videos ---
async function searchPixabayVideos(append) {
  const key = getApiKey('pixabay_api_key');
  if (!key) { showToast('Configure sua Pixabay API Key em Configuracoes', 'error'); return; }
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(mbSearchQuery)}&per_page=15&page=${mbSearchPage}`);
  if (!res.ok) throw new Error('Erro Pixabay Videos: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Pixabay Videos: "${mbSearchQuery}" — ${data.totalHits} resultados`;
  data.hits.forEach(video => {
    const thumb = `https://i.vimeocdn.com/video/${video.picture_id}_295x166.jpg`;
    const videoUrl = video.videos.small?.url || video.videos.medium?.url || video.videos.tiny?.url;
    const card = document.createElement('div');
    card.className = 'moodboard-result-card';
    card.innerHTML = `<div style="position:relative;"><img src="${thumb}" alt="${video.tags}" loading="lazy" onerror="this.style.display='none'"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);"><i class="fas fa-play-circle" style="font-size:2rem;color:rgba(255,255,255,0.85);"></i></div></div><div class="moodboard-result-overlay"><span>${video.user}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      moodboardItems.push({ type: 'video', url: videoUrl, provider: video.user, id: Date.now() });
      saveMoodboard(); renderMoodboard();
      showToast('Video adicionado ao board!', 'success');
    });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.hits.length === 15 ? '' : 'none';
}

// --- Freesound Audio ---
async function searchFreesound(append) {
  const key = getApiKey('freesound_api_key');
  if (!key) { showToast('Configure sua Freesound API Key em Configuracoes', 'error'); return; }
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(mbSearchQuery)}&token=${key}&fields=id,name,previews,duration,tags,username&page_size=20&page=${mbSearchPage}`);
  if (!res.ok) throw new Error('Erro Freesound: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Freesound: "${mbSearchQuery}" — ${data.count} resultados`;
  data.results.forEach(sound => {
    const preview = sound.previews?.['preview-lq-mp3'] || sound.previews?.['preview-hq-mp3'] || '';
    const dur = Math.round(sound.duration);
    const card = document.createElement('div');
    card.className = 'moodboard-result-card moodboard-result-audio';
    card.innerHTML = `
      <div class="mb-audio-result">
        <div class="mb-audio-info">
          <i class="fas fa-music" style="color:var(--green);"></i>
          <div><strong>${sound.name}</strong><br><span style="font-size:0.65rem;color:var(--text-muted);">${sound.username} · ${dur}s</span></div>
        </div>
        <audio controls preload="none" src="${preview}" style="width:100%;height:28px;margin-top:4px;"></audio>
        <button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button>
      </div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      moodboardItems.push({ type: 'audio', url: preview, provider: `Freesound · ${sound.username}`, id: Date.now() });
      saveMoodboard(); renderMoodboard();
      showToast('Audio adicionado ao board!', 'success');
    });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.next ? '' : 'none';
}

// --- Openverse Audio (no key needed) ---
async function searchOpenverseAudio(append) {
  const grid = document.getElementById('moodboardResultsGrid');
  const res = await fetch(`https://api.openverse.org/v1/audio/?q=${encodeURIComponent(mbSearchQuery)}&page_size=20&page=${mbSearchPage}`);
  if (!res.ok) throw new Error('Erro Openverse Audio: ' + res.status);
  const data = await res.json();
  if (!append) grid.innerHTML = '';
  document.getElementById('moodboardResultsTitle').textContent = `Openverse Audio: "${mbSearchQuery}" — ${data.result_count} resultados`;
  data.results.forEach(audio => {
    const preview = audio.url || '';
    const dur = audio.duration ? Math.round(audio.duration / 1000) : '?';
    const card = document.createElement('div');
    card.className = 'moodboard-result-card moodboard-result-audio';
    card.innerHTML = `
      <div class="mb-audio-result">
        <div class="mb-audio-info">
          <i class="fas fa-headphones" style="color:var(--blue);"></i>
          <div><strong>${audio.title || 'Audio'}</strong><br><span style="font-size:0.65rem;color:var(--text-muted);">${audio.creator || 'CC'} · ${dur}s</span></div>
        </div>
        ${preview ? `<audio controls preload="none" src="${preview}" style="width:100%;height:28px;margin-top:4px;"></audio>` : ''}
        <button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button>
      </div>`;
    card.querySelector('.moodboard-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      moodboardItems.push({ type: 'audio', url: preview, provider: `Openverse · ${audio.creator || 'CC'}`, id: Date.now() });
      saveMoodboard(); renderMoodboard();
      showToast('Audio adicionado ao board!', 'success');
    });
    grid.appendChild(card);
  });
  document.getElementById('moodboardLoadMore').style.display = data.page_count > mbSearchPage ? '' : 'none';
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
    } else if (item.type === 'video') {
      el.innerHTML = `
        <video controls style="width:100%; border-radius: var(--radius-sm);">
          <source src="${item.url}" type="video/mp4">
        </video>
        <div class="moodboard-item-info">
          <span><i class="fas fa-video"></i> ${item.provider || 'Video'}</span>
        </div>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'audio') {
      el.innerHTML = `
        <div style="padding:12px; text-align:center;">
          <i class="fas fa-volume-up" style="font-size:1.5rem; color:var(--green); margin-bottom:8px;"></i>
          <audio controls src="${item.url}" style="width:100%;"></audio>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${item.provider || 'Audio'}</div>
        </div>
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
    if (typeof google === 'undefined' || !google.accounts) {
      showToast('Google Sign-In ainda carregando. Tente novamente.', 'error');
      return;
    }
    // Use OAuth2 popup - most reliable across all browsers
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'profile email',
      callback: (response) => {
        if (response.access_token) {
          fetchGoogleUserInfo(response.access_token);
        } else if (response.error) {
          console.error('Google OAuth error:', response.error);
          showToast('Erro no login: ' + response.error, 'error');
        }
      }
    });
    tokenClient.requestAccessToken();
  } catch(e) {
    console.error('Google Login error:', e);
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

// =============================================
// === GALLERY - IndexedDB Storage System ===
// =============================================

let galleryDB = null;
const GALLERY_DB_NAME = 'AIStudioGallery';
const GALLERY_DB_VERSION = 2;
const GALLERY_STORE = 'items';
const HISTORY_STORE = 'history';

function openGalleryDB() {
  return new Promise((resolve, reject) => {
    if (galleryDB) { resolve(galleryDB); return; }
    const req = indexedDB.open(GALLERY_DB_NAME, GALLERY_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(GALLERY_STORE)) {
        const store = db.createObjectStore(GALLERY_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const hStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
        hStore.createIndex('type', 'type', { unique: false });
        hStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = (e) => { galleryDB = e.target.result; resolve(galleryDB); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveToGallery(item) {
  // item: { type: 'image'|'video'|'audio'|'text', prompt, provider, data, mimeType, timestamp }
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GALLERY_STORE, 'readwrite');
    const store = tx.objectStore(GALLERY_STORE);
    item.timestamp = item.timestamp || Date.now();
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getGalleryItems(type) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GALLERY_STORE, 'readonly');
    const store = tx.objectStore(GALLERY_STORE);
    let req;
    if (type && type !== 'all') {
      const idx = store.index('type');
      req = idx.getAll(type);
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => {
      const items = req.result.sort((a, b) => b.timestamp - a.timestamp);
      resolve(items);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteGalleryItem(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GALLERY_STORE, 'readwrite');
    tx.objectStore(GALLERY_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function clearGallery(type) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GALLERY_STORE, 'readwrite');
    const store = tx.objectStore(GALLERY_STORE);
    if (!type || type === 'all') {
      store.clear();
      tx.oncomplete = () => resolve();
    } else {
      const idx = store.index('type');
      const req = idx.openCursor(type);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      tx.oncomplete = () => resolve();
    }
    tx.onerror = (e) => reject(e.target.error);
  });
}

// Save helpers for each content type
async function saveImageToGallery(blobOrUrl, prompt, provider) {
  try {
    let data;
    if (blobOrUrl instanceof Blob) {
      data = blobOrUrl;
    } else {
      const resp = await fetch(blobOrUrl);
      data = await resp.blob();
    }
    await saveToGallery({ type: 'image', prompt, provider, data, mimeType: data.type });
  } catch (e) { console.warn('Gallery save failed:', e); }
}

async function saveVideoToGallery(urlOrBlob, prompt, provider) {
  try {
    let data;
    if (urlOrBlob instanceof Blob) {
      data = urlOrBlob;
    } else {
      // For external URLs, save the URL string
      await saveToGallery({ type: 'video', prompt, provider, data: urlOrBlob, mimeType: 'url' });
      return;
    }
    await saveToGallery({ type: 'video', prompt, provider, data, mimeType: data.type });
  } catch (e) { console.warn('Gallery save failed:', e); }
}

async function saveAudioToGallery(blob, prompt, provider) {
  try {
    await saveToGallery({ type: 'audio', prompt, provider, data: blob, mimeType: blob.type });
  } catch (e) { console.warn('Gallery save failed:', e); }
}

async function saveTextToGallery(text, prompt, provider) {
  try {
    await saveToGallery({ type: 'text', prompt, provider, data: text, mimeType: 'text/plain' });
  } catch (e) { console.warn('Gallery save failed:', e); }
}

// === GALLERY UI ===
let galleryCurrentFilter = 'all';
let galleryListView = false;

function initGallery() {
  // Filter buttons
  document.querySelectorAll('.gallery-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      galleryCurrentFilter = btn.dataset.filter;
      renderGallery();
    });
  });

  // View toggle
  document.getElementById('galleryViewToggle')?.addEventListener('click', () => {
    galleryListView = !galleryListView;
    const grid = document.getElementById('galleryGrid');
    const icon = document.querySelector('#galleryViewToggle i');
    if (galleryListView) {
      grid.classList.add('list-view');
      icon.className = 'fas fa-th-large';
    } else {
      grid.classList.remove('list-view');
      icon.className = 'fas fa-grip-vertical';
    }
  });

  // Clear button
  document.getElementById('galleryClearBtn')?.addEventListener('click', async () => {
    if (!confirm('Limpar toda a galeria? Esta acao nao pode ser desfeita.')) return;
    await clearGallery(galleryCurrentFilter);
    renderGallery();
    showToast('Galeria limpa', 'success');
  });

  // Preview close
  document.getElementById('galleryPreviewClose')?.addEventListener('click', closeGalleryPreview);
  document.getElementById('galleryPreview')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeGalleryPreview();
  });
}

async function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  const empty = document.getElementById('galleryEmpty');
  const countEl = document.getElementById('galleryCount');
  if (!grid) return;

  try {
    const items = await getGalleryItems(galleryCurrentFilter);
    countEl.textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;

    if (items.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      return;
    }

    grid.style.display = '';
    empty.style.display = 'none';
    grid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.dataset.id = item.id;

      const typeLabels = { image: 'Imagem', video: 'Video', audio: 'Audio', text: 'Texto' };
      const timeStr = new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const promptSnippet = (item.prompt || '').substring(0, 60) + ((item.prompt || '').length > 60 ? '...' : '');

      let thumbHTML = '';
      if (item.type === 'image' && item.data instanceof Blob) {
        const url = URL.createObjectURL(item.data);
        thumbHTML = `<img src="${url}" alt="Image" loading="lazy">`;
      } else if (item.type === 'video') {
        thumbHTML = `<i class="fas fa-play-circle thumb-icon"></i>`;
      } else if (item.type === 'audio') {
        thumbHTML = `<i class="fas fa-volume-up thumb-icon"></i>`;
      } else if (item.type === 'text') {
        const preview = (typeof item.data === 'string' ? item.data : '').substring(0, 100);
        thumbHTML = `<div style="padding:10px;font-size:0.7rem;color:var(--text-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;">${preview}</div>`;
      }

      card.innerHTML = `
        <span class="gallery-card-badge type-${item.type}">${typeLabels[item.type]}</span>
        <button class="gallery-card-delete" title="Excluir"><i class="fas fa-trash"></i></button>
        <div class="gallery-card-thumb">${thumbHTML}</div>
        <div class="gallery-card-info">
          <div class="gallery-card-prompt">${promptSnippet || 'Sem prompt'}</div>
          <div class="gallery-card-meta">
            <span>${item.provider || ''}</span>
            <span>${timeStr}</span>
          </div>
        </div>
      `;

      // Delete button
      card.querySelector('.gallery-card-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteGalleryItem(item.id);
        card.remove();
        const remaining = grid.querySelectorAll('.gallery-card').length;
        countEl.textContent = `${remaining} ${remaining === 1 ? 'item' : 'itens'}`;
        if (remaining === 0) { grid.style.display = 'none'; empty.style.display = ''; }
        showToast('Item excluido', 'success');
      });

      // Open preview
      card.addEventListener('click', () => openGalleryPreview(item));

      grid.appendChild(card);
    });
  } catch (e) {
    console.error('Gallery render error:', e);
  }
}

function openGalleryPreview(item) {
  const overlay = document.getElementById('galleryPreview');
  const mediaEl = document.getElementById('galleryPreviewMedia');
  const infoEl = document.getElementById('galleryPreviewInfo');

  let mediaHTML = '';
  if (item.type === 'image' && item.data instanceof Blob) {
    const url = URL.createObjectURL(item.data);
    mediaHTML = `<img src="${url}" alt="Preview">`;
  } else if (item.type === 'video') {
    let src;
    if (item.data instanceof Blob) {
      src = URL.createObjectURL(item.data);
    } else {
      src = item.data; // URL string
    }
    mediaHTML = `<video controls autoplay style="max-width:100%;max-height:70vh;border-radius:var(--radius-md);"><source src="${src}" type="video/mp4"></video>`;
  } else if (item.type === 'audio' && item.data instanceof Blob) {
    const url = URL.createObjectURL(item.data);
    mediaHTML = `<audio controls autoplay src="${url}" style="width:100%;min-width:300px;"></audio>`;
  } else if (item.type === 'text') {
    const escaped = (typeof item.data === 'string' ? item.data : '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    mediaHTML = `<div class="preview-text-content">${escaped}</div>`;
  }

  const timeStr = new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  mediaEl.innerHTML = mediaHTML;
  infoEl.innerHTML = `
    <div class="preview-prompt">${item.prompt || ''}</div>
    <div class="preview-meta">
      <span><i class="fas fa-robot"></i> ${item.provider || ''}</span>
      <span><i class="fas fa-clock"></i> ${timeStr}</span>
    </div>
    <div class="preview-actions">
      ${item.type !== 'text' ? `<button class="preview-action-btn" onclick="downloadGalleryItem(${item.id})"><i class="fas fa-download"></i> Download</button>` : `<button class="preview-action-btn" onclick="copyGalleryText(this)"><i class="fas fa-copy"></i> Copiar</button>`}
      <button class="preview-action-btn btn-delete" onclick="deleteAndClosePreview(${item.id})"><i class="fas fa-trash"></i> Excluir</button>
    </div>
  `;

  overlay.style.display = 'flex';
}

function closeGalleryPreview() {
  const overlay = document.getElementById('galleryPreview');
  overlay.style.display = 'none';
  document.getElementById('galleryPreviewMedia').innerHTML = '';
}

async function deleteAndClosePreview(id) {
  await deleteGalleryItem(id);
  closeGalleryPreview();
  renderGallery();
  showToast('Item excluido', 'success');
}

async function downloadGalleryItem(id) {
  const db = await openGalleryDB();
  const tx = db.transaction(GALLERY_STORE, 'readonly');
  const req = tx.objectStore(GALLERY_STORE).get(id);
  req.onsuccess = () => {
    const item = req.result;
    if (!item) return;
    let url, ext;
    if (item.data instanceof Blob) {
      url = URL.createObjectURL(item.data);
      ext = item.type === 'image' ? 'png' : item.type === 'video' ? 'mp4' : 'mp3';
    } else if (typeof item.data === 'string' && item.mimeType === 'url') {
      url = item.data;
      ext = 'mp4';
    } else return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-${item.type}-${item.id}.${ext}`;
    a.click();
    showToast('Download iniciado!', 'success');
  };
}

function copyGalleryText(btn) {
  const textEl = document.querySelector('.preview-text-content');
  if (textEl) {
    navigator.clipboard.writeText(textEl.textContent).then(() => showToast('Texto copiado!', 'success'));
  }
}

// === MOODBOARD FILES PANEL ===
async function renderMoodboardFiles(filterType) {
  const type = filterType || document.querySelector('.mb-file-filter.active')?.dataset.type || 'all';
  const grid = document.getElementById('moodboardFilesGrid');
  const empty = document.getElementById('moodboardFilesEmpty');
  if (!grid) return;

  try {
    const items = await getGalleryItems(type);
    if (items.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      return;
    }
    grid.style.display = '';
    empty.style.display = 'none';
    grid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'mb-file-card';

      const typeLabels = { image: 'IMG', video: 'VID', audio: 'AUD', text: 'TXT' };
      let thumbHTML = '';

      if (item.type === 'image' && item.data instanceof Blob) {
        const url = URL.createObjectURL(item.data);
        thumbHTML = `<img src="${url}" alt="" loading="lazy">`;
      } else if (item.type === 'video') {
        thumbHTML = `<i class="fas fa-play-circle mb-file-icon"></i>`;
      } else if (item.type === 'audio') {
        thumbHTML = `<i class="fas fa-volume-up mb-file-icon"></i>`;
      } else if (item.type === 'text') {
        const preview = (typeof item.data === 'string' ? item.data : '').substring(0, 80);
        thumbHTML = `<div class="mb-file-text-preview">${preview}</div>`;
      }

      card.innerHTML = `
        ${thumbHTML}
        <span class="mb-file-card-badge type-${item.type}">${typeLabels[item.type]}</span>
        <div class="mb-file-add-icon"><i class="fas fa-plus"></i></div>
      `;

      card.addEventListener('click', () => addGalleryItemToBoard(item));
      grid.appendChild(card);
    });
  } catch (e) {
    console.error('Moodboard files error:', e);
  }
}

function addGalleryItemToBoard(item) {
  if (item.type === 'image' && item.data instanceof Blob) {
    const url = URL.createObjectURL(item.data);
    addImageToBoard(url, item.provider || 'Galeria', null);
  } else if (item.type === 'video') {
    let url = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
    moodboardItems.push({ type: 'video', url, provider: item.provider || '', id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Video adicionado ao board!', 'success');
  } else if (item.type === 'audio' && item.data instanceof Blob) {
    const url = URL.createObjectURL(item.data);
    moodboardItems.push({ type: 'audio', url, provider: item.provider || '', id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Audio adicionado ao board!', 'success');
  } else if (item.type === 'text') {
    const text = typeof item.data === 'string' ? item.data.substring(0, 200) : '';
    moodboardItems.push({ type: 'note', text: `[${item.provider}] ${text}`, id: Date.now() });
    saveMoodboard();
    renderMoodboard();
    showToast('Texto adicionado como nota!', 'success');
  }
}

// =============================================
// === HISTORY - Generation Log System ===
// =============================================

async function saveToHistory(entry) {
  // entry: { type, prompt, provider, status, detail, thumbnail (optional blob) }
  try {
    const db = await openGalleryDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    entry.timestamp = Date.now();
    tx.objectStore(HISTORY_STORE).add(entry);
  } catch (e) { console.warn('History save failed:', e); }
}

async function getHistoryItems(type) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    let req;
    if (type && type !== 'all') {
      req = store.index('type').getAll(type);
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteHistoryItem(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function clearHistory(type) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    if (!type || type === 'all') {
      store.clear();
    } else {
      const req = store.index('type').openCursor(type);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// History UI
let historyCurrentFilter = 'all';

function initHistory() {
  document.querySelectorAll('.history-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      historyCurrentFilter = btn.dataset.filter;
      renderHistory();
    });
  });

  document.getElementById('historyClearBtn')?.addEventListener('click', async () => {
    if (!confirm('Limpar todo o historico? Esta acao nao pode ser desfeita.')) return;
    await clearHistory(historyCurrentFilter);
    renderHistory();
    showToast('Historico limpo', 'success');
  });
}

async function renderHistory() {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  const countEl = document.getElementById('historyCount');
  if (!list) return;

  try {
    const items = await getHistoryItems(historyCurrentFilter);
    countEl.textContent = `${items.length} ${items.length === 1 ? 'registro' : 'registros'}`;

    if (items.length === 0) {
      list.style.display = 'none';
      empty.style.display = '';
      return;
    }

    list.style.display = '';
    empty.style.display = 'none';
    list.innerHTML = '';

    const typeIcons = {
      image: 'fa-image', video: 'fa-video', audio: 'fa-headphones',
      text: 'fa-font', moodboard: 'fa-palette'
    };
    const typeLabels = {
      image: 'Imagem', video: 'Video', audio: 'Audio',
      text: 'Texto', moodboard: 'Moodboard'
    };

    let lastDate = '';

    items.forEach(item => {
      const d = new Date(item.timestamp);
      const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

      // Date separator
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        const sep = document.createElement('div');
        sep.className = 'history-date-separator';
        sep.innerHTML = `<i class="fas fa-calendar-day"></i> ${dateStr}`;
        list.appendChild(sep);
      }

      const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const promptSnippet = (item.prompt || '').substring(0, 80) + ((item.prompt || '').length > 80 ? '...' : '');

      const el = document.createElement('div');
      el.className = 'history-item';

      let thumbHTML = '';
      if (item.thumbnail instanceof Blob) {
        thumbHTML = `<img src="${URL.createObjectURL(item.thumbnail)}" alt="">`;
      } else {
        thumbHTML = `<i class="fas ${typeIcons[item.type] || 'fa-file'}" style="color:var(--text-muted);"></i>`;
      }

      el.innerHTML = `
        <div class="history-item-icon type-${item.type}">
          <i class="fas ${typeIcons[item.type] || 'fa-file'}"></i>
        </div>
        <div class="history-item-body">
          <div class="history-item-prompt">${promptSnippet || 'Sem prompt'}</div>
          <div class="history-item-meta">
            <span><i class="fas fa-tag"></i> ${typeLabels[item.type] || item.type}</span>
            <span><i class="fas fa-robot"></i> ${item.provider || ''}</span>
            <span><i class="fas fa-clock"></i> ${timeStr}</span>
            ${item.detail ? `<span><i class="fas fa-info-circle"></i> ${item.detail}</span>` : ''}
          </div>
        </div>
        <div class="history-item-thumb">${thumbHTML}</div>
        <div class="history-item-actions">
          <button class="history-item-action" title="Reutilizar prompt"><i class="fas fa-redo"></i></button>
          <button class="history-item-action btn-delete" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      `;

      // Reuse prompt
      el.querySelector('.history-item-action:not(.btn-delete)').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('promptInput').value = item.prompt || '';
        const tabMap = { image: 'image', video: 'video', audio: 'audio', text: 'text', moodboard: 'moodboard' };
        switchTab(tabMap[item.type] || 'image');
        showToast('Prompt carregado!', 'success');
      });

      // Delete
      el.querySelector('.btn-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteHistoryItem(item.id);
        el.remove();
        const remaining = list.querySelectorAll('.history-item').length;
        countEl.textContent = `${remaining} ${remaining === 1 ? 'registro' : 'registros'}`;
        if (remaining === 0) {
          list.style.display = 'none';
          empty.style.display = '';
          // Remove date separators
          list.querySelectorAll('.history-date-separator').forEach(s => s.remove());
        }
      });

      list.appendChild(el);
    });
  } catch (e) {
    console.error('History render error:', e);
  }
}

// Init gallery + history on load
document.addEventListener('DOMContentLoaded', () => {
  openGalleryDB().catch(e => console.warn('IndexedDB init:', e));
  initGallery();
  initHistory();
});
