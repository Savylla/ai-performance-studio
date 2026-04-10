// === AI Performance Studio - Main Application ===

// Security: sanitize strings before innerHTML injection
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Performance: revoke blob URLs in a container before clearing to prevent memory leaks
function revokeBlobUrls(container) {
  if (!container) return;
  container.querySelectorAll('img[src^="blob:"], video[src^="blob:"], audio[src^="blob:"], source[src^="blob:"]').forEach(el => {
    try { URL.revokeObjectURL(el.src || el.getAttribute('src')); } catch(e) {}
  });
}

let currentTab = 'image';
let syncTimeout = null;

// === USER-SCOPED API KEY STORAGE ===
const API_KEY_NAMES = [
  'gemini_api_key', 'openrouter_api_key', 'groq_api_key',
  'together_api_key', 'huggingface_api_key', 'pexels_api_key',
  'pixabay_api_key', 'unsplash_api_key', 'freesound_api_key'
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
  initTrash();
  initDecupagem();
  initGoogleAuth();
});

// === TAB MANAGEMENT ===
function initTabs() {
  // Topbar tabs
  document.querySelectorAll('.topbar-link[data-tab]').forEach(link => {
    link.setAttribute('role', 'tab');
    link.setAttribute('aria-selected', link.classList.contains('active') ? 'true' : 'false');
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
  document.querySelectorAll('.topbar-link').forEach(l => { l.classList.remove('active'); l.setAttribute('aria-selected', 'false'); });
  const activeLink = document.querySelector(`.topbar-link[data-tab="${tab}"]`);
  if (activeLink) { activeLink.classList.add('active'); activeLink.setAttribute('aria-selected', 'true'); }
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
  if (['gallery', 'history', 'storyboard', 'trash', 'folders', 'biblioteca', 'decupagem'].includes(tab)) {
    bottomBar.style.display = 'none';
  } else {
    bottomBar.style.display = '';
  }
  // Show/hide shared bottom row for generation tabs
  const sharedRow = document.getElementById('sharedBottomRow');
  if (sharedRow) {
    sharedRow.style.display = ['gallery', 'history', 'storyboard', 'trash', 'folders', 'biblioteca', 'decupagem'].includes(tab) ? 'none' : '';
  }
  // Render biblioteca when switching to it
  if (tab === 'biblioteca' && typeof renderBiblioteca === 'function') {
    renderBiblioteca();
  }
  // Render trash when switching to it
  if (tab === 'trash') renderTrash();
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
  if (tab === 'folders') renderFoldersPage();
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
    if (!textarea.dataset.manualResize) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  });

  // Prompt resize handle - drag to expand
  const resizeHandle = document.getElementById('promptResizeHandle');
  const promptWrap = document.querySelector('.prompt-input-wrap');
  if (resizeHandle) {
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      startHeight = textarea.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const diff = startY - e.clientY;
      const newHeight = Math.max(36, Math.min(window.innerHeight * 0.5, startHeight + diff));
      textarea.style.height = newHeight + 'px';
      textarea.dataset.manualResize = 'true';
      // Switch to rounded corners when expanded
      if (newHeight > 60) {
        promptWrap.style.borderRadius = 'var(--radius-lg)';
      } else {
        promptWrap.style.borderRadius = '';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    // Touch support
    resizeHandle.addEventListener('touchstart', (e) => {
      isDragging = true;
      startY = e.touches[0].clientY;
      startHeight = textarea.offsetHeight;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const diff = startY - e.touches[0].clientY;
      const newHeight = Math.max(36, Math.min(window.innerHeight * 0.5, startHeight + diff));
      textarea.style.height = newHeight + 'px';
      textarea.dataset.manualResize = 'true';
      if (newHeight > 60) {
        promptWrap.style.borderRadius = 'var(--radius-lg)';
      } else {
        promptWrap.style.borderRadius = '';
      }
    }, { passive: true });

    document.addEventListener('touchend', () => { isDragging = false; });

    // Double-click to reset
    resizeHandle.addEventListener('dblclick', () => {
      textarea.style.height = '';
      textarea.dataset.manualResize = '';
      promptWrap.style.borderRadius = '';
    });
  }

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

  document.getElementById('langPT').addEventListener('click', async () => {
    const langPT = document.getElementById('langPT');
    const langEN = document.getElementById('langEN');
    const promptInput = document.getElementById('promptInput');
    const mainText = promptInput.value.trim();
    langPT.classList.add('active');
    langEN.classList.remove('active');
    showBilingualArea();
    // Translate prompt to Portuguese if there's text
    if (mainText) {
      langPT.disabled = true;
      langPT.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        const translated = await translateText(mainText, 'en-pt');
        if (translated) {
          promptInput.value = translated;
          document.getElementById('promptPT').value = translated;
          document.getElementById('promptEN').value = mainText;
        }
      } catch (e) { console.warn('Translation failed:', e); }
      langPT.disabled = false;
      langPT.textContent = 'PT';
    }
  });
  document.getElementById('langEN').addEventListener('click', async () => {
    const langPT = document.getElementById('langPT');
    const langEN = document.getElementById('langEN');
    const promptInput = document.getElementById('promptInput');
    const mainText = promptInput.value.trim();
    langEN.classList.add('active');
    langPT.classList.remove('active');
    showBilingualArea();
    // Translate prompt to English if there's text
    if (mainText) {
      langEN.disabled = true;
      langEN.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        const translated = await translateText(mainText, 'pt-en');
        if (translated) {
          promptInput.value = translated;
          document.getElementById('promptEN').value = translated;
          document.getElementById('promptPT').value = mainText;
        }
      } catch (e) { console.warn('Translation failed:', e); }
      langEN.disabled = false;
      langEN.textContent = 'EN';
    }
  });

  // PT textarea edit -> auto sync to EN only (never touch main prompt)
  document.getElementById('promptPT').addEventListener('input', () => {
    clearTimeout(syncTimeout);
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando PT...';
    syncStatus.className = 'bilingual-sync';
    syncTimeout = setTimeout(() => syncPTtoEN(), 3000);
  });

  // EN textarea edit -> auto sync to PT only (never touch main prompt)
  document.getElementById('promptEN').addEventListener('input', () => {
    clearTimeout(syncTimeout);
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando EN...';
    syncStatus.className = 'bilingual-sync';
    syncTimeout = setTimeout(() => syncENtoPT(), 3000);
  });

  // Prompt field edit -> mirror to active language field + translate other (no write-back)
  let promptSyncTimeout;
  document.getElementById('promptInput').addEventListener('input', () => {
    const biArea = document.getElementById('bilingualArea');
    if (biArea.style.display === 'none' || biArea.classList.contains('collapsed')) return;
    clearTimeout(promptSyncTimeout);
    clearTimeout(syncTimeout);
    const isPT = document.getElementById('langPT').classList.contains('active');
    const promptText = document.getElementById('promptInput').value;
    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<i class="fas fa-pencil"></i> Editando...';
    syncStatus.className = 'bilingual-sync';
    if (isPT) {
      document.getElementById('promptPT').value = promptText;
      promptSyncTimeout = setTimeout(() => syncPTtoEN(), 3000);
    } else {
      document.getElementById('promptEN').value = promptText;
      promptSyncTimeout = setTimeout(() => syncENtoPT(), 3000);
    }
  });

  // Sync status click -> retry translation
  document.getElementById('syncStatus').addEventListener('click', () => {
    const isPT = document.getElementById('langPT').classList.contains('active');
    if (isPT) {
      syncPTtoEN();
    } else {
      syncENtoPT();
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
const GEMINI_TEXT_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite'];

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

  const enhanceInstruction = `You are a prompt engineer. Improve the prompt below for AI image generation, making it more detailed and professional.

Return the result in EXACTLY this format (nothing else):
---PT---
(improved prompt in Brazilian Portuguese)
---EN---
(improved prompt in English)

STRICT RULES:
- Output ONLY the format above, no explanations or introductions
- Both versions must have the same meaning and similar length
- Do NOT repeat or duplicate sentences within each version
- Keep the original intent, just make it more detailed

Original prompt: ${original}`;

  try {
    let result = null;

    // Provider 1: Pollinations
    try {
      result = await pollinationsText(enhanceInstruction, 'openai', { temperature: 0.4 });
    } catch (e) { console.warn('Enhance: Pollinations failed:', e.message); }

    // Provider 2: Gemini (if key available)
    if (!result) {
      const geminiKey = getApiKey('gemini_api_key');
      if (geminiKey) {
        try {
          result = await callGemini(enhanceInstruction, geminiKey);
        } catch (e) { console.warn('Enhance: Gemini failed:', e.message); }
      }
    }

    // Provider 3: Groq (if key available)
    if (!result) {
      const groqKey = getApiKey('groq_api_key');
      if (groqKey) {
        try {
          result = await groqText(enhanceInstruction, groqKey, 'llama-3.3-70b-versatile');
        } catch (e) { console.warn('Enhance: Groq failed:', e.message); }
      }
    }

    // Provider 4: OpenRouter (if key available)
    if (!result) {
      const orKey = getApiKey('openrouter_api_key');
      if (orKey) {
        try {
          result = await openRouterText(enhanceInstruction, orKey, 'google/gemini-2.0-flash-001');
        } catch (e) { console.warn('Enhance: OpenRouter failed:', e.message); }
      }
    }

    if (!result) throw new Error('Nenhum provedor conseguiu melhorar o prompt. Tente novamente.');

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

let syncRequestId = 0;
const translationCache = new Map();
const TRANSLATION_CACHE_MAX = 50;

function cleanTranslationResponse(text) {
  if (!text) return '';
  let cleaned = text.trim();
  // Remove common AI prefixes
  cleaned = cleaned.replace(/^(Here'?s?\s*(the\s*)?translation:?\s*|Translation:?\s*|Tradu[cç][aã]o:?\s*|Aqui est[aá]\s*(a\s*)?tradu[cç][aã]o:?\s*)/i, '');
  // Remove surrounding quotes
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```[\s\S]*?\n([\s\S]*?)```$/gm, '$1');
  return cleaned.trim();
}

// Dedicated translation function with multiple providers and smart fallback
async function translateText(text, direction) {
  const cacheKey = `${direction}:${text}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const isPTtoEN = direction === 'pt-en';
  const systemPrompt = isPTtoEN
    ? 'Translate Brazilian Portuguese to English. Output ONLY the translation. Keep the same tone and style. Maintain AI/technical terms.'
    : 'Traduza ingles para portugues brasileiro. Retorne SOMENTE a traducao. Mantenha o mesmo tom e estilo. Mantenha termos tecnicos de IA.';

  // Strategy 1: Pollinations OpenAI-compatible endpoint (multiple models)
  const models = ['openai', 'mistral', 'llama'];
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.15
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const result = cleanTranslationResponse(content);
          if (result) {
            // Cache the result
            if (translationCache.size >= TRANSLATION_CACHE_MAX) {
              const firstKey = translationCache.keys().next().value;
              translationCache.delete(firstKey);
            }
            translationCache.set(cacheKey, result);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn(`translateText: model=${model} failed:`, err.message);
    }
  }

  // Strategy 2: Pollinations GET fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const fullPrompt = `${systemPrompt}\n\n${text}`;
    const encoded = encodeURIComponent(fullPrompt.slice(0, 2000));
    const response = await fetch(`https://text.pollinations.ai/${encoded}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const result = cleanTranslationResponse(await response.text());
      if (result) {
        if (translationCache.size >= TRANSLATION_CACHE_MAX) {
          const firstKey = translationCache.keys().next().value;
          translationCache.delete(firstKey);
        }
        translationCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) { console.warn('translateText: GET fallback failed:', e.message); }

  // Strategy 3: Gemini fallback (if key available)
  const geminiKey = getApiKey('gemini_api_key');
  if (geminiKey) {
    try {
      const geminiResult = await callGemini(`${systemPrompt}\n\n${text}`, geminiKey);
      if (geminiResult) {
        const result = cleanTranslationResponse(geminiResult);
        if (result) {
          if (translationCache.size >= TRANSLATION_CACHE_MAX) {
            const firstKey = translationCache.keys().next().value;
            translationCache.delete(firstKey);
          }
          translationCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (e) { console.warn('translateText: Gemini fallback failed:', e.message); }
  }

  throw new Error('Translation failed');
}

async function syncPTtoEN(autoRetry = 2) {
  const ptText = document.getElementById('promptPT').value.trim();
  if (!ptText) return;
  const currentRequest = ++syncRequestId;
  const syncStatus = document.getElementById('syncStatus');
  syncStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduzindo PT→EN...';
  syncStatus.className = 'bilingual-sync syncing';
  for (let attempt = 0; attempt <= autoRetry; attempt++) {
    try {
      if (currentRequest !== syncRequestId) return;
      const enText = await translateText(ptText, 'pt-en');
      if (currentRequest !== syncRequestId) return;
      if (enText) {
        document.getElementById('promptEN').value = enText;
        syncStatus.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
        syncStatus.className = 'bilingual-sync';
        return;
      }
    } catch (error) {
      if (currentRequest !== syncRequestId) return;
      console.warn(`syncPTtoEN attempt ${attempt + 1}/${autoRetry + 1} failed:`, error.message);
      if (attempt < autoRetry) {
        syncStatus.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tentando novamente (${attempt + 2}/${autoRetry + 1})...`;
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
    }
  }
  if (currentRequest !== syncRequestId) return;
  syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro - clique para tentar';
  syncStatus.className = 'bilingual-sync error';
}

async function syncENtoPT(autoRetry = 2) {
  const enText = document.getElementById('promptEN').value.trim();
  if (!enText) return;
  const currentRequest = ++syncRequestId;
  const syncStatus = document.getElementById('syncStatus');
  syncStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduzindo EN→PT...';
  syncStatus.className = 'bilingual-sync syncing';
  for (let attempt = 0; attempt <= autoRetry; attempt++) {
    try {
      if (currentRequest !== syncRequestId) return;
      const ptText = await translateText(enText, 'en-pt');
      if (currentRequest !== syncRequestId) return;
      if (ptText) {
        document.getElementById('promptPT').value = ptText;
        syncStatus.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
        syncStatus.className = 'bilingual-sync';
        return;
      }
    } catch (error) {
      if (currentRequest !== syncRequestId) return;
      console.warn(`syncENtoPT attempt ${attempt + 1}/${autoRetry + 1} failed:`, error.message);
      if (attempt < autoRetry) {
        syncStatus.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tentando novamente (${attempt + 2}/${autoRetry + 1})...`;
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
    }
  }
  if (currentRequest !== syncRequestId) return;
  syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro - clique para tentar';
  syncStatus.className = 'bilingual-sync error';
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
    const model = provider.replace('higgs-', '').replace(/-/g, '_');
    openHiggsfield(model === 'nano_banana' ? 'nano_banana' : provider.replace('higgs-', ''));
    return;
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
      const providerLabel = provider;
      card.innerHTML = `
        <img src="${imgSrc}" alt="Generated" crossorigin="anonymous">
        <div class="result-card-overlay">
          <button title="Download" onclick="event.stopPropagation(); downloadImage('${imgSrc}', 'ai-image-${Date.now()}.png')"><i class="fas fa-download"></i></button>
          <button title="Favoritar" onclick="event.stopPropagation(); this.style.color='var(--accent)'"><i class="fas fa-heart"></i></button>
          <button title="Deletar" onclick="event.stopPropagation(); this.closest('.result-card').remove();" style="color:#ff4444;"><i class="fas fa-trash"></i></button>
        </div>
        <div class="result-card-provider">${escapeHtml(providerLabel)}</div>
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
      const providerLabel = provider;
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

// --- Higgsfield (UNLIMITED via iframe/popup) ---
const HIGGSFIELD_MODELS = {
  'nano_banana': 'Nano Banana',
  'soul': 'Higgsfield Soul',
  'seedream': 'Seedream 4.0',
  'gpt': 'GPT Image 1.5',
  'z-image': 'Z-Image',
  'kling': 'Kling O1',
  'flux-pro': 'FLUX.2 Pro'
};

function repositionImporterWidgets() {
  const higgsWidget = document.getElementById('higgsfieldImporter');
  const tiktokWidget = document.getElementById('tiktokImporter');
  const gap = 12;
  const margin = 16;

  if (higgsWidget && tiktokWidget) {
    // Both open: side by side on the right
    const higgsW = higgsWidget.offsetWidth || 340;
    const tiktokW = tiktokWidget.offsetWidth || 340;
    higgsWidget.style.left = (window.innerWidth - margin - higgsW) + 'px';
    higgsWidget.style.top = '70px';
    tiktokWidget.style.left = (window.innerWidth - margin - higgsW - gap - tiktokW) + 'px';
    tiktokWidget.style.top = '70px';
  } else if (higgsWidget) {
    higgsWidget.style.left = (window.innerWidth - margin - (higgsWidget.offsetWidth || 340)) + 'px';
    higgsWidget.style.top = '70px';
  } else if (tiktokWidget) {
    tiktokWidget.style.left = (window.innerWidth - margin - (tiktokWidget.offsetWidth || 340)) + 'px';
    tiktokWidget.style.top = '70px';
  }
}

function closeImporterWidget(id) {
  const el = document.getElementById(id);
  if (el) {
    if (el._cleanup) el._cleanup();
    if (el._abortController) el._abortController.abort();
    el.remove();
  }
  repositionImporterWidgets();
}

function openHiggsfield(model) {
  const modelName = HIGGSFIELD_MODELS[model] || model;
  const url = `https://higgsfield.ai/image/${model}`;

  // Open as popup window
  const w = Math.min(1400, screen.width - 100);
  const h = Math.min(900, screen.height - 100);
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  window.open(url, 'higgsfield', `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);

  // Show import widget
  showHiggsfieldImporter(modelName);
}

function showHiggsfieldImporter(modelName) {
  // Remove existing
  const existing = document.getElementById('higgsfieldImporter');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'higgsfieldImporter';
  widget.style.cssText = 'position:fixed;top:70px;z-index:9999;width:340px;background:#1a1a1a;border:2px solid #c8ff00;border-radius:16px;padding:16px;box-shadow:0 8px 32px rgba(200,255,0,0.15);font-family:inherit;';
  widget.innerHTML = `
    <div id="higgsDragHandle" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;cursor:grab;user-select:none;">
      <span style="color:#c8ff00;font-weight:700;font-size:0.9rem;"><i class="fas fa-star"></i> Importar do Higgsfield</span>
      <button onclick="event.stopPropagation();closeImporterWidget('higgsfieldImporter')" style="background:none;border:none;color:#666;cursor:pointer;font-size:1.1rem;padding:0 4px;">✕</button>
    </div>
    <div id="higgsDropZone" style="border:2px dashed #c8ff0055;border-radius:12px;padding:24px 12px;text-align:center;cursor:pointer;transition:all 0.2s;">
      <i class="fas fa-paste" style="font-size:1.8rem;color:#c8ff00;margin-bottom:8px;display:block;"></i>
      <div style="color:#ccc;font-size:0.82rem;line-height:1.5;">
        <strong style="color:#fff;">Ctrl+V</strong> para colar imagem<br>
        ou <strong style="color:#fff;">arraste</strong> a imagem aqui<br>
        ou <strong style="color:#fff;">clique</strong> para escolher arquivo
      </div>
      <input type="file" id="higgsFileInput" accept="image/*" style="display:none;">
    </div>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
      <input type="text" id="higgsImportModel" class="input-field" value="${modelName}" placeholder="Modelo (ex: Nano Banana)" style="font-size:0.8rem;padding:6px 10px;">
      <input type="text" id="higgsImportPrompt" class="input-field" placeholder="Prompt usado (opcional)" style="font-size:0.8rem;padding:6px 10px;">
    </div>
    <div id="higgsPreview" style="display:none;margin-top:10px;text-align:center;">
      <img id="higgsPreviewImg" style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid #333;">
      <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;">
        <button id="higgsSaveBtn" style="background:#c8ff00;color:#000;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.82rem;"><i class="fas fa-check"></i> Salvar na Galeria</button>
        <button onclick="document.getElementById('higgsPreview').style.display='none';document.getElementById('higgsDropZone').style.display='block';" style="background:#333;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.82rem;">Trocar</button>
      </div>
    </div>
    <div style="margin-top:8px;color:#555;font-size:0.65rem;text-align:center;">
      Modelo: <strong style="color:#c8ff00;">${modelName}</strong> | Salva na Galeria + Historico
    </div>
  `;
  document.body.appendChild(widget);
  repositionImporterWidgets();

  // Drag functionality with AbortController for cleanup
  const ac = new AbortController();
  widget._abortController = ac;
  const dragHandle = document.getElementById('higgsDragHandle');
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragOffsetX = e.clientX - widget.getBoundingClientRect().left;
    dragOffsetY = e.clientY - widget.getBoundingClientRect().top;
    dragHandle.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;
    newX = Math.max(0, Math.min(newX, window.innerWidth - widget.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - widget.offsetHeight));
    widget.style.left = newX + 'px';
    widget.style.top = newY + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }, { signal: ac.signal });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
    }
  }, { signal: ac.signal });
  // Touch support for mobile
  dragHandle.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    const touch = e.touches[0];
    dragOffsetX = touch.clientX - widget.getBoundingClientRect().left;
    dragOffsetY = touch.clientY - widget.getBoundingClientRect().top;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    let newX = touch.clientX - dragOffsetX;
    let newY = touch.clientY - dragOffsetY;
    newX = Math.max(0, Math.min(newX, window.innerWidth - widget.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - widget.offsetHeight));
    widget.style.left = newX + 'px';
    widget.style.top = newY + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }, { passive: true, signal: ac.signal });
  document.addEventListener('touchend', () => { isDragging = false; }, { signal: ac.signal });

  const dropZone = document.getElementById('higgsDropZone');
  const fileInput = document.getElementById('higgsFileInput');
  const preview = document.getElementById('higgsPreview');
  const previewImg = document.getElementById('higgsPreviewImg');
  let importedBlob = null;

  // Click to select file
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleImportedImage(e.target.files[0]);
  });

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#c8ff00';
    dropZone.style.background = '#c8ff0011';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#c8ff0055';
    dropZone.style.background = 'none';
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#c8ff0055';
    dropZone.style.background = 'none';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImportedImage(file);
    } else {
      // Try to get image from HTML drag
      const html = e.dataTransfer.getData('text/html');
      const match = html?.match(/src="([^"]+)"/);
      if (match) handleImportedUrl(match[1]);
    }
  });

  // Paste (Ctrl+V)
  const pasteHandler = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        handleImportedImage(item.getAsFile());
        return;
      }
    }
    // Check for pasted URL
    const text = e.clipboardData.getData('text');
    if (text && (text.startsWith('http') && (text.includes('.png') || text.includes('.jpg') || text.includes('.webp') || text.includes('image')))) {
      e.preventDefault();
      handleImportedUrl(text);
    }
  };
  document.addEventListener('paste', pasteHandler);

  // Store cleanup function
  widget._cleanup = () => document.removeEventListener('paste', pasteHandler);
  const origRemove = widget.remove.bind(widget);
  widget.remove = () => { widget._cleanup(); origRemove(); };

  function handleImportedImage(file) {
    importedBlob = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    dropZone.style.display = 'none';
    preview.style.display = 'block';
  }

  async function handleImportedUrl(url) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      handleImportedImage(blob);
    } catch {
      showToast('Nao consegui carregar a imagem da URL', 'error');
    }
  }

  // Save button
  document.getElementById('higgsSaveBtn').addEventListener('click', async () => {
    if (!importedBlob) return;
    const prompt = document.getElementById('higgsImportPrompt').value.trim() || 'Higgsfield generation';
    const importModel = document.getElementById('higgsImportModel').value.trim() || modelName;
    const provider = `Higgsfield ${importModel}`;
    const imgUrl = URL.createObjectURL(importedBlob);

    // Save to gallery
    await saveImageToGallery(importedBlob, prompt, provider);
    // Save to history
    await saveToHistory({ type: 'image', prompt, provider, status: 'success', detail: 'Importado do Higgsfield' });

    // Also show in results grid
    const grid = document.getElementById('resultsMasonry');
    if (grid) {
      document.getElementById('displayEmpty').style.display = 'none';
      document.getElementById('displayResults').style.display = 'block';
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <img src="${imgUrl}" alt="Higgsfield" crossorigin="anonymous">
        <div class="result-card-overlay">
          <button title="Download" onclick="event.stopPropagation(); downloadImage('${imgUrl}', 'higgsfield-${Date.now()}.png')"><i class="fas fa-download"></i></button>
          <button title="Favoritar" onclick="event.stopPropagation(); this.style.color='var(--accent)'"><i class="fas fa-heart"></i></button>
          <button title="Deletar" onclick="event.stopPropagation(); this.closest('.result-card').remove();" style="color:#ff4444;"><i class="fas fa-trash"></i></button>
        </div>
        <div class="result-card-provider">${provider}</div>
      `;
      card.addEventListener('click', () => openLightbox(imgUrl, prompt, '1:1'));
      grid.insertBefore(card, grid.firstChild);
    }

    showToast(`Imagem salva na Galeria! (${provider})`, 'success');

    // Reset for next import
    importedBlob = null;
    preview.style.display = 'none';
    dropZone.style.display = 'block';
    document.getElementById('higgsImportPrompt').value = '';
  });
}

// --- TikTok Creative Studio (UNLIMITED via popup) ---
function openTikTokStudio() {
  const url = 'https://ads.tiktok.com/creative/creativestudio/image-to-video?subApp=CreativeStudio/ImageGeneration/I2VImageGeneration';
  const w = Math.min(1400, screen.width - 100);
  const h = Math.min(900, screen.height - 100);
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  window.open(url, 'tiktokstudio', `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);
  showTikTokImporter();
}

function showTikTokImporter() {
  const existing = document.getElementById('tiktokImporter');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'tiktokImporter';
  widget.style.cssText = 'position:fixed;top:70px;z-index:9999;width:340px;background:#1a1a1a;border:2px solid #ff0044;border-radius:16px;padding:16px;box-shadow:0 8px 32px rgba(255,0,68,0.15);font-family:inherit;';
  widget.innerHTML = `
    <div id="tiktokDragHandle" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;cursor:grab;user-select:none;">
      <span style="color:#ff0044;font-weight:700;font-size:0.9rem;"><i class="fab fa-tiktok"></i> Importar do TikTok Studio</span>
      <button onclick="event.stopPropagation();closeImporterWidget('tiktokImporter')" style="background:none;border:none;color:#666;cursor:pointer;font-size:1.1rem;padding:0 4px;">✕</button>
    </div>
    <div id="tiktokDropZone" style="border:2px dashed #ff004455;border-radius:12px;padding:24px 12px;text-align:center;cursor:pointer;transition:all 0.2s;">
      <i class="fas fa-paste" style="font-size:1.8rem;color:#ff0044;margin-bottom:8px;display:block;"></i>
      <div style="color:#ccc;font-size:0.82rem;line-height:1.5;">
        <strong style="color:#fff;">Arraste</strong> o video aqui<br>
        ou <strong style="color:#fff;">clique</strong> para escolher arquivo
      </div>
      <input type="file" id="tiktokFileInput" accept="video/*" style="display:none;">
    </div>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
      <input type="text" id="tiktokImportPrompt" class="input-field" placeholder="Prompt usado (opcional)" style="font-size:0.8rem;padding:6px 10px;">
    </div>
    <div id="tiktokPreview" style="display:none;margin-top:10px;text-align:center;">
      <video id="tiktokPreviewVid" style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid #333;" controls></video>
      <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;">
        <button id="tiktokSaveBtn" style="background:#ff0044;color:#fff;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.82rem;"><i class="fas fa-check"></i> Salvar na Galeria</button>
        <button onclick="document.getElementById('tiktokPreview').style.display='none';document.getElementById('tiktokDropZone').style.display='block';" style="background:#333;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.82rem;">Trocar</button>
      </div>
    </div>
    <div style="margin-top:8px;color:#555;font-size:0.65rem;text-align:center;">
      Provedor: <strong style="color:#ff0044;">TikTok Creative Studio</strong> | Salva na Galeria + Historico
    </div>
  `;
  document.body.appendChild(widget);
  repositionImporterWidgets();

  // Drag functionality with AbortController for cleanup
  const ac = new AbortController();
  widget._abortController = ac;
  const dragHandle = document.getElementById('tiktokDragHandle');
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragOffsetX = e.clientX - widget.getBoundingClientRect().left;
    dragOffsetY = e.clientY - widget.getBoundingClientRect().top;
    dragHandle.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;
    newX = Math.max(0, Math.min(newX, window.innerWidth - widget.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - widget.offsetHeight));
    widget.style.left = newX + 'px';
    widget.style.top = newY + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }, { signal: ac.signal });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
    }
  }, { signal: ac.signal });
  // Touch support for mobile
  dragHandle.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    const touch = e.touches[0];
    dragOffsetX = touch.clientX - widget.getBoundingClientRect().left;
    dragOffsetY = touch.clientY - widget.getBoundingClientRect().top;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    let newX = touch.clientX - dragOffsetX;
    let newY = touch.clientY - dragOffsetY;
    newX = Math.max(0, Math.min(newX, window.innerWidth - widget.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - widget.offsetHeight));
    widget.style.left = newX + 'px';
    widget.style.top = newY + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }, { passive: true, signal: ac.signal });
  document.addEventListener('touchend', () => { isDragging = false; }, { signal: ac.signal });

  const dropZone = document.getElementById('tiktokDropZone');
  const fileInput = document.getElementById('tiktokFileInput');
  const preview = document.getElementById('tiktokPreview');
  const previewVid = document.getElementById('tiktokPreviewVid');
  let importedBlob = null;

  // Click to select file
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleImportedVideo(e.target.files[0]);
  });

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ff0044';
    dropZone.style.background = '#ff004411';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#ff004455';
    dropZone.style.background = 'none';
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ff004455';
    dropZone.style.background = 'none';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleImportedVideo(file);
    }
  });

  function handleImportedVideo(file) {
    importedBlob = file;
    const url = URL.createObjectURL(file);
    previewVid.src = url;
    dropZone.style.display = 'none';
    preview.style.display = 'block';
  }

  // Save button
  document.getElementById('tiktokSaveBtn').addEventListener('click', async () => {
    if (!importedBlob) return;
    const prompt = document.getElementById('tiktokImportPrompt').value.trim() || 'TikTok Studio generation';
    const provider = 'TikTok Creative Studio';
    const vidUrl = URL.createObjectURL(importedBlob);

    // Save to gallery
    await saveVideoToGallery(importedBlob, prompt, provider);
    // Save to history
    await saveToHistory({ type: 'video', prompt, provider, status: 'success', detail: 'Importado do TikTok Creative Studio' });

    // Show in results grid
    const grid = document.getElementById('resultsMasonry');
    if (grid) {
      document.getElementById('displayEmpty').style.display = 'none';
      document.getElementById('displayResults').style.display = 'block';
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <video src="${vidUrl}" style="width:100%;border-radius:8px;" controls muted></video>
        <div class="result-card-overlay">
          <button title="Download" onclick="event.stopPropagation(); const a=document.createElement('a');a.href='${vidUrl}';a.download='tiktok-${Date.now()}.mp4';a.click();"><i class="fas fa-download"></i></button>
          <button title="Favoritar" onclick="event.stopPropagation(); this.style.color='var(--accent)'"><i class="fas fa-heart"></i></button>
          <button title="Deletar" onclick="event.stopPropagation(); this.closest('.result-card').remove();" style="color:#ff4444;"><i class="fas fa-trash"></i></button>
        </div>
        <div class="result-card-provider">${provider}</div>
      `;
      grid.insertBefore(card, grid.firstChild);
    }

    showToast('Video salvo! (TikTok Creative Studio)', 'success');

    // Reset for next import
    importedBlob = null;
    preview.style.display = 'none';
    dropZone.style.display = 'block';
    document.getElementById('tiktokImportPrompt').value = '';
  });
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

async function pollinationsText(prompt, model, options = {}) {
  const maxRetries = options.retries ?? 2;
  const models = [model, 'mistral', 'openai'];
  // Remove duplicates while keeping order
  const uniqueModels = [...new Set(models)];

  for (const m of uniqueModels) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature ?? 0.8
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          console.warn(`pollinationsText: model=${m} attempt=${attempt} HTTP ${response.status}`);
          if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
          continue;
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) return content;
        console.warn(`pollinationsText: model=${m} empty response`);
      } catch (err) {
        console.warn(`pollinationsText: model=${m} attempt=${attempt} error:`, err.message);
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
      }
    }
  }
  // Final fallback: simple GET endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const encoded = encodeURIComponent(prompt.slice(0, 2000));
    const response = await fetch(`https://text.pollinations.ai/${encoded}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const text = await response.text();
      if (text) return text;
    }
  } catch (e) { console.warn('pollinationsText: GET fallback failed:', e.message); }
  throw new Error('Todos os modelos falharam. Tente novamente.');
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

function addTextToMoodboard() {
  const text = document.getElementById('textResultContent').textContent;
  if (!text) return;
  const provider = document.getElementById('textProviderUsed').textContent || 'Texto';
  moodboardItems.push({ type: 'note', text: `[${provider}] ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`, id: Date.now() });
  saveMoodboard();
  renderMoodboard();
  showToast('Texto adicionado ao Moodboard!', 'success');
}

function addTextToGallery() {
  const text = document.getElementById('textResultContent').textContent;
  if (!text) return;
  const provider = document.getElementById('textProviderUsed').textContent || 'Texto';
  saveTextToGallery(text, '', provider);
  showToast('Texto salvo na Galeria!', 'success');
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

  // AI Assistant button
  document.getElementById('sbAiAssistBtn')?.addEventListener('click', sbAiAssist);
  document.getElementById('sbAiUseBtn')?.addEventListener('click', () => {
    const content = document.getElementById('sbAiContent').textContent;
    if (content) {
      document.getElementById('storyboardPrompt').value = content;
      document.getElementById('sbAiResponse').style.display = 'none';
      showToast('Prompt aplicado!', 'success');
    }
  });
  document.getElementById('sbAiCloseBtn')?.addEventListener('click', () => {
    document.getElementById('sbAiResponse').style.display = 'none';
  });
}

async function sbAiAssist() {
  const btn = document.getElementById('sbAiAssistBtn');
  const currentPrompt = document.getElementById('storyboardPrompt').value.trim();
  const panelCount = parseInt(document.querySelector('.sb-pill:not(.style-pill).active')?.dataset.panels || 4);
  const style = document.querySelector('.sb-pill.style-pill.active')?.dataset.style || 'cinematic';

  // Collect reference images captions from storyboard grid
  const refPanels = [];
  document.querySelectorAll('#storyboardGrid .storyboard-panel').forEach((panel, i) => {
    const caption = panel.querySelector('.sb-panel-caption')?.textContent?.trim();
    if (caption) refPanels.push(`Painel ${i + 1}: ${caption}`);
  });

  const styleNames = { cinematic: 'Cinematico', comic: 'Comic/HQ', anime: 'Anime', watercolor: 'Aquarela' };

  let context = `Voce e um assistente criativo especialista em criar historias para storyboards visuais.

TAREFA: Crie um prompt/historia DETALHADA e criativa em portugues para gerar um storyboard de ${panelCount} paineis no estilo ${styleNames[style] || style}.

O prompt deve ser uma narrativa envolvente com descricoes visuais ricas que funcionem bem como cenas de um storyboard. Inclua:
- Cenario e ambientacao
- Personagens com descricoes visuais
- Sequencia de acoes/eventos claros
- Emocoes e atmosfera
- Detalhes visuais (iluminacao, cores, angulos)

IMPORTANTE: Responda APENAS com o texto do prompt/historia. Nada de explicacoes extras, titulos ou formatacao markdown.`;

  if (currentPrompt) {
    context += `\n\nO usuario ja escreveu esta ideia inicial, MELHORE e EXPANDA ela:\n"${currentPrompt}"`;
  }

  if (refPanels.length > 0) {
    context += `\n\nImagens de referencia ja adicionadas ao storyboard:\n${refPanels.join('\n')}\n\nUse essas referencias como inspiracao para a historia.`;
  }

  if (!currentPrompt && refPanels.length === 0) {
    context += `\n\nO usuario ainda nao escreveu nada. Crie uma historia original, criativa e visualmente interessante que funcione bem em ${panelCount} paineis no estilo ${styleNames[style] || style}.`;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Pensando...</span>';

  try {
    const result = await pollinationsText(context, 'openai');
    if (result) {
      document.getElementById('sbAiContent').textContent = result.trim();
      document.getElementById('sbAiResponse').style.display = '';
    } else {
      showToast('IA nao retornou resposta. Tente novamente.', 'error');
    }
  } catch (e) {
    console.error('SB AI Assist error:', e);
    showToast('Erro ao consultar IA: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-robot"></i> <span>IA Assistente</span>';
  }
}

function parseUserPanels(text) {
  let panels = [];

  // Detect "Quadro X:", "Painel X:", "Cena X:", "Scene X:", "Panel X:" patterns
  const labelRegex = /(?:\*\*)?(?:Quadro|Painel|Cena|Scene|Panel|Frame)\s*\d+\s*[:\-\.]?\s*(?:\*\*)?/gi;
  if (labelRegex.test(text)) {
    const splitRegex = /(?:\*\*)?(?:Quadro|Painel|Cena|Scene|Panel|Frame)\s*\d+\s*[:\-\.]?\s*(?:\*\*)?/gi;
    const parts = text.split(splitRegex).filter(s => s.trim().length > 15);
    if (parts.length >= 2) return parts.map(s => s.trim());
  }

  // Detect numbered list: "1.", "1)", "1 -"
  const numRegex = /(?:^|\n)\s*\d+\s*[\.\)\-]\s*/;
  if (numRegex.test(text)) {
    const parts = text.split(/(?:^|\n)\s*\d+\s*[\.\)\-]\s*/).filter(s => s.trim().length > 15);
    if (parts.length >= 2) return parts.map(s => s.trim());
  }

  // Detect double newline separation (paragraphs as individual scenes)
  const paragraphs = text.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 30);
  if (paragraphs.length >= 2) return paragraphs;

  return panels;
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
    // Step 0: Try to detect if user already wrote panels in the prompt
    let panels = parseUserPanels(storyPrompt);
    let skippedAI = panels.length > 0;

    if (skippedAI) {
      showToast(`Detectados ${panels.length} quadros no seu texto!`, 'success');
      // Translate each panel to English visual description using AI
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduzindo quadros...';
      const translatedPanels = [];
      for (const p of panels) {
        try {
          const translated = await pollinationsText(
            `Translate the following scene description to English. Write ONLY a concise visual description (max 80 words) for image generation. Describe characters, actions, scenery, lighting. No dialogues, no titles, no extra text.\n\nScene: ${p}`,
            'openai',
            { temperature: 0.2 }
          );
          translatedPanels.push(translated.trim());
        } catch (e) {
          translatedPanels.push(p);
        }
      }
      panels = translatedPanels;
    } else {
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
        'openai',
        { temperature: 0.4 }
      );

      // Parse AI response panels - try multiple formats

      // Format 1: ---PANEL X---
      for (let i = 1; i <= panelCount; i++) {
        const regex = new RegExp(`---PANEL ${i}---\\s*([\\s\\S]*?)(?=---PANEL ${i + 1}---|$)`);
        const match = scriptResult.match(regex);
        if (match) panels.push(match[1].trim());
      }

      // Format 2: **Panel X:** or Panel X: or Painel X:
      if (panels.length === 0) {
        const altRegex = /(?:\*\*)?(?:Panel|Painel|Quadro|Scene|Cena)\s*(\d+)\s*(?::|\*\*:?)\s*([\s\S]*?)(?=(?:\*\*)?(?:Panel|Painel|Quadro|Scene|Cena)\s*\d+|$)/gi;
        let m;
        while ((m = altRegex.exec(scriptResult)) !== null) {
          const text = m[2].trim().replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '');
          if (text) panels.push(text);
        }
      }

      // Format 3: Numbered list (1. or 1)
      if (panels.length === 0) {
        const numRegex = /(?:^|\n)\s*\d+[\.\)]\s*([\s\S]*?)(?=\n\s*\d+[\.\)]|$)/g;
        let m;
        while ((m = numRegex.exec(scriptResult)) !== null) {
          const text = m[1].trim();
          if (text && text.length > 10) panels.push(text);
        }
      }

      // Format 4: Split by double newlines as last resort
      if (panels.length === 0) {
        panels = scriptResult.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 15);
      }

      // Limit to requested panel count
      panels = panels.slice(0, panelCount);
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
        <button class="sb-panel-remove" title="Remover painel"><i class="fas fa-times"></i></button>
        <div class="sb-panel-image loading">
          <div class="spinner-ring small"></div>
          <span>Gerando painel ${i + 1}/${panels.length}...</span>
        </div>
        <div class="sb-panel-caption">${escapeHtml(desc)}</div>
      `;
      card.querySelector('.sb-panel-remove').addEventListener('click', () => removeSbPanel(card));
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

function addToStoryboard(imageUrl, caption) {
  const grid = document.getElementById('storyboardGrid');
  const emptyEl = document.getElementById('storyboardEmpty');
  if (emptyEl) emptyEl.style.display = 'none';
  const panelNum = grid.children.length + 1;
  const card = document.createElement('div');
  card.className = 'storyboard-panel';
  card.innerHTML = `
    <div class="sb-panel-number">${panelNum}</div>
    <button class="sb-panel-remove" title="Remover painel"><i class="fas fa-times"></i></button>
    <div class="sb-panel-image"><img src="${imageUrl}" alt="Panel ${panelNum}" style="cursor:pointer;"></div>
    <div class="sb-panel-caption">${escapeHtml(caption) || ''}</div>
  `;
  card.querySelector('.sb-panel-remove').addEventListener('click', (e) => { e.stopPropagation(); removeSbPanel(card); });
  card.querySelector('.sb-panel-image img')?.addEventListener('click', () => openLightbox(imageUrl, caption || '', '', 'image'));
  grid.appendChild(card);
  showToast('Adicionado ao Story Board!', 'success');
}

function removeSbPanel(card) {
  card.remove();
  // Renumber remaining panels
  const grid = document.getElementById('storyboardGrid');
  grid.querySelectorAll('.storyboard-panel').forEach((panel, i) => {
    const numEl = panel.querySelector('.sb-panel-number');
    if (numEl) numEl.textContent = i + 1;
  });
  if (grid.children.length === 0) {
    document.getElementById('storyboardEmpty').style.display = '';
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

function openLightbox(src, prompt, ratio, type) {
  const lightbox = document.getElementById('lightbox');
  const imgEl = document.getElementById('lightboxImg');
  const vidEl = document.getElementById('lightboxVideo');
  const infoEl = document.getElementById('lightboxInfo');
  const dlBtn = document.getElementById('lightboxDownload');

  // Reset
  imgEl.style.display = 'none';
  imgEl.src = '';
  vidEl.style.display = 'none';
  vidEl.src = '';
  vidEl.pause();

  if (type === 'video') {
    vidEl.src = src;
    vidEl.style.display = 'block';
    dlBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = src; a.download = `ai-video-${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
    };
  } else {
    imgEl.src = src;
    imgEl.style.display = 'block';
    dlBtn.onclick = () => downloadImage(src, `ai-image-${Date.now()}.png`);
  }

  let infoHTML = '';
  if (prompt) infoHTML += `<p><strong>Prompt:</strong> ${escapeHtml(prompt)}</p>`;
  if (ratio) infoHTML += `<p><strong>Ratio:</strong> ${escapeHtml(ratio)}</p>`;
  infoEl.innerHTML = infoHTML;

  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const imgEl = document.getElementById('lightboxImg');
  const vidEl = document.getElementById('lightboxVideo');
  if (imgEl?.src?.startsWith('blob:')) URL.revokeObjectURL(imgEl.src);
  if (vidEl?.src?.startsWith('blob:')) URL.revokeObjectURL(vidEl.src);
  vidEl.pause();
  vidEl.src = '';
  lightbox.classList.remove('open');
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
      btn.innerHTML = `<span class="${dotClass}"></span> ${escapeHtml(modelName)} <i class="fas fa-chevron-down"></i>`;
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
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Configurar API Keys');
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
    };
    for (const [k, v] of Object.entries(keys)) {
      setApiKey(k, v);
    }
    closeApiKeyModal();
    showToast('API keys salvas!', 'success');
    updateApiKeyStatus();
  });

  // Toggle visibility
  ['Gemini', 'Openrouter', 'Groq', 'Together', 'Huggingface', 'Pexels', 'Pixabay', 'Unsplash', 'Freesound'].forEach(name => {
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
  modal.classList.add('open');
}

function closeApiKeyModal() {
  document.getElementById('apiKeyModal').classList.remove('open');
  updateApiKeyStatus();
}

// Close API key modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('apiKeyModal');
    if (modal && modal.classList.contains('open')) closeApiKeyModal();
  }
});

function updateApiKeyStatus() {
  const providers = {
    Gemini: !!getApiKey('gemini_api_key'),
    OpenRouter: !!getApiKey('openrouter_api_key'),
    Groq: !!getApiKey('groq_api_key'),
    Together: !!getApiKey('together_api_key'),
    HuggingFace: !!getApiKey('huggingface_api_key'),
    Pexels: !!getApiKey('pexels_api_key'),
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
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;
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
    card.innerHTML = `<img src="${photo.src.medium}" alt="${escapeHtml(photo.alt) || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${escapeHtml(photo.photographer)}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
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
    card.innerHTML = `<img src="${img.webformatURL}" alt="${escapeHtml(img.tags)}" loading="lazy"><div class="moodboard-result-overlay"><span>${escapeHtml(img.user)}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
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
    card.innerHTML = `<img src="${photo.urls.small}" alt="${escapeHtml(photo.alt_description) || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${escapeHtml(photo.user.name)}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
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
    card.innerHTML = `<img src="${img.thumbnail || img.url}" alt="${escapeHtml(img.title) || ''}" loading="lazy"><div class="moodboard-result-overlay"><span>${escapeHtml(img.creator) || 'CC'}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
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
    card.innerHTML = `<div style="position:relative;"><img src="${thumb}" alt="" loading="lazy"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><i class="fas fa-play-circle" style="font-size:2rem;color:rgba(255,255,255,0.85);"></i></div></div><div class="moodboard-result-overlay"><span>${escapeHtml(video.user.name)}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
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
    card.innerHTML = `<div style="position:relative;"><img src="${thumb}" alt="${escapeHtml(video.tags)}" loading="lazy" onerror="this.style.display='none'"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);"><i class="fas fa-play-circle" style="font-size:2rem;color:rgba(255,255,255,0.85);"></i></div></div><div class="moodboard-result-overlay"><span>${escapeHtml(video.user)}</span><button class="moodboard-add-btn" title="Adicionar ao board"><i class="fas fa-plus"></i></button></div>`;
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
          <div><strong>${escapeHtml(sound.name)}</strong><br><span style="font-size:0.65rem;color:var(--text-muted);">${escapeHtml(sound.username)} · ${dur}s</span></div>
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
          <div><strong>${escapeHtml(audio.title) || 'Audio'}</strong><br><span style="font-size:0.65rem;color:var(--text-muted);">${escapeHtml(audio.creator) || 'CC'} · ${dur}s</span></div>
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

  let itemsToRender = [...moodboardItems];

  // Apply folder filter (includes subfolders)
  const folderMap = getFolderMap('moodboard');
  if (currentFolderByPage.moodboard === 'all') {
    itemsToRender = itemsToRender.filter(item => !folderMap[String(item.id)]);
  } else {
    const validIds = getFolderAndDescendantIds(currentFolderByPage.moodboard, getFolders());
    itemsToRender = itemsToRender.filter(item => validIds.includes(folderMap[String(item.id)]));
  }

  // Apply AI search filter
  if (aiSearchResultsByPage.moodboard) {
    itemsToRender = itemsToRender.filter((item, i) => aiSearchResultsByPage.moodboard.has(String(item.id || i)));
  }

  if (itemsToRender.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  itemsToRender.forEach(item => {
    const el = document.createElement('div');
    el.className = 'moodboard-item moodboard-item-' + item.type;

    if (item.type === 'image') {
      el.innerHTML = `
        <img src="${item.url}" alt="" loading="lazy">
        <div class="moodboard-item-actions">
          <button class="moodboard-item-action-btn moodboard-item-folder-btn" title="Mover para pasta"><i class="fas fa-folder"></i></button>
          <button class="moodboard-item-action-btn moodboard-download-btn" title="Baixar imagem"><i class="fas fa-download"></i></button>
          <button class="moodboard-item-action-btn moodboard-gallery-btn" title="Adicionar na Galeria"><i class="fas fa-images"></i></button>
          <button class="moodboard-item-action-btn moodboard-storyboard-btn" title="Adicionar ao Story Board"><i class="fas fa-book-open"></i></button>
        </div>
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
        <button class="moodboard-item-folder-btn" style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.6);border:none;color:var(--text-secondary);width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" title="Mover para pasta"><i class="fas fa-folder"></i></button>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'note') {
      el.innerHTML = `
        <div class="moodboard-note-content"><i class="fas fa-sticky-note"></i> ${item.text}</div>
        <button class="moodboard-item-folder-btn" style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.6);border:none;color:var(--text-secondary);width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" title="Mover para pasta"><i class="fas fa-folder"></i></button>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'video') {
      el.innerHTML = `
        <div class="moodboard-video-thumb" style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-sm);overflow:hidden;cursor:pointer;">
          <video src="${item.url}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);">
            <i class="fas fa-play-circle" style="font-size:2.5rem;color:#fff;opacity:0.9;"></i>
          </div>
        </div>
        <div class="moodboard-item-info">
          <span><i class="fas fa-video"></i> ${item.provider || 'Video'}</span>
        </div>
        <button class="moodboard-item-folder-btn" style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.6);border:none;color:var(--text-secondary);width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" title="Mover para pasta"><i class="fas fa-folder"></i></button>
        <button class="moodboard-item-remove" title="Remover"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'audio') {
      el.innerHTML = `
        <div style="padding:12px; text-align:center;">
          <i class="fas fa-volume-up" style="font-size:1.5rem; color:var(--green); margin-bottom:8px;"></i>
          <audio controls src="${item.url}" style="width:100%;"></audio>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${item.provider || 'Audio'}</div>
        </div>
        <button class="moodboard-item-folder-btn" style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.6);border:none;color:var(--text-secondary);width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:0.65rem;display:flex;align-items:center;justify-content:center;" title="Mover para pasta"><i class="fas fa-folder"></i></button>
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

    el.querySelector('.moodboard-item-remove').addEventListener('click', (e) => { e.stopPropagation(); removeFromBoard(item.id); });

    // Folder button for all moodboard items
    const folderBtn = el.querySelector('.moodboard-item-folder-btn');
    if (folderBtn) {
      folderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const folderMap = getFolderMap('moodboard');
        openMoveToFolderModal('moodboard', item.id, folderMap[String(item.id)]);
      });
    }

    // Click to open fullscreen for images and videos
    if (item.type === 'image') {
      el.addEventListener('click', () => openLightbox(item.url, item.photographer || '', '', 'image'));
    } else if (item.type === 'video') {
      el.addEventListener('click', () => openLightbox(item.url, item.provider || '', '', 'video'));
    }

    // Download & Gallery buttons for images
    if (item.type === 'image') {
      el.querySelector('.moodboard-download-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadImage(item.url, `moodboard-${item.photographer || 'image'}-${Date.now()}.jpg`);
      });
      el.querySelector('.moodboard-gallery-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await saveImageToGallery(item.url, '', item.photographer || 'Moodboard');
        showToast('Imagem salva na Galeria!', 'success');
      });
      el.querySelector('.moodboard-storyboard-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        addToStoryboard(item.url, item.photographer || '');
      });
    }

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
const GALLERY_DB_VERSION = 3;
const GALLERY_STORE = 'items';
const HISTORY_STORE = 'history';
const TRASH_STORE = 'trash';

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
      if (!db.objectStoreNames.contains(TRASH_STORE)) {
        const tStore = db.createObjectStore(TRASH_STORE, { keyPath: 'trashId', autoIncrement: true });
        tStore.createIndex('type', 'type', { unique: false });
        tStore.createIndex('deletedAt', 'deletedAt', { unique: false });
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

// --- Trash System ---
async function moveToTrash(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([GALLERY_STORE, TRASH_STORE], 'readwrite');
    const galleryStore = tx.objectStore(GALLERY_STORE);
    const trashStore = tx.objectStore(TRASH_STORE);
    const getReq = galleryStore.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) { resolve(); return; }
      item.deletedAt = Date.now();
      item.originalId = item.id;
      delete item.id;
      trashStore.add(item);
      galleryStore.delete(id);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getTrashItems(type) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readonly');
    const store = tx.objectStore(TRASH_STORE);
    let req;
    if (type && type !== 'all') {
      req = store.index('type').getAll(type);
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => {
      const items = req.result.sort((a, b) => b.deletedAt - a.deletedAt);
      resolve(items);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function restoreFromTrash(trashId) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([GALLERY_STORE, TRASH_STORE], 'readwrite');
    const galleryStore = tx.objectStore(GALLERY_STORE);
    const trashStore = tx.objectStore(TRASH_STORE);
    const getReq = trashStore.get(trashId);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) { resolve(); return; }
      delete item.trashId;
      delete item.deletedAt;
      delete item.originalId;
      galleryStore.add(item);
      trashStore.delete(trashId);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function permanentDeleteTrash(trashId) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readwrite');
    tx.objectStore(TRASH_STORE).delete(trashId);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function clearTrash() {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRASH_STORE, 'readwrite');
    tx.objectStore(TRASH_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function restoreAllTrash() {
  const items = await getTrashItems();
  for (const item of items) {
    await restoreFromTrash(item.trashId);
  }
}

async function clearGallery(type) {
  // Move all items to trash instead of deleting
  const items = await getGalleryItems(type);
  for (const item of items) {
    await moveToTrash(item.id);
  }
  return Promise.resolve();
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
    if (!confirm('Mover todos os itens para a lixeira?')) return;
    await clearGallery(galleryCurrentFilter);
    renderGallery();
    showToast('Itens movidos para lixeira', 'success');
  });

  // Upload button
  const uploadBtn = document.getElementById('galleryUploadBtn');
  const fileInput = document.getElementById('galleryFileInput');
  uploadBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (const file of files) {
      let type = 'text';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      const data = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(file);
      });
      await saveToGallery({
        type,
        prompt: file.name,
        provider: 'Upload manual',
        data,
        mimeType: file.type || 'application/octet-stream',
        timestamp: Date.now()
      });
    }
    fileInput.value = '';
    renderGallery();
    showToast(`${files.length} arquivo(s) adicionado(s) à galeria`, 'success');
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
    let items = await getGalleryItems(galleryCurrentFilter);

    // Apply folder filter (includes subfolders)
    const folderMap = getFolderMap('gallery');
    if (currentFolderByPage.gallery === 'all') {
      items = items.filter(item => !folderMap[String(item.id)]);
    } else {
      const validIds = getFolderAndDescendantIds(currentFolderByPage.gallery, getFolders());
      items = items.filter(item => validIds.includes(folderMap[String(item.id)]));
    }

    // Apply AI search filter
    if (aiSearchResultsByPage.gallery) {
      items = items.filter(item => aiSearchResultsByPage.gallery.has(String(item.id)));
    }

    countEl.textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;

    if (items.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      return;
    }

    grid.style.display = '';
    empty.style.display = 'none';
    revokeBlobUrls(grid);
    grid.innerHTML = '';

    const allFolders = getFolders();

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
        thumbHTML = `<div style="padding:10px;font-size:0.7rem;color:var(--text-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(preview)}</div>`;
      }

      // Folder badge
      const itemFolderId = folderMap[String(item.id)];
      const itemFolder = itemFolderId ? allFolders.find(f => f.id === itemFolderId) : null;
      const folderBadgeHTML = itemFolder ? `<span class="item-folder-badge" style="background:${itemFolder.color}20;color:${itemFolder.color};"><span class="badge-dot" style="background:${itemFolder.color};"></span>${escapeHtml(itemFolder.name)}</span>` : '';

      card.innerHTML = `
        <span class="gallery-card-badge type-${item.type}">${typeLabels[item.type]}</span>
        <button class="gallery-card-folder" title="Mover para pasta"><i class="fas fa-folder"></i></button>
        <button class="gallery-card-storyboard" title="Adicionar ao Story Board"><i class="fas fa-book-open"></i></button>
        <button class="gallery-card-moodboard" title="Adicionar ao Moodboard"><i class="fas fa-palette"></i></button>
        <button class="gallery-card-delete" title="Excluir"><i class="fas fa-trash"></i></button>
        <div class="gallery-card-thumb">${thumbHTML}</div>
        <div class="gallery-card-info">
          <div class="gallery-card-prompt">${escapeHtml(promptSnippet) || 'Sem prompt'}</div>
          <div class="gallery-card-meta">
            <span>${escapeHtml(item.provider) || ''}</span>
            <span>${timeStr}</span>
            ${folderBadgeHTML}
          </div>
        </div>
      `;

      // Folder button
      card.querySelector('.gallery-card-folder').addEventListener('click', (e) => {
        e.stopPropagation();
        openMoveToFolderModal('gallery', item.id, folderMap[String(item.id)]);
      });

      // Delete button
      card.querySelector('.gallery-card-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await moveToTrash(item.id);
        card.remove();
        const remaining = grid.querySelectorAll('.gallery-card').length;
        countEl.textContent = `${remaining} ${remaining === 1 ? 'item' : 'itens'}`;
        if (remaining === 0) { grid.style.display = 'none'; empty.style.display = ''; }
        showToast('Item movido para lixeira', 'success');
      });

      // Moodboard button
      card.querySelector('.gallery-card-moodboard').addEventListener('click', (e) => {
        e.stopPropagation();
        addGalleryItemToMoodboard(item);
      });

      // Storyboard button (only for images)
      card.querySelector('.gallery-card-storyboard').addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.type === 'image' && item.data instanceof Blob) {
          addToStoryboard(URL.createObjectURL(item.data), item.prompt || item.provider || '');
        } else if (item.type === 'image') {
          addToStoryboard(item.data, item.prompt || item.provider || '');
        } else {
          showToast('Apenas imagens podem ser adicionadas ao Story Board', 'error');
        }
      });

      // Open preview
      card.addEventListener('click', () => openGalleryPreview(item));

      grid.appendChild(card);
    });
  } catch (e) {
    console.error('Gallery render error:', e);
  }
}

let galleryPreviewCurrentItem = null;

function addGalleryItemToMoodboard(item) {
  if (!item) return;
  if (item.type === 'image' && item.data instanceof Blob) {
    const url = URL.createObjectURL(item.data);
    moodboardItems.push({ type: 'image', url, photographer: item.provider || 'Galeria', id: Date.now() });
  } else if (item.type === 'video') {
    const url = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
    moodboardItems.push({ type: 'video', url, provider: item.provider || 'Galeria', id: Date.now() });
  } else if (item.type === 'audio' && item.data instanceof Blob) {
    const url = URL.createObjectURL(item.data);
    moodboardItems.push({ type: 'audio', url, provider: item.provider || 'Galeria', id: Date.now() });
  } else if (item.type === 'text') {
    const text = typeof item.data === 'string' ? item.data.substring(0, 500) : '';
    moodboardItems.push({ type: 'note', text: `[${item.provider || 'Texto'}] ${text}`, id: Date.now() });
  }
  saveMoodboard();
  renderMoodboard();
  showToast('Adicionado ao Moodboard!', 'success');
}

function addGalleryPreviewToStoryboard() {
  const item = galleryPreviewCurrentItem;
  if (!item || item.type !== 'image') return;
  const url = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
  addToStoryboard(url, item.prompt || item.provider || '');
}

function openGalleryPreview(item) {
  galleryPreviewCurrentItem = item;
  const overlay = document.getElementById('galleryPreview');
  const mediaEl = document.getElementById('galleryPreviewMedia');
  const infoEl = document.getElementById('galleryPreviewInfo');

  let mediaHTML = '';
  if (item.type === 'image') {
    const url = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
    mediaHTML = `<img src="${url}" alt="Preview">`;
  } else if (item.type === 'video') {
    const src = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
    mediaHTML = `<video controls autoplay style="max-width:100%;max-height:70vh;border-radius:var(--radius-md);"><source src="${src}" type="${item.mimeType || 'video/mp4'}"></video>`;
  } else if (item.type === 'audio') {
    const url = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
    mediaHTML = `<audio controls autoplay src="${url}" style="width:100%;min-width:300px;"></audio>`;
  } else if (item.type === 'text') {
    const escaped = (typeof item.data === 'string' ? item.data : '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    mediaHTML = `<div class="preview-text-content">${escaped}</div>`;
  }

  const timeStr = new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  mediaEl.innerHTML = mediaHTML;
  const typeLabels = { image: 'Imagem', video: 'Video', audio: 'Audio', text: 'Texto' };
  infoEl.innerHTML = `
    <div class="preview-section-label"><i class="fas fa-quote-left"></i> PROMPT</div>
    <div class="preview-prompt">${escapeHtml(item.prompt) || 'Sem prompt'}</div>
    <div class="preview-section-label"><i class="fas fa-info-circle"></i> INFORMACOES</div>
    <div class="preview-meta">
      <span><i class="fas fa-robot"></i> Modelo: <strong>${escapeHtml(item.provider) || '—'}</strong></span>
      <span><i class="fas fa-tag"></i> Tipo: <strong>${typeLabels[item.type] || item.type}</strong></span>
      <span><i class="fas fa-clock"></i> Criado: <strong>${timeStr}</strong></span>
    </div>
    <div class="preview-actions">
      ${item.type !== 'text' ? `<button class="preview-action-btn" onclick="downloadGalleryItem(${item.id})"><i class="fas fa-download"></i> Download</button>` : `<button class="preview-action-btn" onclick="copyGalleryText(this)"><i class="fas fa-copy"></i> Copiar</button>`}
      <button class="preview-action-btn" onclick="addGalleryItemToMoodboard(galleryPreviewCurrentItem)"><i class="fas fa-palette"></i> Moodboard</button>
      ${item.type === 'image' ? `<button class="preview-action-btn" onclick="addGalleryPreviewToStoryboard()"><i class="fas fa-book-open"></i> Story Board</button>` : ''}
      <button class="preview-action-btn btn-delete" onclick="deleteAndClosePreview(${item.id})"><i class="fas fa-trash"></i> Excluir</button>
    </div>
  `;

  overlay.style.display = 'flex';
}

function closeGalleryPreview() {
  const overlay = document.getElementById('galleryPreview');
  overlay.style.display = 'none';
  const mediaEl = document.getElementById('galleryPreviewMedia');
  revokeBlobUrls(mediaEl);
  mediaEl.innerHTML = '';
}

async function deleteAndClosePreview(id) {
  await moveToTrash(id);
  closeGalleryPreview();
  renderGallery();
  showToast('Item movido para lixeira', 'success');
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

// === TRASH TAB ===
let trashCurrentFilter = 'all';

async function renderTrash(filterType) {
  const type = filterType || trashCurrentFilter;
  trashCurrentFilter = type;
  const grid = document.getElementById('trashGrid');
  const empty = document.getElementById('trashEmpty');
  const countEl = document.getElementById('trashCount');
  if (!grid) return;

  try {
    const items = await getTrashItems(type);
    countEl.textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;

    if (items.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      return;
    }

    grid.style.display = '';
    empty.style.display = 'none';
    revokeBlobUrls(grid);
    grid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.dataset.trashId = item.trashId || '';

      const typeLabels = { image: 'Imagem', video: 'Video', audio: 'Audio', text: 'Texto' };
      const timeStr = new Date(item.deletedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
        thumbHTML = `<div style="padding:10px;font-size:0.7rem;color:var(--text-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(preview)}</div>`;
      }

      card.innerHTML = `
        <span class="gallery-card-badge type-${item.type}">${typeLabels[item.type]}</span>
        <div class="trash-card-actions">
          <button class="trash-restore-btn" title="Recuperar"><i class="fas fa-undo"></i></button>
          <button class="trash-delete-btn" title="Excluir permanentemente"><i class="fas fa-times"></i></button>
        </div>
        <div class="gallery-card-thumb">${thumbHTML}</div>
        <div class="gallery-card-info">
          <div class="gallery-card-prompt">${promptSnippet || 'Sem prompt'}</div>
          <div class="gallery-card-meta">
            <span>${item.provider || ''}</span>
            <span>Excluido: ${timeStr}</span>
          </div>
        </div>
      `;

      // Restore button
      card.querySelector('.trash-restore-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await restoreFromTrash(item.trashId);
        card.remove();
        const remaining = grid.querySelectorAll('.gallery-card').length;
        countEl.textContent = `${remaining} ${remaining === 1 ? 'item' : 'itens'}`;
        if (remaining === 0) { grid.style.display = 'none'; empty.style.display = ''; }
        showToast('Item recuperado para galeria', 'success');
      });

      // Permanent delete button
      card.querySelector('.trash-delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Excluir permanentemente? Esta acao nao pode ser desfeita.')) return;
        await permanentDeleteTrash(item.trashId);
        card.remove();
        const remaining = grid.querySelectorAll('.gallery-card').length;
        countEl.textContent = `${remaining} ${remaining === 1 ? 'item' : 'itens'}`;
        if (remaining === 0) { grid.style.display = 'none'; empty.style.display = ''; }
        showToast('Item excluido permanentemente', 'success');
      });

      grid.appendChild(card);
    });
  } catch (e) {
    console.error('Trash render error:', e);
  }
}

function initTrash() {
  // Filter buttons
  document.querySelectorAll('#tabTrash .gallery-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tabTrash .gallery-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTrash(btn.dataset.filter);
    });
  });

  // Clear all trash
  document.getElementById('trashClearBtn')?.addEventListener('click', async () => {
    if (!confirm('Esvaziar lixeira? Todos os itens serao excluidos permanentemente.')) return;
    await clearTrash();
    renderTrash();
    showToast('Lixeira esvaziada', 'success');
  });

  // Restore all
  document.getElementById('trashRestoreAllBtn')?.addEventListener('click', async () => {
    if (!confirm('Recuperar todos os itens da lixeira para a galeria?')) return;
    await restoreAllTrash();
    renderTrash();
    showToast('Todos os itens recuperados', 'success');
  });
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
    revokeBlobUrls(grid);
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
    let items = await getHistoryItems(historyCurrentFilter);

    // Apply folder filter (includes subfolders)
    const folderMap = getFolderMap('history');
    if (currentFolderByPage.history === 'all') {
      items = items.filter(item => !folderMap[String(item.id)]);
    } else {
      const validIds = getFolderAndDescendantIds(currentFolderByPage.history, getFolders());
      items = items.filter(item => validIds.includes(folderMap[String(item.id)]));
    }

    // Apply AI search filter
    if (aiSearchResultsByPage.history) {
      items = items.filter(item => aiSearchResultsByPage.history.has(String(item.id)));
    }

    countEl.textContent = `${items.length} ${items.length === 1 ? 'registro' : 'registros'}`;

    if (items.length === 0) {
      list.style.display = 'none';
      empty.style.display = '';
      return;
    }

    list.style.display = '';
    empty.style.display = 'none';
    revokeBlobUrls(list);
    list.innerHTML = '';

    const typeIcons = {
      image: 'fa-image', video: 'fa-video', audio: 'fa-headphones',
      text: 'fa-font', moodboard: 'fa-palette'
    };
    const typeLabels = {
      image: 'Imagem', video: 'Video', audio: 'Audio',
      text: 'Texto', moodboard: 'Moodboard'
    };

    const allFolders = getFolders();
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

      // Folder badge
      const itemFolderId = folderMap[String(item.id)];
      const itemFolder = itemFolderId ? allFolders.find(f => f.id === itemFolderId) : null;
      const folderBadgeHTML = itemFolder ? `<span class="item-folder-badge" style="background:${itemFolder.color}20;color:${itemFolder.color};"><span class="badge-dot" style="background:${itemFolder.color};"></span>${escapeHtml(itemFolder.name)}</span>` : '';

      el.innerHTML = `
        <div class="history-item-icon type-${item.type}">
          <i class="fas ${typeIcons[item.type] || 'fa-file'}"></i>
        </div>
        <div class="history-item-body">
          <div class="history-item-prompt">${escapeHtml(promptSnippet) || 'Sem prompt'}</div>
          <div class="history-item-meta">
            <span><i class="fas fa-tag"></i> ${typeLabels[item.type] || item.type}</span>
            <span><i class="fas fa-robot"></i> ${escapeHtml(item.provider) || ''}</span>
            <span><i class="fas fa-clock"></i> ${timeStr}</span>
            ${item.detail ? `<span><i class="fas fa-info-circle"></i> ${escapeHtml(item.detail)}</span>` : ''}
            ${folderBadgeHTML}
          </div>
        </div>
        <div class="history-item-thumb">${thumbHTML}</div>
        <div class="history-item-actions">
          <button class="history-item-action" title="Mover para pasta"><i class="fas fa-folder"></i></button>
          <button class="history-item-action" title="Reutilizar prompt"><i class="fas fa-redo"></i></button>
          <button class="history-item-action btn-delete" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      `;

      // Click to open fullscreen for items with thumbnail
      if (item.thumbnail instanceof Blob) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          const url = URL.createObjectURL(item.thumbnail);
          openLightbox(url, item.prompt || '', item.detail || '', item.type === 'video' ? 'video' : 'image');
        });
      }

      // Folder button (first action)
      const actionBtns = el.querySelectorAll('.history-item-action');
      actionBtns[0]?.addEventListener('click', (e) => {
        e.stopPropagation();
        openMoveToFolderModal('history', item.id, folderMap[String(item.id)]);
      });

      // Reuse prompt (second action)
      actionBtns[1]?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('promptInput').value = item.prompt || '';
        const tabMap = { image: 'image', video: 'video', audio: 'audio', text: 'text', moodboard: 'moodboard' };
        switchTab(tabMap[item.type] || 'image');
        showToast('Prompt carregado!', 'success');
      });

      // Delete (third action)
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
  initFolderSystem();
  initFoldersPage();
  initFoldersPageDrop();
  initAiSearch();
  initStoryboardSave();
});

// =============================================
// === FOLDER SYSTEM ===
// =============================================

const FOLDERS_KEY = 'app_folders';
const FOLDER_MAP_PREFIX = 'folder_map_';

function getFolders() {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]');
  } catch { return []; }
}

function saveAllFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

function createFolder(page, name, color, parentId) {
  const folders = getFolders();
  const folder = { id: 'fld_' + Date.now(), name, color: color || '#AD39FB', createdAt: Date.now(), parentId: parentId || null };
  folders.push(folder);
  saveAllFolders(folders);
  return folder;
}

function renameFolder(folderId, newName) {
  const folders = getFolders();
  const f = folders.find(f => f.id === folderId);
  if (f) { f.name = newName; saveAllFolders(folders); }
}

function getChildFolderIds(folderId, folders) {
  const children = [];
  const queue = [folderId];
  while (queue.length) {
    const pid = queue.shift();
    folders.filter(f => f.parentId === pid).forEach(f => {
      children.push(f.id);
      queue.push(f.id);
    });
  }
  return children;
}

function deleteFolderById(folderId) {
  const allFolders = getFolders();
  const idsToDelete = [folderId, ...getChildFolderIds(folderId, allFolders)];
  const folders = allFolders.filter(f => !idsToDelete.includes(f.id));
  saveAllFolders(folders);
  // Remove folder mappings for deleted folders
  FOLDER_PAGES.forEach(page => {
    const map = getFolderMap(page);
    Object.keys(map).forEach(key => { if (idsToDelete.includes(map[key])) delete map[key]; });
    saveFolderMap(page, map);
  });
}

function setFolderParent(folderId, newParentId) {
  const folders = getFolders();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  // Prevent circular: can't set parent to self or to a descendant
  if (newParentId === folderId) return;
  const childIds = getChildFolderIds(folderId, folders);
  if (childIds.includes(newParentId)) return;
  folder.parentId = newParentId || null;
  saveAllFolders(folders);
}

function getFolderPath(folderId, folders) {
  const path = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? folders.find(f => f.id === current.parentId) : null;
  }
  return path;
}

function getFolderAndDescendantIds(folderId, folders) {
  return [folderId, ...getChildFolderIds(folderId, folders)];
}

function getFolderMap(page) {
  try { return JSON.parse(localStorage.getItem(FOLDER_MAP_PREFIX + page) || '{}'); } catch { return {}; }
}

function saveFolderMap(page, map) {
  localStorage.setItem(FOLDER_MAP_PREFIX + page, JSON.stringify(map));
}

function setItemFolder(page, itemId, folderId) {
  const map = getFolderMap(page);
  if (folderId && folderId !== 'none') {
    map[String(itemId)] = folderId;
  } else {
    delete map[String(itemId)];
  }
  saveFolderMap(page, map);
}

function getItemFolder(page, itemId) {
  return getFolderMap(page)[String(itemId)] || null;
}

// Current folder filters per page
const currentFolderByPage = { gallery: 'all', history: 'all', moodboard: 'all', storyboard: 'all' };

// Render function lookup per page
const PAGE_RENDER_FN = {
  gallery: () => typeof renderGallery === 'function' && renderGallery(),
  history: () => typeof renderHistory === 'function' && renderHistory(),
  moodboard: () => typeof renderMoodboard === 'function' && renderMoodboard(),
  storyboard: () => typeof renderSavedStoryboards === 'function' && renderSavedStoryboards()
};

// Page container IDs for search results display
const PAGE_CONTAINER_IDS = {
  gallery: 'galleryGrid',
  history: 'historyList',
  moodboard: 'moodboardBoard',
  storyboard: 'storyboardSavedGrid'
};

const FOLDER_PAGES = ['gallery', 'history', 'moodboard', 'storyboard'];

function initFolderSystem() {
  // Init folder bars and add-folder buttons for each page
  FOLDER_PAGES.forEach(page => {
    renderFolderChips(page);
    document.getElementById(page + 'AddFolder')?.addEventListener('click', () => openFolderModal(page));
  });

  // Folder modal events
  document.getElementById('folderModalCancel')?.addEventListener('click', closeFolderModal);
  document.getElementById('folderModalClose')?.addEventListener('click', closeFolderModal);
  document.getElementById('folderModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeFolderModal(); });
  document.getElementById('folderModalSave')?.addEventListener('click', saveFolderFromModal);
  document.getElementById('folderModalName')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveFolderFromModal(); });

  // Color picker
  document.querySelectorAll('.folder-color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.folder-color-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Move to folder modal
  document.getElementById('moveToFolderClose')?.addEventListener('click', closeMoveToFolderModal);
  document.getElementById('moveToFolderModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeMoveToFolderModal(); });
  document.getElementById('moveToFolderNewBtn')?.addEventListener('click', () => {
    closeMoveToFolderModal();
    document.getElementById('folderModal').style.display = 'flex';
  });

  // Close context menu on click elsewhere
  document.addEventListener('click', () => {
    document.querySelectorAll('.folder-context-menu').forEach(m => m.remove());
  });
}

function renderFolderChips(page) {
  const container = document.getElementById(page + 'FolderChips');
  if (!container) return;

  const folders = getFolders();
  const folderMap = getFolderMap(page);
  const currentFolder = currentFolderByPage[page] || 'all';

  // Count items per folder (including descendants)
  const folderCounts = {};
  Object.values(folderMap).forEach(fid => { folderCounts[fid] = (folderCounts[fid] || 0) + 1; });

  // Get total count including subfolders
  function getTotalCount(fid) {
    const descendantIds = getFolderAndDescendantIds(fid, folders);
    return descendantIds.reduce((sum, id) => sum + (folderCounts[id] || 0), 0);
  }

  container.innerHTML = `<button class="folder-chip ${currentFolder === 'all' ? 'active' : ''}" data-folder="all"><i class="fas fa-layer-group"></i> Todos</button>`;

  // Only show root folders + active folder path in chips
  const rootFolders = folders.filter(f => !f.parentId);

  rootFolders.forEach(folder => {
    const count = getTotalCount(folder.id);
    const hasChildren = folders.some(f => f.parentId === folder.id);
    const chip = document.createElement('button');
    chip.className = `folder-chip ${currentFolder === folder.id ? 'active' : ''}`;
    // Also highlight if a descendant is selected
    const descendantIds = getChildFolderIds(folder.id, folders);
    if (descendantIds.includes(currentFolder)) chip.classList.add('active');
    chip.dataset.folder = folder.id;
    chip.innerHTML = `
      <span class="folder-chip-dot" style="background:${folder.color};"></span>
      ${escapeHtml(folder.name)}
      ${hasChildren ? '<i class="fas fa-caret-down" style="font-size:0.65rem;opacity:0.5;margin-left:-2px;"></i>' : ''}
      <span class="folder-chip-count">${count}</span>
      <span class="folder-chip-delete" title="Opcoes"><i class="fas fa-ellipsis-v"></i></span>
    `;

    chip.addEventListener('click', (e) => {
      if (e.target.closest('.folder-chip-delete')) return;
      setCurrentFolder(page, folder.id);
    });

    chip.querySelector('.folder-chip-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      showFolderContextMenu(e, folder, page);
    });

    container.appendChild(chip);

    // Show child folders as sub-chips if parent or child is active
    if (currentFolder === folder.id || descendantIds.includes(currentFolder)) {
      const children = folders.filter(f => f.parentId === folder.id);
      children.forEach(child => {
        const cCount = getTotalCount(child.id);
        const subChip = document.createElement('button');
        subChip.className = `folder-chip folder-chip-sub ${currentFolder === child.id ? 'active' : ''}`;
        subChip.dataset.folder = child.id;
        subChip.innerHTML = `
          <span class="folder-chip-dot" style="background:${child.color};width:6px;height:6px;"></span>
          ${escapeHtml(child.name)}
          <span class="folder-chip-count">${cCount}</span>
          <span class="folder-chip-delete" title="Opcoes"><i class="fas fa-ellipsis-v"></i></span>
        `;
        subChip.addEventListener('click', (e) => {
          if (e.target.closest('.folder-chip-delete')) return;
          setCurrentFolder(page, child.id);
        });
        subChip.querySelector('.folder-chip-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          showFolderContextMenu(e, child, page);
        });
        container.appendChild(subChip);
      });
    }
  });

  container.querySelector('[data-folder="all"]').addEventListener('click', () => setCurrentFolder(page, 'all'));
}

function renderAllFolderChips() {
  FOLDER_PAGES.forEach(p => renderFolderChips(p));
}

function setCurrentFolder(page, folderId) {
  currentFolderByPage[page] = folderId;
  PAGE_RENDER_FN[page]?.();
  renderFolderChips(page);
}

function showFolderContextMenu(e, folder, page) {
  document.querySelectorAll('.folder-context-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'folder-context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  // Build "Mover para" submenu items
  const allFolders = getFolders();
  const validTargets = allFolders.filter(f => {
    if (f.id === folder.id) return false; // can't move to self
    if (f.parentId === folder.id) return false; // already a direct child
    const childIds = getChildFolderIds(folder.id, allFolders);
    if (childIds.includes(f.id)) return false; // can't move to descendant
    return true;
  });

  let moveItemsHTML = '';
  if (folder.parentId) {
    moveItemsHTML += `<button class="folder-context-item folder-context-sub" data-action="move-root"><i class="fas fa-arrow-up"></i> Raiz (remover de pasta)</button>`;
  }
  validTargets.forEach(t => {
    moveItemsHTML += `<button class="folder-context-item folder-context-sub" data-move-target="${t.id}"><span class="folder-ctx-dot" style="background:${t.color};"></span> ${escapeHtml(t.name)}</button>`;
  });

  menu.innerHTML = `
    <button class="folder-context-item" data-action="rename"><i class="fas fa-pen"></i> Renomear</button>
    <button class="folder-context-item" data-action="move"><i class="fas fa-folder-open"></i> Mover para pasta <i class="fas fa-chevron-right" style="margin-left:auto;font-size:0.6rem;opacity:0.5;"></i></button>
    <div class="folder-context-submenu" style="display:none;">
      ${moveItemsHTML || '<div class="folder-context-item" style="opacity:0.5;cursor:default;font-size:0.75rem;">Nenhuma pasta disponivel</div>'}
    </div>
    <button class="folder-context-item danger" data-action="delete"><i class="fas fa-trash"></i> Excluir pasta</button>
  `;

  // Toggle submenu
  menu.querySelector('[data-action="move"]').addEventListener('click', (ev) => {
    ev.stopPropagation();
    const sub = menu.querySelector('.folder-context-submenu');
    sub.style.display = sub.style.display === 'none' ? 'flex' : 'none';
  });

  // Move to root
  menu.querySelector('[data-action="move-root"]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    setFolderParent(folder.id, null);
    renderAllFolderChips();
    if (currentTab === 'folders') renderFoldersPage();
    showToast(`"${folder.name}" movida para raiz`, 'success');
  });

  // Move to target folder
  menu.querySelectorAll('[data-move-target]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      menu.remove();
      const targetId = btn.dataset.moveTarget;
      const target = allFolders.find(f => f.id === targetId);
      setFolderParent(folder.id, targetId);
      renderAllFolderChips();
      if (currentTab === 'folders') renderFoldersPage();
      showToast(`"${folder.name}" movida para "${target?.name}"`, 'success');
    });
  });

  menu.querySelector('[data-action="rename"]').addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    const newName = prompt('Novo nome da pasta:', folder.name);
    if (newName && newName.trim()) {
      renameFolder(folder.id, newName.trim());
      renderAllFolderChips();
      if (currentTab === 'folders') renderFoldersPage();
      showToast('Pasta renomeada!', 'success');
    }
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    if (confirm(`Excluir a pasta "${folder.name}"? Os itens nao serao excluidos.`)) {
      deleteFolderById(folder.id);
      setCurrentFolder(page, 'all');
      if (currentTab === 'folders') renderFoldersPage();
      showToast('Pasta excluida!', 'success');
    }
  });

  document.body.appendChild(menu);

  // Adjust position if off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
}

// Folder Modal
let folderModalPage = '';
let folderModalEditId = null;

function openFolderModal(page, editFolder) {
  folderModalPage = page;
  folderModalEditId = editFolder?.id || null;
  const modal = document.getElementById('folderModal');
  const title = document.getElementById('folderModalTitle');
  const input = document.getElementById('folderModalName');
  const saveBtn = document.getElementById('folderModalSave');

  if (editFolder) {
    title.innerHTML = '<i class="fas fa-pen"></i> Editar Pasta';
    input.value = editFolder.name;
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvar';
  } else {
    title.innerHTML = '<i class="fas fa-folder-plus"></i> Nova Pasta';
    input.value = '';
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Criar';
  }

  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 100);
}

function closeFolderModal() {
  document.getElementById('folderModal').style.display = 'none';
  folderModalEditId = null;
}

function saveFolderFromModal() {
  const name = document.getElementById('folderModalName').value.trim();
  if (!name) { showToast('Digite um nome para a pasta', 'error'); return; }

  const color = document.querySelector('.folder-color-opt.selected')?.dataset.color || '#AD39FB';
  const isEditing = !!folderModalEditId;
  const page = folderModalPage;

  if (isEditing) {
    renameFolder(folderModalEditId, name);
  } else {
    createFolder(page, name, color);
  }

  closeFolderModal();
  renderAllFolderChips();
  if (currentTab === 'folders') renderFoldersPage();
  showToast(isEditing ? 'Pasta atualizada!' : 'Pasta criada!', 'success');
}

// Move to Folder Modal
let moveToFolderCallback = null;
let _moveFolderDragId = null;

function openMoveToFolderModal(page, itemId, currentFolderId) {
  const modal = document.getElementById('moveToFolderModal');
  const list = document.getElementById('moveFolderList');
  const folders = getFolders();

  list.innerHTML = '';

  // "No folder" option
  const noneItem = document.createElement('button');
  noneItem.className = `move-folder-item ${!currentFolderId ? 'active' : ''}`;
  noneItem.innerHTML = '<i class="fas fa-layer-group"></i> Sem pasta';
  noneItem.addEventListener('click', () => {
    setItemFolder(page, itemId, null);
    closeMoveToFolderModal();
    refreshPageAfterFolderChange(page);
    showToast('Item removido da pasta', 'success');
  });
  // Drop on "Sem pasta" to move folder to root
  noneItem.addEventListener('dragover', (e) => { e.preventDefault(); noneItem.classList.add('drag-over'); });
  noneItem.addEventListener('dragleave', () => noneItem.classList.remove('drag-over'));
  noneItem.addEventListener('drop', (e) => {
    e.preventDefault();
    noneItem.classList.remove('drag-over');
    if (_moveFolderDragId) {
      setFolderParent(_moveFolderDragId, null);
      _moveFolderDragId = null;
      openMoveToFolderModal(page, itemId, currentFolderId); // Re-render
      renderAllFolderChips();
      showToast('Pasta movida para raiz', 'success');
    }
  });
  list.appendChild(noneItem);

  // Render folders hierarchically
  function renderFolderItems(parentId, depth) {
    const children = folders.filter(f => (f.parentId || null) === parentId);
    children.forEach(folder => {
      const item = document.createElement('div');
      item.className = `move-folder-item ${currentFolderId === folder.id ? 'active' : ''}`;
      item.draggable = true;
      item.dataset.folderId = folder.id;
      item.style.paddingLeft = (12 + depth * 20) + 'px';

      const hasChildren = folders.some(f => f.parentId === folder.id);
      item.innerHTML = `
        <i class="fas fa-grip-vertical move-folder-drag-handle"></i>
        <span class="move-folder-item-dot" style="background:${folder.color};"></span>
        <span class="move-folder-item-name">${escapeHtml(folder.name)}</span>
        ${hasChildren ? '<i class="fas fa-folder-open" style="margin-left:auto;font-size:0.65rem;opacity:0.4;"></i>' : ''}
      `;

      // Click to select folder for item
      item.addEventListener('click', (e) => {
        if (e.target.closest('.move-folder-drag-handle')) return;
        setItemFolder(page, itemId, folder.id);
        closeMoveToFolderModal();
        refreshPageAfterFolderChange(page);
        showToast(`Movido para "${folder.name}"`, 'success');
      });

      // Drag start
      item.addEventListener('dragstart', (e) => {
        _moveFolderDragId = folder.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        _moveFolderDragId = null;
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      // Drop target
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (_moveFolderDragId && _moveFolderDragId !== folder.id) {
          item.classList.add('drag-over');
        }
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (_moveFolderDragId && _moveFolderDragId !== folder.id) {
          const draggedId = _moveFolderDragId;
          _moveFolderDragId = null;
          setFolderParent(draggedId, folder.id);
          openMoveToFolderModal(page, itemId, currentFolderId); // Re-render
          renderAllFolderChips();
          const draggedFolder = folders.find(f => f.id === draggedId);
          showToast(`"${draggedFolder?.name}" agora é subpasta de "${folder.name}"`, 'success');
        }
      });

      list.appendChild(item);

      // Render children recursively
      renderFolderItems(folder.id, depth + 1);
    });
  }

  renderFolderItems(null, 0);

  if (folders.length === 0) {
    list.innerHTML += '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.8rem;"><i class="fas fa-folder-plus"></i><br>Crie uma pasta primeiro</div>';
  }

  modal.style.display = 'flex';
}

function closeMoveToFolderModal() {
  document.getElementById('moveToFolderModal').style.display = 'none';
}

function refreshPageAfterFolderChange(page) {
  renderFolderChips(page);
  PAGE_RENDER_FN[page]?.();
  if (currentTab === 'folders') renderFoldersPage();
}

// =============================================
// === FOLDERS PAGE (Central Directory) ===
// =============================================

let foldersPageCurrentId = null; // null = root
let foldersPageViewMode = 'grid'; // 'grid' or 'list'

function initFoldersPage() {
  document.getElementById('foldersPageNewBtn')?.addEventListener('click', () => {
    openFolderModal('gallery');
  });
  document.getElementById('foldersViewGrid')?.addEventListener('click', () => {
    foldersPageViewMode = 'grid';
    renderFoldersPage();
  });
  document.getElementById('foldersViewList')?.addEventListener('click', () => {
    foldersPageViewMode = 'list';
    renderFoldersPage();
  });
}

async function renderFoldersPage() {
  const container = document.getElementById('foldersPageContent');
  const emptyEl = document.getElementById('foldersPageEmpty');
  const statusbar = document.getElementById('foldersStatusbar');
  if (!container) return;

  const folders = getFolders();
  const currentParent = foldersPageCurrentId;
  const isListView = foldersPageViewMode === 'list';

  // Update view buttons
  document.getElementById('foldersViewGrid')?.classList.toggle('active', !isListView);
  document.getElementById('foldersViewList')?.classList.toggle('active', isListView);

  // Update breadcrumb
  renderFoldersBreadcrumb(currentParent, folders);

  const subfolders = folders.filter(f => (f.parentId || null) === currentParent);

  // Collect items
  let allItems = [];
  try {
    const [galleryItems, historyItems] = await Promise.all([getGalleryItems('all'), getHistoryItems('all')]);
    const storyboards = getSavedStoryboards();
    const galleryMap = getFolderMap('gallery');
    const historyMap = getFolderMap('history');
    const storyboardMap = getFolderMap('storyboard');

    const addItems = (items, map, source, label) => {
      items.forEach(item => {
        const fid = map[String(item.id)] || null;
        if (currentParent === null ? !fid : fid === currentParent) {
          allItems.push({ ...item, _source: source, _sourceLabel: label });
        }
      });
    };

    addItems(galleryItems, galleryMap, 'gallery', 'Galeria');
    addItems(historyItems, historyMap, 'history', 'Historico');
    addItems(storyboards.map(s => ({ ...s, type: s.type || 'storyboard' })), storyboardMap, 'storyboard', 'Storyboard');
  } catch (e) { console.error('Folders page load error:', e); }

  allItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  revokeBlobUrls(container);
  container.innerHTML = '';

  if (subfolders.length === 0 && allItems.length === 0 && currentParent === null) {
    emptyEl.style.display = '';
    container.style.display = 'none';
    if (statusbar) statusbar.textContent = '';
    return;
  }
  emptyEl.style.display = 'none';
  container.style.display = '';

  // Single unified grid (folders + files, like Windows Explorer)
  const grid = document.createElement('div');
  grid.className = `folders-explorer-grid${isListView ? ' list-view' : ''}`;

  // --- Folders ---
  if (subfolders.length > 0) {
    const fLabel = document.createElement('div');
    fLabel.className = 'fe-section-label';
    fLabel.innerHTML = `<i class="fas fa-folder"></i> Pastas <span class="fe-section-count">${subfolders.length}</span>`;
    grid.appendChild(fLabel);

    subfolders.forEach(folder => {
      const descendantIds = getFolderAndDescendantIds(folder.id, folders);
      let totalItems = 0;
      FOLDER_PAGES.forEach(page => {
        const map = getFolderMap(page);
        Object.values(map).forEach(fid => { if (descendantIds.includes(fid)) totalItems++; });
      });

      const childCount = folders.filter(f => f.parentId === folder.id).length;
      const card = document.createElement('div');
      card.className = 'fe-card fe-card-folder';
      card.draggable = true;
      card.dataset.folderId = folder.id;
      card.innerHTML = `
        <div class="fe-folder-icon" style="color:${folder.color};"><i class="fas fa-folder"></i></div>
        <div class="fe-name">${escapeHtml(folder.name)}</div>
        <div class="fe-folder-meta">${totalItems} arquivo${totalItems !== 1 ? 's' : ''}${childCount > 0 ? ` · ${childCount} subpasta${childCount !== 1 ? 's' : ''}` : ''}</div>
        <button class="fe-action" title="Opcoes"><i class="fas fa-ellipsis-v"></i></button>
      `;

      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('.fe-action')) return;
        foldersPageCurrentId = folder.id;
        renderFoldersPage();
      });
      card.addEventListener('click', (e) => {
        if (e.target.closest('.fe-action')) return;
        grid.querySelectorAll('.fe-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });

      card.querySelector('.fe-action').addEventListener('click', (e) => {
        e.stopPropagation();
        showFolderContextMenu(e, folder, 'gallery');
        const observer = new MutationObserver(() => {
          if (!document.querySelector('.folder-context-menu')) {
            observer.disconnect();
            setTimeout(() => renderFoldersPage(), 100);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });

      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', folder.id); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        // Check if dropping a file item
        const fileData = e.dataTransfer.getData('application/x-file-item');
        if (fileData) {
          try {
            const { id, source } = JSON.parse(fileData);
            const page = source === 'storyboard' ? 'storyboard' : source === 'history' ? 'history' : 'gallery';
            setItemFolder(page, id, folder.id);
            renderFoldersPage();
            showToast(`Arquivo movido para "${folder.name}"`, 'success');
          } catch(err) { console.error('Drop file error:', err); }
          return;
        }
        // Otherwise it's a folder drag
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== folder.id) {
          setFolderParent(draggedId, folder.id);
          renderFoldersPage();
          renderAllFolderChips();
          showToast(`Pasta movida para "${folder.name}"`, 'success');
        }
      });

      grid.appendChild(card);
    });
  }

  // --- Section label for files ---
  if (allItems.length > 0 && subfolders.length > 0) {
    const label = document.createElement('div');
    label.className = 'fe-section-label';
    label.innerHTML = `<i class="fas fa-file"></i> Arquivos <span class="fe-section-count">${allItems.length}</span>
      <button class="fe-add-file-btn" title="Adicionar arquivos"><i class="fas fa-plus"></i> Adicionar</button>`;
    label.querySelector('.fe-add-file-btn')?.addEventListener('click', () => triggerFolderFileUpload(currentParent));
    grid.appendChild(label);
  }

  // --- Add file button card ---
  {
    const addCard = document.createElement('div');
    addCard.className = 'fe-card fe-add-file-card';
    addCard.innerHTML = `
      <div class="fe-file-thumb"><i class="fas fa-plus" style="font-size:2rem;color:var(--accent-primary);opacity:0.7;"></i></div>
      <div class="fe-name">Adicionar arquivo</div>
    `;
    addCard.addEventListener('click', () => triggerFolderFileUpload(currentParent));
    grid.appendChild(addCard);
  }

  // --- Files ---
  const typeIcons = { image: 'fa-image', video: 'fa-video', audio: 'fa-headphones', text: 'fa-font', storyboard: 'fa-book-open' };
  const typeColors = { image: '#4a6cf7', video: '#ef4444', audio: '#34d399', text: '#f59e0b', storyboard: '#8b5cf6' };
  const typeLabels = { image: 'Imagem', video: 'Video', audio: 'Audio', text: 'Texto', storyboard: 'Storyboard' };

  allItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'fe-card';
    card.draggable = true;
    const icon = typeIcons[item.type] || 'fa-file';
    const color = typeColors[item.type] || '#888';
    const name = (item.prompt || item.name || 'Sem titulo').substring(0, 40);

    let thumbHTML = '';
    if (item.type === 'image') {
      const url = item.data instanceof Blob ? URL.createObjectURL(item.data) : item.data;
      thumbHTML = `<img src="${url}" alt="">`;
    } else if (item.type === 'video') {
      thumbHTML = `<i class="fas fa-play-circle" style="color:${color};font-size:2rem;"></i>`;
    } else {
      thumbHTML = `<i class="fas ${icon}" style="color:${color};"></i>`;
    }

    card.innerHTML = `
      <div class="fe-file-thumb">${thumbHTML}</div>
      <div class="fe-name" title="${escapeHtml(item.prompt || item.name || '')}">${escapeHtml(name)}</div>
      <div class="fe-type" style="color:${color};">${typeLabels[item.type] || ''}</div>
      <button class="fe-action fe-file-menu" title="Opcoes"><i class="fas fa-ellipsis-v"></i></button>
    `;

    // Drag file to folder
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-file-item', JSON.stringify({ id: item.id, source: item._source }));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    // 3-dot menu
    card.querySelector('.fe-file-menu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showFileContextMenu(e, item, currentParent);
    });

    // Click to preview
    card.addEventListener('click', (e) => {
      if (e.target.closest('.fe-file-menu')) return;
      openGalleryPreview(item);
    });

    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Empty folder
  if (subfolders.length === 0 && allItems.length === 0 && currentParent !== null) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text-muted);">
        <i class="fas fa-folder-open" style="font-size:2.5rem;opacity:0.2;margin-bottom:12px;display:block;"></i>
        <p style="font-size:0.85rem;">Pasta vazia</p>
        <p style="font-size:0.72rem;margin-top:4px;opacity:0.6;">Arraste pastas para ca ou mova arquivos</p>
      </div>
    `;
  }

  // Status bar + item count
  const total = subfolders.length + allItems.length;
  const statusText = `${total} iten${total !== 1 ? 's' : ''}${subfolders.length ? ` · ${subfolders.length} pasta${subfolders.length !== 1 ? 's' : ''}` : ''}${allItems.length ? ` · ${allItems.length} arquivo${allItems.length !== 1 ? 's' : ''}` : ''}`;
  if (statusbar) statusbar.textContent = statusText;
  const countEl = document.getElementById('foldersItemCount');
  if (countEl) countEl.textContent = statusText;
}

function triggerFolderFileUpload(folderId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,video/*,audio/*,.txt,.md,.json';
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (const file of files) {
      let type = 'text';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      const data = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(file);
      });
      const savedId = await saveToGallery({
        type,
        prompt: file.name,
        provider: 'Upload manual',
        data,
        mimeType: file.type || 'application/octet-stream',
        timestamp: Date.now()
      });
      if (savedId && folderId) {
        setItemFolder('gallery', savedId, folderId);
      }
    }
    renderFoldersPage();
    showToast(`${files.length} arquivo(s) adicionado(s)`, 'success');
  });
  input.click();
}

function openEditItemModal(item) {
  const modal = document.getElementById('editItemModal');
  const promptInput = document.getElementById('editItemPrompt');
  const providerInput = document.getElementById('editItemProvider');
  if (!modal) return;

  promptInput.value = item.prompt || '';
  providerInput.value = item.provider || '';
  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('editItemModalClose').onclick = close;
  document.getElementById('editItemCancelBtn').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  document.getElementById('editItemSaveBtn').onclick = async () => {
    const newPrompt = promptInput.value.trim();
    const newProvider = providerInput.value.trim();
    try {
      const db = await openGalleryDB();
      const tx = db.transaction(GALLERY_STORE, 'readwrite');
      const store = tx.objectStore(GALLERY_STORE);
      const req = store.get(item.id);
      req.onsuccess = () => {
        const data = req.result;
        if (!data) return;
        data.prompt = newPrompt || data.prompt;
        data.provider = newProvider || data.provider;
        store.put(data);
        tx.oncomplete = () => {
          close();
          renderFoldersPage();
          renderGallery();
          showToast('Informacoes atualizadas!', 'success');
        };
      };
    } catch (err) {
      console.error('Edit item error:', err);
      showToast('Erro ao salvar', 'error');
    }
  };
}

function showFileContextMenu(e, item, currentParent) {
  document.querySelectorAll('.file-context-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'file-context-menu';

  const typeLabels = { image: 'Imagem', video: 'Video', audio: 'Audio', text: 'Texto' };
  const viewLabel = item.type === 'video' ? 'Reproduzir' : item.type === 'audio' ? 'Ouvir' : 'Visualizar';
  const viewIcon = item.type === 'video' ? 'fa-play' : item.type === 'audio' ? 'fa-headphones' : 'fa-eye';

  menu.innerHTML = `
    <div class="fcm-item" data-action="preview"><i class="fas ${viewIcon}"></i> ${viewLabel}</div>
    <div class="fcm-item" data-action="edit"><i class="fas fa-edit"></i> Editar info</div>
    <div class="fcm-item" data-action="move"><i class="fas fa-folder-open"></i> Mover para pasta</div>
    <div class="fcm-item" data-action="download"><i class="fas fa-download"></i> Baixar</div>
    <div class="fcm-item" data-action="moodboard"><i class="fas fa-palette"></i> Moodboard</div>
    <div class="fcm-divider"></div>
    <div class="fcm-item fcm-danger" data-action="delete"><i class="fas fa-trash"></i> Excluir</div>
  `;

  document.body.appendChild(menu);

  // Position
  const rect = e.target.closest('.fe-action').getBoundingClientRect();
  let top = rect.bottom + 4;
  let left = rect.left;
  if (top + menu.offsetHeight > window.innerHeight) top = rect.top - menu.offsetHeight - 4;
  if (left + menu.offsetWidth > window.innerWidth) left = window.innerWidth - menu.offsetWidth - 8;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';

  menu.addEventListener('click', async (ev) => {
    const action = ev.target.closest('.fcm-item')?.dataset.action;
    if (!action) return;
    menu.remove();
    switch (action) {
      case 'preview':
        openGalleryPreview(item);
        break;
      case 'edit':
        openEditItemModal(item);
        break;
      case 'move':
        openMoveToFolderModal(item._source, item.id, currentParent);
        break;
      case 'download':
        downloadGalleryItem(item.id);
        break;
      case 'moodboard':
        addGalleryItemToMoodboard(item);
        break;
      case 'delete':
        if (confirm('Mover para lixeira?')) {
          await moveToTrash(item.id);
          renderFoldersPage();
          showToast('Item movido para lixeira', 'success');
        }
        break;
    }
  });

  const closeMenu = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function renderFoldersBreadcrumb(currentId, folders) {
  const bc = document.getElementById('foldersBreadcrumb');
  if (!bc) return;
  bc.innerHTML = '';

  const rootBtn = document.createElement('button');
  rootBtn.className = `breadcrumb-item ${!currentId ? 'active' : ''}`;
  rootBtn.innerHTML = '<i class="fas fa-home"></i> Raiz';
  rootBtn.addEventListener('click', () => { foldersPageCurrentId = null; renderFoldersPage(); });
  bc.appendChild(rootBtn);

  if (currentId) {
    const path = getFolderPath(currentId, folders);
    path.forEach((folder, i) => {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.innerHTML = '<i class="fas fa-chevron-right"></i>';
      bc.appendChild(sep);

      const btn = document.createElement('button');
      btn.className = `breadcrumb-item ${i === path.length - 1 ? 'active' : ''}`;
      btn.innerHTML = `<span class="breadcrumb-dot" style="background:${folder.color};"></span> ${escapeHtml(folder.name)}`;
      btn.addEventListener('click', () => { foldersPageCurrentId = folder.id; renderFoldersPage(); });
      bc.appendChild(btn);
    });
  }
}

function initFoldersPageDrop() {
  const content = document.getElementById('foldersPageContent');
  if (!content) return;
  content.addEventListener('dragover', (e) => {
    if (e.target === content) e.preventDefault();
  });
  content.addEventListener('drop', (e) => {
    if (e.target !== content) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      setFolderParent(draggedId, foldersPageCurrentId);
      renderFoldersPage();
      renderAllFolderChips();
      showToast('Pasta movida', 'success');
    }
  });
}

// =============================================
// === AI SMART SEARCH (Pollinations - Free) ===
// =============================================

function initAiSearch() {
  FOLDER_PAGES.forEach(page => {
    document.getElementById(page + 'AiSearchBtn')?.addEventListener('click', () => runAiSearch(page));
    document.getElementById(page + 'AiSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runAiSearch(page); });
  });
}

async function runAiSearch(page) {
  const inputId = page + 'AiSearch';
  const btnId = page + 'AiSearchBtn';
  const query = document.getElementById(inputId)?.value.trim();

  if (!query) {
    // Clear search - show all items
    clearAiSearchResults(page);
    return;
  }

  const btn = document.getElementById(btnId);
  btn?.classList.add('loading');

  try {
    const items = await getItemsForPage(page);
    if (items.length === 0) {
      showToast('Nenhum item para buscar', 'error');
      btn?.classList.remove('loading');
      return;
    }

    // Build item descriptions for the AI
    const itemDescriptions = items.map((item, i) => {
      const prompt = item.prompt || item.text || '';
      const type = item.type || '';
      const provider = item.provider || '';
      return `[${i}] ${type} | ${provider} | "${prompt.substring(0, 100)}"`;
    }).join('\n');

    const aiPrompt = `Voce e um assistente de busca. O usuario busca: "${query}"

Aqui estao os itens disponiveis:
${itemDescriptions}

Retorne APENAS os numeros dos itens que correspondem a busca, separados por virgula. Se nenhum corresponder, retorne "NONE". Considere sinonimos, termos relacionados e contexto semantico. Responda SOMENTE com os numeros ou NONE, nada mais.`;

    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Voce e um assistente de busca. Responda SOMENTE com numeros separados por virgula ou NONE.' },
          { role: 'user', content: aiPrompt }
        ],
        model: 'openai',
        seed: 42
      })
    });

    if (!response.ok) throw new Error('Erro na busca IA');

    const text = await response.text();

    if (text.trim().toUpperCase() === 'NONE' || !text.match(/\d/)) {
      showAiSearchNoResults(page, query);
      btn?.classList.remove('loading');
      return;
    }

    const indices = [...new Set(text.match(/\d+/g)?.map(Number) || [])];
    const matchedIds = indices.filter(i => i < items.length).map(i => items[i].id || items[i].trashId || i);

    highlightAiSearchResults(page, matchedIds, items, query);
  } catch (e) {
    console.error('AI Search error:', e);
    // Fallback to local fuzzy search
    runLocalFuzzySearch(page, query);
  }

  btn?.classList.remove('loading');
}

async function getItemsForPage(page) {
  if (page === 'gallery') return await getGalleryItems('all');
  if (page === 'history') return await getHistoryItems('all');
  if (page === 'moodboard') return [...moodboardItems];
  if (page === 'storyboard') {
    try { return JSON.parse(localStorage.getItem('saved_storyboards') || '[]'); } catch { return []; }
  }
  return [];
}

function runLocalFuzzySearch(page, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

  getItemsForPage(page).then(items => {
    const scored = items.map((item, i) => {
      const text = [item.prompt, item.provider, item.type, item.text, item.detail, item.title].filter(Boolean).join(' ').toLowerCase();
      let score = 0;
      tokens.forEach(token => {
        if (text.includes(token)) score += 10;
        // Partial match
        else if (text.split(/\s+/).some(w => w.startsWith(token) || token.startsWith(w))) score += 5;
      });
      return { item, index: i, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      showAiSearchNoResults(page, query);
      return;
    }

    const matchedIds = scored.map(s => s.item.id || s.item.trashId || s.index);
    highlightAiSearchResults(page, matchedIds, items, query);
  });
}

function highlightAiSearchResults(page, matchedIds, allItems, query) {
  const matchedSet = new Set(matchedIds.map(String));
  aiSearchResultsByPage[page] = matchedSet;
  PAGE_RENDER_FN[page]?.();
  showToast(`IA encontrou ${matchedSet.size} resultado(s) para "${query}"`, 'success');
}

// AI search result sets per page (null = no search active, Set = active search filter)
const aiSearchResultsByPage = { gallery: null, history: null, moodboard: null, storyboard: null };

function clearAiSearchResults(page) {
  aiSearchResultsByPage[page] = null;
  PAGE_RENDER_FN[page]?.();
  document.getElementById(page + 'AiSearch').value = '';
}

function showAiSearchNoResults(page, query) {
  const containerId = PAGE_CONTAINER_IDS[page];
  if (containerId && document.getElementById(containerId)) {
    showToast(`Nenhum resultado para "${query}"`, 'error');
  }
}

// =============================================
// === STORYBOARD SAVE SYSTEM ===
// =============================================

function initStoryboardSave() {
  document.getElementById('sbSaveCurrentBtn')?.addEventListener('click', saveCurrentStoryboard);
  renderSavedStoryboards();
}

function saveCurrentStoryboard() {
  const grid = document.getElementById('storyboardGrid');
  const panels = grid?.querySelectorAll('.storyboard-panel');
  if (!panels || panels.length === 0) {
    showToast('Gere um storyboard primeiro', 'error');
    return;
  }

  const storyboardData = {
    id: 'sb_' + Date.now(),
    title: document.getElementById('storyboardPrompt')?.value?.substring(0, 60) || 'Storyboard sem titulo',
    prompt: document.getElementById('storyboardPrompt')?.value || '',
    panels: [],
    timestamp: Date.now(),
    style: document.querySelector('.sb-pill.style-pill.active')?.dataset.style || 'cinematic'
  };

  panels.forEach(panel => {
    const img = panel.querySelector('img');
    const desc = panel.querySelector('.sb-panel-description, .sb-panel-desc, p, .panel-text');
    storyboardData.panels.push({
      imageUrl: img?.src || '',
      description: desc?.textContent || ''
    });
  });

  const saved = getSavedStoryboards();
  saved.unshift(storyboardData);
  localStorage.setItem('saved_storyboards', JSON.stringify(saved));

  renderSavedStoryboards();
  renderFolderChips('storyboard');
  showToast('Storyboard salvo!', 'success');
}

function getSavedStoryboards() {
  try { return JSON.parse(localStorage.getItem('saved_storyboards') || '[]'); } catch { return []; }
}

function deleteSavedStoryboard(id) {
  const saved = getSavedStoryboards().filter(s => s.id !== id);
  localStorage.setItem('saved_storyboards', JSON.stringify(saved));
  // Remove from folder map
  const map = getFolderMap('storyboard');
  delete map[id];
  saveFolderMap('storyboard', map);
  renderSavedStoryboards();
  renderFolderChips('storyboard');
}

function renderSavedStoryboards() {
  const grid = document.getElementById('storyboardSavedGrid');
  const empty = document.getElementById('storyboardSavedEmpty');
  if (!grid) return;

  let saved = getSavedStoryboards();
  const folderMap = getFolderMap('storyboard');

  // Apply folder filter (includes subfolders)
  if (currentFolderByPage.storyboard === 'all') {
    saved = saved.filter(s => !folderMap[s.id]);
  } else {
    const validIds = getFolderAndDescendantIds(currentFolderByPage.storyboard, getFolders());
    saved = saved.filter(s => validIds.includes(folderMap[s.id]));
  }

  // Apply AI search filter
  if (aiSearchResultsByPage.storyboard) {
    saved = saved.filter(s => aiSearchResultsByPage.storyboard.has(String(s.id)));
  }

  if (saved.length === 0) {
    grid.style.display = 'none';
    empty.style.display = '';
    return;
  }

  grid.style.display = '';
  empty.style.display = 'none';
  grid.innerHTML = '';

  saved.forEach(sb => {
    const card = document.createElement('div');
    card.className = 'sb-saved-card';

    const thumbs = sb.panels.slice(0, 4).map(p =>
      p.imageUrl ? `<img src="${p.imageUrl}" alt="" loading="lazy">` : `<div class="sb-thumb-placeholder"><i class="fas fa-image"></i></div>`
    ).join('');

    const timeStr = new Date(sb.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const itemFolder = folderMap[sb.id];
    const folder = itemFolder ? getFolders().find(f => f.id === itemFolder) : null;
    const folderBadge = folder ? `<span class="item-folder-badge" style="background:${folder.color}20;color:${folder.color};"><span class="badge-dot" style="background:${folder.color};"></span>${folder.name}</span>` : '';

    card.innerHTML = `
      <div class="sb-saved-card-thumb">${thumbs}</div>
      <div class="sb-saved-card-info">
        <div class="sb-saved-card-title">${sb.title}</div>
        <div class="sb-saved-card-meta">
          <span><i class="fas fa-film"></i> ${sb.panels.length} paineis</span>
          <span><i class="fas fa-clock"></i> ${timeStr}</span>
          ${folderBadge}
        </div>
      </div>
      <div class="sb-saved-card-actions">
        <button class="sb-saved-card-action" title="Mover para pasta"><i class="fas fa-folder"></i></button>
        <button class="sb-saved-card-action" title="Carregar"><i class="fas fa-upload"></i></button>
        <button class="sb-saved-card-action btn-delete" title="Excluir"><i class="fas fa-trash"></i></button>
      </div>
    `;

    // Folder button
    card.querySelector('.sb-saved-card-action:nth-child(1)').addEventListener('click', (e) => {
      e.stopPropagation();
      openMoveToFolderModal('storyboard', sb.id, folderMap[sb.id]);
    });

    // Load button
    card.querySelector('.sb-saved-card-action:nth-child(2)').addEventListener('click', (e) => {
      e.stopPropagation();
      loadSavedStoryboard(sb);
    });

    // Delete button
    card.querySelector('.sb-saved-card-action.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Excluir este storyboard salvo?')) {
        deleteSavedStoryboard(sb.id);
        showToast('Storyboard excluido', 'success');
      }
    });

    grid.appendChild(card);
  });
}

function loadSavedStoryboard(sb) {
  const promptEl = document.getElementById('storyboardPrompt');
  if (promptEl) promptEl.value = sb.prompt || '';

  // Set style
  if (sb.style) {
    document.querySelectorAll('.sb-pill.style-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.style === sb.style);
    });
  }

  // Render panels
  const grid = document.getElementById('storyboardGrid');
  if (grid) {
    grid.innerHTML = '';
    sb.panels.forEach((panel, i) => {
      const panelEl = document.createElement('div');
      panelEl.className = 'storyboard-panel';
      panelEl.innerHTML = `
        <div class="sb-panel-header"><span>Painel ${i + 1}</span></div>
        ${panel.imageUrl ? `<img src="${panel.imageUrl}" alt="Panel ${i + 1}" style="width:100%;border-radius:var(--radius-sm);cursor:pointer;">` : '<div style="aspect-ratio:16/9;background:var(--bg-input);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);"><i class="fas fa-image"></i></div>'}
        <p style="font-size:0.78rem;color:var(--text-secondary);margin-top:8px;">${panel.description}</p>
      `;
      if (panel.imageUrl) {
        panelEl.querySelector('img')?.addEventListener('click', () => openLightbox(panel.imageUrl, panel.description || '', '', 'image'));
      }
      grid.appendChild(panelEl);
    });
  }

  document.getElementById('storyboardEmpty').style.display = 'none';
  showToast('Storyboard carregado!', 'success');
}

// ==================== BIBLIOTECA ====================

const BIBLIOTECA_DATA = {
  efeitos: [
    // === CAMERA CONTROLS ===
    { id: 'zoom-in', name: 'Zoom In', desc: 'Zoom suave que aproxima a camera do sujeito, criando foco e intimidade.', tags: ['camera', 'zoom', 'aproximação'], usage: 'Destacar detalhes, criar tensão dramática ou revelar elementos.', anim: 'zoomIn', video: '' },
    { id: 'zoom-out', name: 'Zoom Out', desc: 'Camera se afasta revelando mais do cenário ao redor, dando contexto.', tags: ['camera', 'zoom', 'revelar'], usage: 'Revelar localização, mostrar escala ou finalizar uma cena.', anim: 'zoomOut', video: '' },
    { id: 'crash-zoom-in', name: 'Crash Zoom In', desc: 'Zoom agressivo e rápido em direção ao sujeito, criando impacto visual imediato.', tags: ['camera', 'zoom', 'crash', 'impacto'], usage: 'Momentos de choque, revelações dramáticas ou estilo cômico.', anim: 'zoomIn', video: '' },
    { id: 'crash-zoom-out', name: 'Crash Zoom Out', desc: 'Zoom agressivo para trás revelando o cenário completo de forma súbita.', tags: ['camera', 'zoom', 'crash', 'revelar'], usage: 'Revelar escala épica, mostrar contexto de forma dramática.', anim: 'zoomOut', video: '' },
    { id: 'rapid-zoom-in', name: 'Rapid Zoom In', desc: 'Zoom rápido focando no sujeito com velocidade cinematográfica.', tags: ['camera', 'zoom', 'rápido', 'foco'], usage: 'Destacar reações, criar urgência ou enfatizar detalhes.', anim: 'zoomIn', video: '' },
    { id: 'rapid-zoom-out', name: 'Rapid Zoom Out', desc: 'Zoom rápido para trás com velocidade e energia cinematográfica.', tags: ['camera', 'zoom', 'rápido', 'revelar'], usage: 'Transições energéticas, revelações rápidas de cenário.', anim: 'zoomOut', video: '' },
    { id: 'yoyo-zoom', name: 'YoYo Zoom', desc: 'Zoom oscilante que vai e volta rapidamente criando efeito hipnótico.', tags: ['camera', 'zoom', 'oscilante', 'yoyo'], usage: 'Efeito estilístico, vídeos musicais ou momentos de impacto.', anim: 'dollyZoom', video: '' },
    { id: 'dolly-in', name: 'Dolly In', desc: 'Camera avança fisicamente em direção ao sujeito mantendo perspectiva natural.', tags: ['camera', 'dolly', 'avanço', 'tracking'], usage: 'Aproximação emocional, revelação de detalhes com profundidade natural.', anim: 'zoomIn', video: '' },
    { id: 'dolly-out', name: 'Dolly Out', desc: 'Camera recua fisicamente do sujeito revelando o ambiente ao redor.', tags: ['camera', 'dolly', 'recuo', 'revelar'], usage: 'Distanciamento emocional, revelação de contexto.', anim: 'zoomOut', video: '' },
    { id: 'dolly-left', name: 'Dolly Left', desc: 'Camera se desloca lateralmente para a esquerda em tracking suave.', tags: ['camera', 'dolly', 'lateral', 'esquerda'], usage: 'Acompanhar movimento, revelar cenário lateral.', anim: 'panLeft', video: '' },
    { id: 'dolly-right', name: 'Dolly Right', desc: 'Camera se desloca lateralmente para a direita em tracking suave.', tags: ['camera', 'dolly', 'lateral', 'direita'], usage: 'Acompanhar movimento, revelar cenário lateral.', anim: 'panRight', video: '' },
    { id: 'super-dolly-in', name: 'Super Dolly In', desc: 'Dolly estendido com avanço prolongado, criando imersão total no cenário.', tags: ['camera', 'dolly', 'super', 'imersão'], usage: 'Entradas dramáticas, imersão em ambientes, intros cinematográficas.', anim: 'zoomIn', video: '' },
    { id: 'super-dolly-out', name: 'Super Dolly Out', desc: 'Dolly estendido com recuo prolongado, revelando cenários épicos.', tags: ['camera', 'dolly', 'super', 'épico'], usage: 'Finalizações épicas, revelar escala grandiosa.', anim: 'zoomOut', video: '' },
    { id: 'double-dolly', name: 'Double Dolly', desc: 'Dois movimentos de dolly combinados em sequência para dinamismo máximo.', tags: ['camera', 'dolly', 'duplo', 'dinâmico'], usage: 'Cenas de alta energia, perseguições ou montagens dinâmicas.', anim: 'dollyZoom', video: '' },
    { id: 'dolly-zoom-in', name: 'Dolly Zoom In (Vertigo)', desc: 'Efeito Hitchcock — camera avança enquanto faz zoom out, distorcendo perspectiva.', tags: ['camera', 'dolly', 'vertigo', 'hitchcock'], usage: 'Momentos de choque, revelação dramática ou desconforto visual.', anim: 'dollyZoom', video: '' },
    { id: 'dolly-zoom-out', name: 'Dolly Zoom Out', desc: 'Camera recua enquanto faz zoom in, criando sensação surreal inversa ao vertigo.', tags: ['camera', 'dolly', 'vertigo', 'surreal'], usage: 'Sensação de isolamento, momentos oníricos ou suspense.', anim: 'dollyZoom', video: '' },
    { id: 'pan-left', name: 'Pan Left', desc: 'Rotação horizontal da camera para a esquerda sobre seu eixo.', tags: ['camera', 'pan', 'horizontal', 'esquerda'], usage: 'Seguir personagem, revelar ambiente ou criar continuidade.', anim: 'panLeft', video: '' },
    { id: 'pan-right', name: 'Pan Right', desc: 'Rotação horizontal da camera para a direita sobre seu eixo.', tags: ['camera', 'pan', 'horizontal', 'direita'], usage: 'Acompanhar movimento, revelar cenário ou transição suave.', anim: 'panRight', video: '' },
    { id: 'whip-pan', name: 'Whip Pan', desc: 'Pan ultra rápido criando motion blur entre dois pontos da cena.', tags: ['camera', 'whip', 'pan', 'rápido', 'blur'], usage: 'Transições energéticas, cenas de ação ou montagens rápidas.', anim: 'whipPan', video: '' },
    { id: 'tilt-up', name: 'Tilt Up', desc: 'Camera se inclina para cima revelando altura e grandiosidade.', tags: ['camera', 'tilt', 'vertical', 'cima'], usage: 'Mostrar grandiosidade de prédios, personagens imponentes.', anim: 'tiltUp', video: '' },
    { id: 'tilt-down', name: 'Tilt Down', desc: 'Camera se inclina para baixo revelando o que está abaixo.', tags: ['camera', 'tilt', 'vertical', 'baixo'], usage: 'Revelar detalhes no chão, criar vertigem ou perspectiva aérea.', anim: 'tiltDown', video: '' },
    { id: 'crane-up', name: 'Crane Up', desc: 'Camera sobe em movimento de grua, elevando o ponto de vista gradualmente.', tags: ['camera', 'crane', 'grua', 'subir'], usage: 'Revelar cenários de cima, finalizações épicas, vista aérea progressiva.', anim: 'tiltUp', video: '' },
    { id: 'crane-down', name: 'Crane Down', desc: 'Camera desce em movimento de grua, aproximando o ponto de vista do chão.', tags: ['camera', 'crane', 'grua', 'descer'], usage: 'Aterrissar em detalhes, aproximação dramática do sujeito.', anim: 'tiltDown', video: '' },
    { id: 'crane-over-head', name: 'Crane Over The Head', desc: 'Grua faz arco por cima do sujeito, revelando perspectiva aérea dramática.', tags: ['camera', 'crane', 'arco', 'aéreo'], usage: 'Introduções de personagens, revelar cenários épicos.', anim: 'orbit', video: '' },
    { id: 'jib-up', name: 'Jib Up', desc: 'Movimento ascendente de jib crane com leveza e suavidade.', tags: ['camera', 'jib', 'subir', 'suave'], usage: 'Revelações suaves, transições verticais elegantes.', anim: 'tiltUp', video: '' },
    { id: 'jib-down', name: 'Jib Down', desc: 'Movimento descendente de jib crane com controle preciso.', tags: ['camera', 'jib', 'descer', 'preciso'], usage: 'Aterrissar suavemente em detalhes ou sujeitos.', anim: 'tiltDown', video: '' },
    { id: '360-orbit', name: '360 Orbit', desc: 'Camera faz uma órbita completa de 360 graus ao redor do sujeito.', tags: ['camera', 'orbit', '360', 'circular', 'rotação'], usage: 'Apresentar produtos, personagens ou objetos de todos os ângulos.', anim: 'orbit', video: '' },
    { id: 'arc-left', name: 'Arc Left', desc: 'Camera faz movimento circular para a esquerda ao redor do sujeito.', tags: ['camera', 'arc', 'circular', 'esquerda'], usage: 'Revelar ângulos novos, adicionar dinamismo à composição.', anim: 'orbit', video: '' },
    { id: 'arc-right', name: 'Arc Right', desc: 'Camera faz movimento circular para a direita ao redor do sujeito.', tags: ['camera', 'arc', 'circular', 'direita'], usage: 'Revelar ângulos novos, adicionar dinamismo à composição.', anim: 'orbit', video: '' },
    { id: '3d-rotation', name: '3D Rotation', desc: 'Rotação tridimensional completa do sujeito ou cenário.', tags: ['camera', '3D', 'rotação', 'perspectiva'], usage: 'Apresentação de objetos 3D, efeitos surreais ou estilísticos.', anim: 'orbit', video: '' },
    { id: 'lazy-susan', name: 'Lazy Susan', desc: 'Rotação suave e contínua de 360 graus como um prato giratório.', tags: ['camera', 'rotação', 'contínua', 'suave'], usage: 'Apresentação de produtos, food videos, objetos em destaque.', anim: 'orbit', video: '' },
    { id: 'dutch-angle', name: 'Dutch Angle', desc: 'Camera se inclina lateralmente criando horizonte torto e desconforto visual.', tags: ['camera', 'dutch', 'ângulo', 'inclinado', 'torto'], usage: 'Suspense, desorientação, cenas de vilão ou instabilidade.', anim: 'shake', video: '' },
    { id: 'overhead', name: 'Overhead / Top Down', desc: 'Visão diretamente de cima para baixo, perspectiva birds eye view.', tags: ['camera', 'overhead', 'topo', 'aéreo', 'birds-eye'], usage: 'Cooking videos, flat lays, cenas de planejamento, mapas.', anim: 'tiltDown', video: '' },
    { id: 'incline', name: 'Incline', desc: 'Camera se inclina para cima em ângulo progressivo, olhando cada vez mais alto.', tags: ['camera', 'incline', 'ângulo', 'cima'], usage: 'Revelar altura de estruturas, cenas de admiração.', anim: 'tiltUp', video: '' },
    { id: 'fpv-drone', name: 'FPV Drone', desc: 'Perspectiva de primeira pessoa de drone FPV com movimentos acrobáticos.', tags: ['camera', 'drone', 'FPV', 'aéreo', 'acrobático'], usage: 'Vídeos de ação, tours imersivos, cenas de perseguição aérea.', anim: 'orbit', video: '' },
    { id: 'aerial-pullback', name: 'Aerial Pullback', desc: 'Camera se afasta para o alto revelando paisagem ampla vista de drone.', tags: ['camera', 'aéreo', 'pullback', 'paisagem', 'drone'], usage: 'Revelar localizações, finalizações cinematográficas, establishing shots.', anim: 'zoomOut', video: '' },
    { id: 'handheld', name: 'Handheld', desc: 'Movimento naturalístico com tremor orgânico de camera na mão.', tags: ['camera', 'handheld', 'orgânico', 'natural', 'tremor'], usage: 'Documentários, cenas íntimas, realismo ou estilo found footage.', anim: 'shake', video: '' },
    { id: 'snorricam', name: 'Snorricam', desc: 'Camera fixada no corpo do sujeito — o cenário se move mas o sujeito fica estático.', tags: ['camera', 'snorricam', 'corpo', 'fixo', 'sujeito'], usage: 'Cenas de desorientação, embriaguez, corrida ou efeito psicológico.', anim: 'shake', video: '' },
    { id: 'hero-cam', name: 'Hero Cam', desc: 'Close-up cinematográfico focado no sujeito com composição heroica.', tags: ['camera', 'hero', 'close-up', 'cinematográfico'], usage: 'Introduções de personagens, momentos de destaque, cenas de poder.', anim: 'zoomIn', video: '' },
    { id: 'head-tracking', name: 'Head Tracking', desc: 'Camera acompanha automaticamente o movimento da cabeça do sujeito.', tags: ['camera', 'tracking', 'cabeça', 'seguir'], usage: 'Entrevistas dinâmicas, cenas de conversação, vlogs.', anim: 'panRight', video: '' },
    { id: 'eyes-in', name: 'Eyes In', desc: 'Zoom preciso focando diretamente nos olhos do sujeito.', tags: ['camera', 'zoom', 'olhos', 'close-up', 'detalhe'], usage: 'Momentos de revelação emocional, tensão ou conexão com o espectador.', anim: 'zoomIn', video: '' },
    { id: 'object-pov', name: 'Object POV', desc: 'Ponto de vista a partir de um objeto, mostrando o mundo pela perspectiva dele.', tags: ['camera', 'POV', 'objeto', 'perspectiva'], usage: 'Storytelling criativo, perspectivas inusitadas, humor.', anim: 'dollyZoom', video: '' },
    { id: 'buckle-up', name: 'Buckle Up', desc: 'Push de camera dinâmico e acelerado como se estivesse decolando.', tags: ['camera', 'push', 'dinâmico', 'acelerado'], usage: 'Cenas de ação, partidas de veículos, momentos de adrenalina.', anim: 'zoomIn', video: '' },
    { id: 'car-chasing', name: 'Car Chasing', desc: 'Camera perseguindo veículo em movimento, estilo cinema de ação.', tags: ['camera', 'carro', 'perseguição', 'ação', 'veículo'], usage: 'Cenas de perseguição, comerciais de carros, ação automotiva.', anim: 'panRight', video: '' },
    { id: 'car-grip', name: 'Car Grip', desc: 'Camera fixada no veículo com estabilização profissional.', tags: ['camera', 'carro', 'grip', 'fixo', 'veículo'], usage: 'Comerciais automotivos, cenas internas de carro, road trips.', anim: 'panLeft', video: '' },
    { id: 'road-rush', name: 'Road Rush', desc: 'Camera rente ao chão captando velocidade e movimento da estrada.', tags: ['camera', 'estrada', 'velocidade', 'chão', 'rush'], usage: 'Cenas de velocidade, skateboard, corridas, efeito de adrenalina.', anim: 'panRight', video: '' },
    { id: 'static', name: 'Static', desc: 'Camera completamente estática sem nenhum movimento — frame locked.', tags: ['camera', 'estático', 'fixo', 'lock'], usage: 'Diálogos, composições artísticas, foco total no sujeito.', anim: 'freezeFrame', video: '' },
    // === VISUAL EFFECTS ===
    { id: 'bullet-time', name: 'Bullet Time', desc: 'Camera congela o tempo e orbita ao redor do sujeito em slow-motion estilo Matrix.', tags: ['VFX', 'bullet-time', 'slow-motion', 'matrix', '360'], usage: 'Cenas de ação épicas, momentos de impacto, efeito cinematográfico icônico.', anim: 'orbit', video: '' },
    { id: 'glitch', name: 'Glitch', desc: 'Distorção digital simulando erro de transmissão com artefatos visuais.', tags: ['VFX', 'glitch', 'digital', 'distorção', 'cyberpunk'], usage: 'Estética futurista, transições de impacto, narrativas tecnológicas.', anim: 'glitch', video: '' },
    { id: 'explosion', name: 'Explosion', desc: 'Explosão cinematográfica com fogo, fumaça e debris ao redor do sujeito.', tags: ['VFX', 'explosão', 'fogo', 'ação', 'destruição'], usage: 'Cenas de ação, trailers, momentos de impacto dramático.', anim: 'shake', video: '' },
    { id: 'building-explosion', name: 'Building Explosion', desc: 'Estrutura explode ao fundo com escombros e ondas de choque cinematográficas.', tags: ['VFX', 'explosão', 'prédio', 'destruição', 'ação'], usage: 'Cenas de desastre, trailers de ação, storytelling épico.', anim: 'shake', video: '' },
    { id: 'plasma-explosion', name: 'Plasma Explosion', desc: 'Explosão de energia plasma com cores vibrantes e partículas luminosas.', tags: ['VFX', 'plasma', 'energia', 'explosão', 'sci-fi'], usage: 'Cenas sci-fi, poderes especiais, momentos de transformação.', anim: 'shake', video: '' },
    { id: 'disintegration', name: 'Disintegration', desc: 'Sujeito se desintegra em partículas que se dissipam no ar.', tags: ['VFX', 'desintegração', 'partículas', 'dissolução'], usage: 'Efeito Thanos, desaparecimentos dramáticos, transições mágicas.', anim: 'fade', video: '' },
    { id: 'clone-explosion', name: 'Clone Explosion', desc: 'Sujeito se multiplica em clones que explodem em todas as direções.', tags: ['VFX', 'clone', 'multiplicação', 'explosão'], usage: 'Efeitos cômicos, poder especial, momentos surreais.', anim: 'shake', video: '' },
    { id: 'fire', name: 'Flame On', desc: 'Sujeito é envolvido por chamas cinematográficas com iluminação dinâmica.', tags: ['VFX', 'fogo', 'chamas', 'elemental', 'quente'], usage: 'Transformações de poder, estética de fogo, cenas épicas.', anim: 'colorGrade', video: '' },
    { id: 'lava', name: 'Lava', desc: 'Efeito de lava incandescente fluindo ao redor ou sobre o sujeito.', tags: ['VFX', 'lava', 'incandescente', 'elemental', 'quente'], usage: 'Cenas vulcânicas, transformações de poder, estética destrutiva.', anim: 'colorGrade', video: '' },
    { id: 'air-bending', name: 'Air Bending', desc: 'Manipulação de ar visível com correntes e vórtices ao redor do sujeito.', tags: ['VFX', 'ar', 'elemental', 'vento', 'bending'], usage: 'Poderes elementais, cenas de fantasia, controle do vento.', anim: 'orbit', video: '' },
    { id: 'water-bending', name: 'Water Bending', desc: 'Manipulação de água com fluxos e formas líquidas controladas pelo sujeito.', tags: ['VFX', 'água', 'elemental', 'líquido', 'bending'], usage: 'Poderes elementais, cenas aquáticas, manipulação de fluidos.', anim: 'morph', video: '' },
    { id: 'earth-wave', name: 'Earth Wave', desc: 'Onda de terra e rochas se levantando do chão em direção ao sujeito.', tags: ['VFX', 'terra', 'elemental', 'rocha', 'onda'], usage: 'Poder terrestre, terremotos cinematográficos, cenas de fantasia.', anim: 'shake', video: '' },
    { id: 'thunder-god', name: 'Thunder God', desc: 'Raios e relâmpagos convergindo no sujeito com energia elétrica visível.', tags: ['VFX', 'raio', 'trovão', 'elétrico', 'poder'], usage: 'Poderes divinos, transformações épicas, cenas de poder supremo.', anim: 'glitch', video: '' },
    { id: 'portal', name: 'Portal', desc: 'Portal dimensional se abre com energia e distorção espacial ao redor.', tags: ['VFX', 'portal', 'dimensional', 'energia', 'magia'], usage: 'Viagens dimensionais, teleporte, cenas de ficção científica ou fantasia.', anim: 'iris', video: '' },
    { id: 'levitation', name: 'Levitation', desc: 'Sujeito levita no ar com efeitos de gravidade zero e partículas flutuantes.', tags: ['VFX', 'levitação', 'flutuar', 'gravidade', 'magia'], usage: 'Poderes especiais, meditação, cenas oníricas ou sobrenaturais.', anim: 'slowMo', video: '' },
    { id: 'freezing', name: 'Freezing', desc: 'Efeito de congelamento progressivo com gelo se formando sobre o sujeito.', tags: ['VFX', 'gelo', 'congelamento', 'frio', 'ice'], usage: 'Poderes de gelo, cenas de inverno extremo, transformações.', anim: 'blurFocus', video: '' },
    { id: 'shadow-smoke', name: 'Shadow Smoke', desc: 'Fumaça negra e sombras envolvem o sujeito de forma misteriosa.', tags: ['VFX', 'fumaça', 'sombra', 'escuro', 'misterioso'], usage: 'Vilões, atmosfera sombria, transformações dark, horror.', anim: 'fade', video: '' },
    { id: 'sakura-petals', name: 'Sakura Petals', desc: 'Pétalas de cerejeira caindo suavemente ao redor do sujeito.', tags: ['VFX', 'sakura', 'pétalas', 'anime', 'delicado'], usage: 'Estética anime, cenas românticas, momentos delicados e poéticos.', anim: 'slowMo', video: '' },
    { id: 'northern-lights', name: 'Northern Lights', desc: 'Aurora boreal aparece no céu com cores vibrantes e ondulantes.', tags: ['VFX', 'aurora', 'boreal', 'céu', 'cores'], usage: 'Cenários naturais épicos, cenas noturnas, atmosfera mágica.', anim: 'colorGrade', video: '' },
    { id: 'money-rain', name: 'Money Rain', desc: 'Chuva de dinheiro caindo ao redor do sujeito com iluminação dramática.', tags: ['VFX', 'dinheiro', 'chuva', 'luxo', 'ostentação'], usage: 'Vídeos musicais, conteúdo lifestyle, momentos de celebração.', anim: 'slowMo', video: '' },
    { id: 'x-ray', name: 'X-Ray', desc: 'Efeito de raio-X revelando estrutura interna do sujeito ou objetos.', tags: ['VFX', 'raio-x', 'transparente', 'interno', 'médico'], usage: 'Conteúdo educacional, sci-fi, revelações visuais criativas.', anim: 'blurFocus', video: '' },
    { id: 'wireframe', name: 'Wireframe', desc: 'Sujeito se transforma em malha wireframe 3D com linhas geométricas.', tags: ['VFX', 'wireframe', '3D', 'digital', 'geometria'], usage: 'Estética tech, apresentações de design, transições futuristas.', anim: 'glitch', video: '' },
    { id: 'point-cloud', name: 'Point Cloud', desc: 'Sujeito se dissolve em nuvem de pontos 3D estilo scan LIDAR.', tags: ['VFX', 'point-cloud', '3D', 'scan', 'digital'], usage: 'Estética tech/sci-fi, transições futuristas, visualização de dados.', anim: 'glitch', video: '' },
    { id: 'marble', name: 'Marble', desc: 'Sujeito se transforma em estátua de mármore com textura realista.', tags: ['VFX', 'mármore', 'estátua', 'pedra', 'transformação'], usage: 'Arte clássica, transformações de material, efeito escultural.', anim: 'freezeFrame', video: '' },
    { id: 'turning-metal', name: 'Turning Metal', desc: 'Sujeito se transforma progressivamente em metal cromado ou dourado.', tags: ['VFX', 'metal', 'cromado', 'transformação', 'material'], usage: 'Transformações de material, estética futurista, vídeos musicais.', anim: 'colorGrade', video: '' },
    { id: 'cyborg', name: 'Cyborg', desc: 'Metade do sujeito se transforma em ciborgue com peças mecânicas visíveis.', tags: ['VFX', 'cyborg', 'robô', 'mecânico', 'sci-fi'], usage: 'Sci-fi, transformações tecnológicas, estética cyberpunk.', anim: 'glitch', video: '' },
    { id: 'animalization', name: 'Animalization', desc: 'Sujeito se transforma gradualmente em um animal com morphing realista.', tags: ['VFX', 'animal', 'transformação', 'morphing', 'metamorfose'], usage: 'Transformações mágicas, storytelling fantástico, efeitos surreais.', anim: 'morph', video: '' },
    { id: 'werewolf', name: 'Werewolf', desc: 'Transformação progressiva em lobisomem com detalhes cinematográficos.', tags: ['VFX', 'lobisomem', 'transformação', 'horror', 'monstro'], usage: 'Cenas de horror, transformações sob lua cheia, storytelling dark.', anim: 'morph', video: '' },
    { id: 'multiverse', name: 'Multiverse', desc: 'Múltiplas versões do sujeito aparecem em dimensões paralelas.', tags: ['VFX', 'multiverso', 'paralelo', 'dimensão', 'duplicar'], usage: 'Storytelling sci-fi, variações de personagem, cenas conceituais.', anim: 'splitScreen', video: '' },
    { id: 'innerlight', name: 'Innerlight', desc: 'Luz interna brilha de dentro do sujeito, emanando energia luminosa.', tags: ['VFX', 'luz', 'interno', 'brilho', 'energia'], usage: 'Momentos de iluminação, despertar de poder, cenas espirituais.', anim: 'lensFlare', video: '' },
    { id: 'glow-trace', name: 'Glow Trace', desc: 'Rastros luminosos seguem o movimento do sujeito com trilhas de luz.', tags: ['VFX', 'glow', 'rastro', 'luz', 'trilha'], usage: 'Vídeos de dança, light painting, cenas de velocidade.', anim: 'lensFlare', video: '' },
    { id: 'acid-rain', name: 'Acid Rain', desc: 'Chuva ácida com gotas coloridas e distorções visuais no ambiente.', tags: ['VFX', 'chuva', 'ácido', 'distorção', 'ambiente'], usage: 'Cenários pós-apocalípticos, estética dark, vídeos musicais.', anim: 'colorGrade', video: '' },
    { id: 'aquarium', name: 'Aquarium', desc: 'Sujeito aparece submerso em aquário com bolhas, luz e reflexos de água.', tags: ['VFX', 'aquário', 'água', 'submerso', 'bolhas'], usage: 'Efeitos oníricos, cenas submarinas, estética surreal.', anim: 'slowMo', video: '' },
    { id: 'cotton-cloud', name: 'Cotton Cloud', desc: 'Nuvens macias e fofas envolvem o sujeito em atmosfera de sonho.', tags: ['VFX', 'nuvem', 'algodão', 'sonho', 'suave'], usage: 'Cenários oníricos, fantasia, atmosfera celestial.', anim: 'slowMo', video: '' },
    { id: 'gas-transformation', name: 'Gas Transformation', desc: 'Sujeito se dissolve em gás colorido que se espalha pelo ambiente.', tags: ['VFX', 'gás', 'dissolução', 'transformação', 'fumaça'], usage: 'Desaparecimentos, transformações de estado, efeitos mágicos.', anim: 'fade', video: '' },
    { id: 'low-shutter', name: 'Low Shutter', desc: 'Efeito de obturador lento criando motion blur cinematográfico intenso.', tags: ['VFX', 'shutter', 'motion-blur', 'rastro', 'movimento'], usage: 'Cenas de dança, movimento artístico, efeito de velocidade.', anim: 'whipPan', video: '' },
    { id: 'fisheye', name: 'Fisheye', desc: 'Distorção de lente olho de peixe com curvatura extrema nas bordas.', tags: ['VFX', 'fisheye', 'lente', 'distorção', 'curva'], usage: 'Skateboard videos, estética hip-hop, perspectivas criativas.', anim: 'dollyZoom', video: '' },
    { id: 'focus-change', name: 'Focus Change', desc: 'Mudança de foco entre planos diferentes, guiando a atenção do espectador.', tags: ['VFX', 'foco', 'rack-focus', 'profundidade', 'bokeh'], usage: 'Revelar elementos, mudar atenção, efeito cinematográfico clássico.', anim: 'blurFocus', video: '' },
    { id: 'hyperlapse', name: 'Hyperlapse', desc: 'Time-lapse em movimento com estabilização, comprimindo tempo e espaço.', tags: ['VFX', 'hyperlapse', 'tempo', 'movimento', 'timelapse'], usage: 'Tours por cidades, passagem do tempo, establishing shots dinâmicos.', anim: 'timeLapse', video: '' },
    { id: 'timelapse-landscape', name: 'Timelapse Landscape', desc: 'Paisagem em time-lapse mostrando mudança de luz, nuvens e atmosfera.', tags: ['VFX', 'timelapse', 'paisagem', 'céu', 'natureza'], usage: 'Establishing shots, documentários de natureza, passagem do tempo.', anim: 'timeLapse', video: '' },
    { id: 'timelapse-glam', name: 'Timelapse Glam', desc: 'Sequência acelerada de produção glamourosa: maquiagem, styling, transformação.', tags: ['VFX', 'timelapse', 'glam', 'transformação', 'moda'], usage: 'Conteúdo de beleza, transformações before/after, fashion.', anim: 'timeLapse', video: '' },
    { id: 'color-grading', name: 'Color Grading', desc: 'Alteração profissional de temperatura, contraste, grão e mood da imagem.', tags: ['VFX', 'cor', 'color-grade', 'mood', 'cinematográfico'], usage: 'Definir tom emocional: quente para nostalgia, frio para suspense.', anim: 'colorGrade', video: '' },
    { id: 'paparazzi', name: 'Paparazzi', desc: 'Múltiplas cameras surgem ao redor do sujeito disparando flashes em sequência como paparazzi.', tags: ['VFX', 'paparazzi', 'flash', 'camera', 'celebridade'], usage: 'Cenas de red carpet, intros de celebridade, conteúdo de moda.', anim: 'shake', video: 'assets/biblioteca/paparazzi.mp4', prompt: 'A stunning woman in a shimmering silver evening gown stands poised in the center of a classical art museum, surrounded by marble sculptures. Her presence is elegant and commanding, her expression calm and unshaken. Suddenly, numerous cameras begin to appear directly in front of her, all aimed at her from different angles. Flashbulbs erupt in rapid succession, capturing her every move as if she were a celebrity ambushed by relentless paparazzi.' },
    { id: 'live-concert', name: 'Live Concert', desc: 'Efeitos de palco com luzes, lasers e atmosfera de show ao vivo.', tags: ['VFX', 'concerto', 'palco', 'luzes', 'show'], usage: 'Vídeos musicais, conteúdo de performance, atmosfera de festival.', anim: 'colorGrade', video: '' },
    { id: 'i-can-fly', name: 'I Can Fly', desc: 'Sujeito levanta voo com efeitos de vento e perspectiva aérea dinâmica.', tags: ['VFX', 'voar', 'voo', 'super-herói', 'aéreo'], usage: 'Poderes de super-herói, sonhos de voo, cenas de liberdade.', anim: 'tiltUp', video: '' },
    { id: 'robo-arm', name: 'Robo Arm', desc: 'Movimento de camera estilo braço robótico com precisão mecânica.', tags: ['VFX', 'robô', 'braço', 'mecânico', 'preciso'], usage: 'Comerciais de produto, cenas tecnológicas, movimentos impossíveis.', anim: 'orbit', video: '' },
    { id: 'glam', name: 'Glam', desc: 'Revelação glamourosa com iluminação suave, brilho e composição fashion.', tags: ['VFX', 'glam', 'moda', 'brilho', 'elegante'], usage: 'Fashion videos, intros de influencer, conteúdo de beleza.', anim: 'lensFlare', video: '' },
    { id: 'wiggle', name: 'Wiggle', desc: 'Oscilação sutil da camera criando efeito de vibração controlada.', tags: ['VFX', 'wiggle', 'oscilação', 'vibração', 'sutil'], usage: 'Vídeos musicais com beat sync, transições sutis, efeito de energia.', anim: 'shake', video: '' },
    { id: 'bts', name: 'BTS (Behind The Scenes)', desc: 'Revelação dos bastidores da produção com cameras, luzes e equipe visíveis.', tags: ['VFX', 'bastidores', 'BTS', 'produção', 'making-of'], usage: 'Conteúdo making-of, autenticidade, conexão com audiência.', anim: 'panRight', video: '' }
  ],
  transicoes: [
    { id: 'flying-cam-transition', name: 'Flying Cam Transition', desc: 'Camera voa através da cena passando por obstáculos até revelar a próxima cena.', tags: ['transição', 'voar', 'camera', 'seamless', 'dinâmico'], usage: 'Transições imersivas entre ambientes, tours virtuais, storytelling contínuo.', anim: 'zoomTransition', video: '' },
    { id: 'raven-transition', name: 'Raven Transition', desc: 'Corvos negros invadem a tela cobrindo a cena e revelando a próxima.', tags: ['transição', 'raven', 'corvo', 'dark', 'dramático'], usage: 'Transições sombrias, mudanças de cena dramáticas, estética dark.', anim: 'fade', video: '' },
    { id: 'splash-transition', name: 'Splash Transition', desc: 'Splash de água ou líquido cobre a tela e revela a nova cena.', tags: ['transição', 'splash', 'água', 'líquido', 'orgânico'], usage: 'Conteúdo aquático, transições frescas e orgânicas, esportes.', anim: 'morph', video: '' },
    { id: 'flame-transition', name: 'Flame Transition', desc: 'Chamas envolvem a tela consumindo a cena anterior e revelando a próxima.', tags: ['transição', 'fogo', 'chamas', 'quente', 'intenso'], usage: 'Transições de alta energia, cenas de ação, mudanças dramáticas.', anim: 'colorGrade', video: '' },
    { id: 'melt-transition', name: 'Melt Transition', desc: 'Cena derrete como cera quente escorrendo e revelando nova imagem.', tags: ['transição', 'derreter', 'melt', 'fluido', 'surreal'], usage: 'Transições oníricas, mudanças surreais, efeito artístico.', anim: 'morph', video: '' },
    { id: 'hand-transition', name: 'Hand Transition', desc: 'Mão cobre a lente da camera e ao remover revela a nova cena.', tags: ['transição', 'mão', 'lente', 'cobertura', 'prático'], usage: 'Vlogs, transições práticas e orgânicas, estilo casual.', anim: 'fade', video: '' },
    { id: 'jump-transition', name: 'Jump Transition', desc: 'Corte sincronizado com um pulo que conecta duas cenas diferentes.', tags: ['transição', 'pulo', 'jump', 'corte', 'energético'], usage: 'Vídeos de dança, montagens energéticas, conteúdo fitness.', anim: 'zoomTransition', video: '' },
    { id: 'roll-transition', name: 'Roll Transition', desc: 'Tela rola como um cilindro girando para revelar a próxima cena.', tags: ['transição', 'rolar', 'girar', 'cilindro', 'dinâmico'], usage: 'Montagens criativas, transições dinâmicas entre locações.', anim: 'spin', video: '' },
    { id: 'display-transition', name: 'Display Transition', desc: 'Cena se transforma em tela de dispositivo (TV, celular, monitor).', tags: ['transição', 'display', 'tela', 'dispositivo', 'tech'], usage: 'Conteúdo tech, apresentações de app, storytelling multimídia.', anim: 'zoomTransition', video: '' },
    { id: 'seamless-transition', name: 'Seamless Transition', desc: 'Transição invisível que conecta duas cenas como se fossem contínuas.', tags: ['transição', 'seamless', 'invisível', 'contínuo', 'suave'], usage: 'Vídeos profissionais, narrativa fluida, ilusão de plano sequência.', anim: 'crossfade', video: '' },
    { id: 'hole-transition', name: 'Hole Transition', desc: 'Buraco se abre no centro da cena revelando a próxima por dentro.', tags: ['transição', 'buraco', 'abertura', 'revelar', 'centro'], usage: 'Revelações dramáticas, portal entre cenas, efeito de túnel.', anim: 'iris', video: '' },
    { id: 'stranger-transition', name: 'Stranger Transition', desc: 'Distorção misteriosa ao estilo Stranger Things com partículas flutuantes.', tags: ['transição', 'stranger', 'misterioso', 'distorção', 'sobrenatural'], usage: 'Conteúdo de horror, atmosfera sobrenatural, transições misteriosas.', anim: 'glitchTrans', video: '' },
    { id: 'column-wipe', name: 'Column Wipe', desc: 'Colunas verticais deslizam revelando a nova cena como persianas.', tags: ['transição', 'coluna', 'wipe', 'persiana', 'vertical'], usage: 'Transições gráficas, apresentações, motion graphics.', anim: 'wipeLeft', video: '' },
    { id: 'polygon-transition', name: 'Polygon Transition', desc: 'Formas poligonais se multiplicam cobrindo a tela e revelando a nova cena.', tags: ['transição', 'polígono', 'geométrico', 'forma', 'moderno'], usage: 'Estética moderna, motion graphics, conteúdo tech.', anim: 'maskShape', video: '' },
    { id: 'pizza-fall', name: 'Pizza Fall', desc: 'Fatias triangulares caem como pizza revelando a nova cena por trás.', tags: ['transição', 'pizza', 'fatia', 'queda', 'divertido'], usage: 'Conteúdo de comida, transições divertidas, humor.', anim: 'slidePush', video: '' },
    { id: 'censorship', name: 'Censorship', desc: 'Barras de censura pixelada cobrem a tela e depois revelam a nova cena.', tags: ['transição', 'censura', 'pixel', 'barra', 'cômico'], usage: 'Humor, conteúdo de entretenimento, revelações cômicas.', anim: 'pixelate', video: '' },
    { id: 'trucksition', name: 'Trucksition', desc: 'Veículo grande passa na frente da camera e ao sair revela cena completamente diferente.', tags: ['transição', 'truck', 'veículo', 'passagem', 'prático'], usage: 'Transições práticas de locação, vídeos de viagem, storytelling urbano.', anim: 'wipeLeft', video: '' },
    { id: 'mouth-transition', name: 'Mouth In Transition', desc: 'Camera entra pela boca do sujeito e emerge em um cenário completamente novo.', tags: ['transição', 'boca', 'entrada', 'zoom', 'surreal'], usage: 'Transições surreais, storytelling criativo, efeito de surpresa.', anim: 'zoomTransition', video: '' },
    { id: 'through-object-in', name: 'Through Object In', desc: 'Camera atravessa um objeto em primeiro plano emergindo em nova cena.', tags: ['transição', 'objeto', 'atravessar', 'zoom', 'seamless'], usage: 'Transições seamless entre ambientes, storytelling fluido.', anim: 'zoomTransition', video: '' },
    { id: 'through-object-out', name: 'Through Object Out', desc: 'Camera recua através de um objeto revelando cenário anterior ou novo.', tags: ['transição', 'objeto', 'recuar', 'revelar', 'seamless'], usage: 'Revelações criativas, transições de perspectiva.', anim: 'zoomTransition', video: '' },
    { id: 'glitch-transition', name: 'Glitch Transition', desc: 'Distorção digital glitch entre cenas com artefatos de erro visual.', tags: ['transição', 'glitch', 'digital', 'distorção', 'tech'], usage: 'Estética cyberpunk, vídeos tech, transições de impacto.', anim: 'glitchTrans', video: '' },
    { id: 'whip-pan-transition', name: 'Whip Pan Transition', desc: 'Pan ultra rápido com motion blur total conectando duas cenas distintas.', tags: ['transição', 'whip', 'pan', 'blur', 'rápido'], usage: 'Montagens rápidas, cenas de ação, mudanças de locação energéticas.', anim: 'whipPan', video: '' },
    { id: 'spin-transition', name: 'Spin Transition', desc: 'Tela inteira gira como turbina até revelar a nova cena.', tags: ['transição', 'spin', 'giro', 'rotação', 'energético'], usage: 'Transições divertidas, montagens, mudanças energéticas.', anim: 'spin', video: '' },
    { id: 'zoom-transition', name: 'Zoom Transition', desc: 'Zoom extremo para dentro conecta uma cena à próxima seamlessly.', tags: ['transição', 'zoom', 'seamless', 'contínuo', 'imersivo'], usage: 'Vídeos de viagem, vlogs criativos, transições modernas.', anim: 'zoomTransition', video: '' },
    { id: 'light-leak-transition', name: 'Light Leak Transition', desc: 'Vazamento de luz colorida invade o frame durante a troca de cenas.', tags: ['transição', 'luz', 'light-leak', 'colorido', 'vintage'], usage: 'Estilo vintage, transições quentes, efeito de filme analógico.', anim: 'lightLeak', video: '' },
    { id: 'ink-bleed-transition', name: 'Ink Bleed Transition', desc: 'Mancha de tinta se espalha organicamente cobrindo a cena e revelando a próxima.', tags: ['transição', 'tinta', 'ink', 'orgânico', 'artístico'], usage: 'Estilo artístico, revelações orgânicas, vídeos criativos.', anim: 'inkBleed', video: '' }
  ]
};

// Higgsfield CDN mapping — auto-populate video/thumb for each effect/transition
const HIGGSFIELD_CDN = {
  // === CAMERA CONTROLS ===
  'zoom-in': { v: 'https://static.higgsfield.ai/a3a3db5d-d3c5-4d95-b429-235ae3d1ee82.mp4', t: 'https://static.higgsfield.ai/a3a3db5d-d3c5-4d95-b429-235ae3d1ee82.webp', mid: 'a3a3db5d-d3c5-4d95-b429-235ae3d1ee82' },
  'zoom-out': { v: 'https://static.higgsfield.ai/f9e6792f-b385-4eca-87f6-f439e917a7aa.mp4', t: 'https://static.higgsfield.ai/f9e6792f-b385-4eca-87f6-f439e917a7aa.webp', mid: 'f9e6792f-b385-4eca-87f6-f439e917a7aa' },
  'crash-zoom-in': { v: 'https://static.higgsfield.ai/a2dddb76-03fa-429e-9905-577bffdf9d38.mp4', t: 'https://static.higgsfield.ai/a2dddb76-03fa-429e-9905-577bffdf9d38.webp', mid: 'a2dddb76-03fa-429e-9905-577bffdf9d38' },
  'crash-zoom-out': { v: 'https://static.higgsfield.ai/3972c090-a448-4fd4-b8f0-cb71b4b523ee.mp4', t: 'https://static.higgsfield.ai/3972c090-a448-4fd4-b8f0-cb71b4b523ee.webp', mid: '3972c090-a448-4fd4-b8f0-cb71b4b523ee' },
  'rapid-zoom-in': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/981bda8a-d681-4b08-83fa-64cccdc1e6ec.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/2d80d680-b488-45a7-b442-b4fe247d0809.webp', mid: '3dee792a-3fb1-40e5-8f46-3a1db42d64b1' },
  'rapid-zoom-out': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/bf33fd46-52bf-4326-8eff-2d6f314e68ae.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/e9a28fcc-e102-4dc9-8928-9166c51ebc86.webp', mid: '222b3cfc-5e24-44ee-b7f5-94deb2d2b514' },
  'yoyo-zoom': { v: 'https://static.higgsfield.ai/702c6210-9798-4888-b7c9-e794c8fcaaef.mp4', t: 'https://static.higgsfield.ai/702c6210-9798-4888-b7c9-e794c8fcaaef.webp', mid: '702c6210-9798-4888-b7c9-e794c8fcaaef' },
  'dolly-in': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/e42c01f2-ff4a-431b-82f1-87dba12b3082.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/234f0bcb-88e1-4d56-a1d4-609628fd34fd.webp', mid: '1438937c-a220-4859-93f4-f373da3f73fb' },
  'dolly-left': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/60200af8-2c6a-401b-bdb1-04e1951faf28.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/bbf57f31-e69b-495b-bf65-b3615f5a6187.webp', mid: '6d7fbb57-6008-4db4-a65c-56a10fc37969' },
  'dolly-right': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/58031d21-6ceb-4b00-a85b-25892a8a9a3e.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/6e05554a-65f2-4b59-b3f2-db892d8086fb.webp', mid: '1431d4b2-14d2-4576-876e-c8cec2f5f838' },
  'super-dolly-in': { v: 'https://static.higgsfield.ai/6a6fb1b9-28ea-44c8-9be4-e5d8c6ab1f3a.mp4', t: 'https://static.higgsfield.ai/6a6fb1b9-28ea-44c8-9be4-e5d8c6ab1f3a.webp', mid: '6a6fb1b9-28ea-44c8-9be4-e5d8c6ab1f3a' },
  'dolly-zoom-in': { v: 'https://static.higgsfield.ai/114245a3-93fb-434a-9299-44ca9e4656a3.mp4', t: 'https://static.higgsfield.ai/114245a3-93fb-434a-9299-44ca9e4656a3.webp', mid: '114245a3-93fb-434a-9299-44ca9e4656a3' },
  'pan-left': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/6bff4a6e-bec1-4d32-84bf-6b4f9cb4df0d.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/2e49188f-46d0-4aab-8f40-8c91b5bd3740.webp', mid: '6f087874-24f3-4d48-9eb9-f4349ac6a105' },
  'tilt-up': { v: 'https://static.higgsfield.ai/9f127dad-0db0-4e3d-a440-3cfbffca30b6.mp4', t: 'https://static.higgsfield.ai/9f127dad-0db0-4e3d-a440-3cfbffca30b6.webp', mid: '9f127dad-0db0-4e3d-a440-3cfbffca30b6' },
  'tilt-down': { v: 'https://static.higgsfield.ai/1958a932-8ffb-4f1a-a5cd-480858f6ae84.mp4', t: 'https://static.higgsfield.ai/1958a932-8ffb-4f1a-a5cd-480858f6ae84.webp', mid: '1958a932-8ffb-4f1a-a5cd-480858f6ae84' },
  'crane-up': { v: 'https://static.higgsfield.ai/2da63d27-94e0-48e0-8e2e-936274bd176e.mp4', t: 'https://static.higgsfield.ai/2da63d27-94e0-48e0-8e2e-936274bd176e.webp', mid: '45d7f47f-2c7b-4c5e-84b7-943758a39dcc' },
  'crane-down': { v: 'https://static.higgsfield.ai/494db3c2-2297-4cf7-bef7-cba0cebe73ee.mp4', t: 'https://static.higgsfield.ai/494db3c2-2297-4cf7-bef7-cba0cebe73ee.webp', mid: '494db3c2-2297-4cf7-bef7-cba0cebe73ee' },
  'jib-up': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/3f28e537-56b1-4f21-91e5-144f82d50dfb.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/2bf04bd9-f5d4-4f63-996b-d17c20c5c88e.webp', mid: '30a7fe68-0967-419a-b7cb-0d0bed480b09' },
  'arc-left': { v: 'https://static.higgsfield.ai/2a5d8f86-aef3-4b34-b5ee-fb2020daa131.mp4', t: 'https://static.higgsfield.ai/2a5d8f86-aef3-4b34-b5ee-fb2020daa131.webp', mid: '2a5d8f86-aef3-4b34-b5ee-fb2020daa131' },
  'arc-right': { v: 'https://static.higgsfield.ai/0bdbf318-f918-4f9b-829a-74cab681d806.mp4', t: 'https://static.higgsfield.ai/0bdbf318-f918-4f9b-829a-74cab681d806.webp', mid: '0bdbf318-f918-4f9b-829a-74cab681d806' },
  '3d-rotation': { v: 'https://static.higgsfield.ai/6f06f47e-922e-4660-9fe9-754e4be69696.mp4', t: 'https://static.higgsfield.ai/6f06f47e-922e-4660-9fe9-754e4be69696.webp', mid: '6f06f47e-922e-4660-9fe9-754e4be69696' },
  'lazy-susan': { v: 'https://static.higgsfield.ai/025866ff-677c-4af2-92ef-52d6ec3b035e.mp4', t: 'https://static.higgsfield.ai/025866ff-677c-4af2-92ef-52d6ec3b035e.webp', mid: '025866ff-677c-4af2-92ef-52d6ec3b035e' },
  'dutch-angle': { v: 'https://static.higgsfield.ai/b593944e-ae3e-47ce-8c6d-ea8dd87fe01f.mp4', t: 'https://static.higgsfield.ai/b593944e-ae3e-47ce-8c6d-ea8dd87fe01f.webp', mid: 'b593944e-ae3e-47ce-8c6d-ea8dd87fe01f' },
  'overhead': { v: 'https://static.higgsfield.ai/b6395b91-a356-4bc6-9cda-fc2793b3d706.mp4', t: 'https://static.higgsfield.ai/b6395b91-a356-4bc6-9cda-fc2793b3d706.webp', mid: 'b6395b91-a356-4bc6-9cda-fc2793b3d706' },
  'incline': { v: 'https://static.higgsfield.ai/b120f292-74e3-4878-817b-626e203f8a92.mp4', t: 'https://static.higgsfield.ai/b120f292-74e3-4878-817b-626e203f8a92.webp', mid: 'b120f292-74e3-4878-817b-626e203f8a92' },
  'aerial-pullback': { v: 'https://cdn.higgsfield.ai/kling_motion/a6fc0f13-7d44-4fd7-b6ca-1f27254bf62e.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/7e4590aa-f91c-4ff7-b7f7-f4387a78274d.webp', mid: 'a0bfa1b6-2dc7-4bbe-889f-fc04c27288ba' },
  'handheld': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/395e90c6-9d78-47c8-b453-607921a418ba.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/2eaf5227-7df8-4838-838f-fc3e1875fc8d.webp', mid: 'cf529456-6478-4622-a572-052f0d8ae378' },
  'snorricam': { v: 'https://static.higgsfield.ai/893cb65f-c528-40aa-83d8-c5aeb2bfe59f.mp4', t: 'https://static.higgsfield.ai/893cb65f-c528-40aa-83d8-c5aeb2bfe59f.webp', mid: '893cb65f-c528-40aa-83d8-c5aeb2bfe59f' },
  'hero-cam': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/11c6d46d-0a52-407a-8823-ba1e498c2638.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/c910e446-5ccd-4f6d-9af5-ce95d6fa3b50.webp', mid: 'a8c54413-c991-416a-8ac8-32c6a42caa6c' },
  'head-tracking': { v: 'https://static.higgsfield.ai/fe520e06-7971-4f28-9e10-e45911c57bb6.mp4', t: 'https://static.higgsfield.ai/fe520e06-7971-4f28-9e10-e45911c57bb6.webp', mid: 'fe520e06-7971-4f28-9e10-e45911c57bb6' },
  'eyes-in': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/c5736a3e-0a77-45d7-8619-0b2868cb5231.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/50f3b4bf-cd66-44bd-b88b-522696f55d32.webp', mid: '3afdf962-2709-44a9-a41c-6565e6998529' },
  'buckle-up': { v: 'https://static.higgsfield.ai/4ef72175-227a-418b-923d-2831dcdf7d4f.mp4', t: 'https://static.higgsfield.ai/4ef72175-227a-418b-923d-2831dcdf7d4f.webp', mid: '4ef72175-227a-418b-923d-2831dcdf7d4f' },
  'car-chasing': { v: 'https://static.higgsfield.ai/a76f2e99-0a41-4fdf-934d-9c95b0ee85bf.mp4', t: 'https://static.higgsfield.ai/a76f2e99-0a41-4fdf-934d-9c95b0ee85bf.webp', mid: 'a76f2e99-0a41-4fdf-934d-9c95b0ee85bf' },
  'car-grip': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/7b0dc7d1-588a-47da-a7f9-5419c27e4070.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/63ccc7eb-ca16-4e5c-a48a-c229cc8c28b3.webp', mid: '7c174c3f-7d11-451c-b7da-03be50f7d010' },
  'static': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/d4f333fc-2302-4d95-b4a5-854673b2f37e.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/fb658a00-5327-48ed-85b8-7e7708391429.webp', mid: 'c43e6d97-a55a-45d7-b5bc-b3a55d3a6e8e' },
  // === VISUAL EFFECTS ===
  'bullet-time': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/5a595e55-8770-4885-9239-ad9524ace5be.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/d1369770-4f9b-4862-8b78-73f143d54aa4.webp', mid: 'bb341c21-9548-4efb-8a91-b6202167b344' },
  'building-explosion': { v: 'https://static.higgsfield.ai/e974bca9-c9eb-4cc8-9318-5676cc110f17.mp4', t: 'https://static.higgsfield.ai/e974bca9-c9eb-4cc8-9318-5676cc110f17.webp', mid: 'e974bca9-c9eb-4cc8-9318-5676cc110f17' },
  'disintegration': { v: 'https://static.higgsfield.ai/4e981984-1cdc-4b96-a2b1-1a7c1ecb822d.mp4', t: 'https://static.higgsfield.ai/4e981984-1cdc-4b96-a2b1-1a7c1ecb822d.webp', mid: '4e981984-1cdc-4b96-a2b1-1a7c1ecb822d' },
  'clone-explosion': { v: 'https://static.higgsfield.ai/9680aaf0-c5db-4204-833f-56f825bb350b.mp4', t: 'https://static.higgsfield.ai/9680aaf0-c5db-4204-833f-56f825bb350b.webp', mid: '9680aaf0-c5db-4204-833f-56f825bb350b' },
  'air-bending': { v: 'https://cdn.higgsfield.ai/kling_motion/79c7d439-b3e7-4f08-a8aa-300915611ecf.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/111df116-ce67-43b0-9b4a-309d3a20b9f2.webp', mid: 'c4dd8cc3-79a6-4366-b9a1-071ad848ddd2' },
  'water-bending': { v: 'https://cdn.higgsfield.ai/kling_motion/4fe58127-2cc9-4023-b32a-087d47c2ed13.mp4', t: '', mid: 'b3c9d6c2-e1c9-4d92-8853-9d2d46e4b294' },
  'earth-wave': { v: 'https://cdn.higgsfield.ai/kling_motion/53a52716-1f82-4c0f-9a72-91b31361024a.mp4', t: '', mid: 'fb52e9a0-c6e2-498e-8adb-6611b80808e3' },
  'thunder-god': { v: 'https://static.higgsfield.ai/ca0568ee-6a0f-4134-a4ee-97dfe44753ba.mp4', t: 'https://static.higgsfield.ai/ca0568ee-6a0f-4134-a4ee-97dfe44753ba.webp', mid: 'ca0568ee-6a0f-4134-a4ee-97dfe44753ba' },
  'levitation': { v: 'https://static.higgsfield.ai/52aa7be6-854f-45cb-930c-b98d64eb593c.mp4', t: 'https://static.higgsfield.ai/52aa7be6-854f-45cb-930c-b98d64eb593c.webp', mid: '52aa7be6-854f-45cb-930c-b98d64eb593c' },
  'freezing': { v: 'https://static.higgsfield.ai/777f1604-afee-406d-a711-bf1e0ea23c86.mp4', t: 'https://static.higgsfield.ai/777f1604-afee-406d-a711-bf1e0ea23c86.webp', mid: '777f1604-afee-406d-a711-bf1e0ea23c86' },
  'shadow-smoke': { v: 'https://cdn.higgsfield.ai/kling_motion/f5c1aa03-f1b0-4e42-98a7-7e7aec97c63a.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/d610e8c9-8e35-4018-821c-893f408a5cec.webp', mid: '881b5e78-e585-43fb-ac73-a4207d824c88' },
  'sakura-petals': { v: 'https://cdn.higgsfield.ai/kling_motion/72717787-29b1-47b9-b421-6a36449092cd.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/eed3e692-ab0c-410e-a124-4111104626cd.webp', mid: 'cbc75d4d-2e42-4688-a384-0d6e03e375da' },
  'money-rain': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/1309dc80-57d4-4e4f-926f-41664122d8af.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/9448c9a5-c9ba-44aa-988d-2a574b22cb37.webp', mid: '40a465df-3484-4130-bfd2-54f5cdcaf3bf' },
  'x-ray': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/7b2ec3c6-81e4-443f-8aa3-e973c70de79c.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/12c3d661-1a2c-4ed6-8459-4f818172915c.webp', mid: '5819f36e-5b0a-44ca-800e-98e380266b2d' },
  'wireframe': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/224c2393-11f7-4cac-9e97-1c740129b17d.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/5d6bd428-02ec-4e49-b511-35d0c0365d70.webp', mid: 'ea67acab-a7bf-4fff-b098-a0f1f1a6796c' },
  'turning-metal': { v: 'https://static.higgsfield.ai/46e23a6b-1047-40f1-9cf5-33f5f55ddf2e.mp4', t: 'https://static.higgsfield.ai/46e23a6b-1047-40f1-9cf5-33f5f55ddf2e.webp', mid: '46e23a6b-1047-40f1-9cf5-33f5f55ddf2e' },
  'werewolf': { v: 'https://cdn.higgsfield.ai/kling_motion/e3913abc-2f92-48f2-aa36-66a1c5941184.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/9106e8a2-4b20-4e98-99fc-6db13f00e8b7.webp', mid: '5f3f83b8-6a17-47ba-bcfd-f7f41d9997e3' },
  'innerlight': { v: 'https://static.higgsfield.ai/30d58d76-3149-4dee-9ffa-920a7ca6eb9e.mp4', t: 'https://static.higgsfield.ai/30d58d76-3149-4dee-9ffa-920a7ca6eb9e.webp', mid: '30d58d76-3149-4dee-9ffa-920a7ca6eb9e' },
  'glow-trace': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/2a01bed8-1871-4c39-aad5-1db86631ac1d.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/70c0f591-e13c-46a8-9efc-af1ac8a42a84.webp', mid: '519e724e-760f-4703-b6cd-d38223f27e53' },
  'aquarium': { v: 'https://cdn.higgsfield.ai/kling_motion/76b74185-d6d5-4d05-9355-796659fa394e.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/88ca249a-8e95-4e4e-9a6e-ced88799dcf8.webp', mid: 'a5aad83f-c66b-44eb-a781-85132636253f' },
  'gas-transformation': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/fa4ef01b-444c-4706-b3fd-e92bc8e915c7.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/ea86bc73-2c05-471e-a300-80519b6807c1.webp', mid: '1422c31c-7648-4b23-94ca-de200ad1bbc6' },
  'low-shutter': { v: 'https://static.higgsfield.ai/f7949a2f-2bcd-459a-96c0-80eb222abcdc.mp4', t: 'https://static.higgsfield.ai/f7949a2f-2bcd-459a-96c0-80eb222abcdc.webp', mid: 'f7949a2f-2bcd-459a-96c0-80eb222abcdc' },
  'fisheye': { v: 'https://static.higgsfield.ai/6c689fc3-e421-4ed5-892c-2092d1c60be0.mp4', t: 'https://static.higgsfield.ai/6c689fc3-e421-4ed5-892c-2092d1c60be0.webp', mid: '6c689fc3-e421-4ed5-892c-2092d1c60be0' },
  'focus-change': { v: 'https://static.higgsfield.ai/390e084a-4a80-410b-a808-77411828c61d.mp4', t: 'https://static.higgsfield.ai/390e084a-4a80-410b-a808-77411828c61d.webp', mid: '390e084a-4a80-410b-a808-77411828c61d' },
  'hyperlapse': { v: 'https://static.higgsfield.ai/f0f07997-34fe-4bef-84c1-ee9d4da94a1a.mp4', t: 'https://static.higgsfield.ai/f0f07997-34fe-4bef-84c1-ee9d4da94a1a.webp', mid: 'f0f07997-34fe-4bef-84c1-ee9d4da94a1a' },
  'timelapse-landscape': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/a31a54ff-1028-4cb7-bddb-ac31d3c20290.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/70ae2e45-c34d-4a2a-ad31-8471bb966707.webp', mid: 'd45f0a80-62b8-4651-bd62-0373a09b8f11' },
  'timelapse-glam': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/1e2a226b-4d82-4dd1-868a-57d21710fd1c.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/b8d622f6-573e-43cc-bf23-988420fbd08a.webp', mid: '4b2db33e-b163-484b-b33a-7b0a04d81ddf' },
  'lava': { v: 'https://cdn.higgsfield.ai/kling_motion/ce9bd1d9-5a77-48a6-8c25-92ffca2c8e46.mp4', t: '', mid: 'eeaa42bc-d607-464e-b21f-b7fb8b1cb3fc' },
  'live-concert': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/393fedcf-0375-4f9c-b27e-3b5e6f19c28a.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/19ecfa7f-f24e-4805-a988-5ef481f13ceb.webp', mid: 'bf8444a7-c778-451f-b633-74f62aa23e98' },
  'glam': { v: 'https://static.higgsfield.ai/ae4a319d-a06f-4b30-8b67-55a35a22f24a.mp4', t: 'https://static.higgsfield.ai/ae4a319d-a06f-4b30-8b67-55a35a22f24a.webp', mid: 'ae4a319d-a06f-4b30-8b67-55a35a22f24a' },
  'wiggle': { v: 'https://static.higgsfield.ai/cfbe9732-1b5a-4f59-9dbc-801f85f5c702.mp4', t: 'https://static.higgsfield.ai/cfbe9732-1b5a-4f59-9dbc-801f85f5c702.webp', mid: 'cfbe9732-1b5a-4f59-9dbc-801f85f5c702' },
  'ahegao': { v: 'https://cdn.higgsfield.ai/wan2_2_motion/22b6f9ca-5469-4086-8956-a2deb4944307.mp4', t: 'https://cdn.higgsfield.ai/wan2_2_motion/792e4782-a153-4cd6-a4dc-9470fa92a39a.webp', mid: '3322a2db-a59b-4e77-85fd-562d417b79d6' },
  'black-tears': { v: 'https://static.higgsfield.ai/6b49273d-2164-4af4-8e38-971ad7ab6516.mp4', t: 'https://static.higgsfield.ai/6b49273d-2164-4af4-8e38-971ad7ab6516.webp', mid: '6b49273d-2164-4af4-8e38-971ad7ab6516' },
  'garden-bloom': { v: 'https://static.higgsfield.ai/b25600ef-238e-448a-bb07-1ff74fd0207f.mp4', t: 'https://static.higgsfield.ai/b25600ef-238e-448a-bb07-1ff74fd0207f.webp', mid: 'b25600ef-238e-448a-bb07-1ff74fd0207f' },
  'head-explosion': { v: 'https://static.higgsfield.ai/dbf3fbc1-f69c-4904-a063-104cf2998a40.mp4', t: 'https://static.higgsfield.ai/dbf3fbc1-f69c-4904-a063-104cf2998a40.webp', mid: 'dbf3fbc1-f69c-4904-a063-104cf2998a40' },
  'head-off': { v: 'https://static.higgsfield.ai/645b3b79-f6f5-4e9b-83d7-f9dd526ac624.mp4', t: 'https://static.higgsfield.ai/645b3b79-f6f5-4e9b-83d7-f9dd526ac624.webp', mid: '645b3b79-f6f5-4e9b-83d7-f9dd526ac624' },
  'hero-flight': { v: 'https://cdn.higgsfield.ai/seedance_motion/0b8935a7-1dd9-460b-a03b-b5e358c4ad28.mp4', t: 'https://cdn.higgsfield.ai/seedance_motion/ae4f5a84-76f8-4694-8287-96221bb9464c.webp', mid: '1df8be61-ddf7-4563-b12f-887d4c641698' },
  'horror-face': { v: 'https://cdn.higgsfield.ai/kling_motion/368662ef-3ef3-4659-ab73-14ebf5c25205.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/e60ebf40-7bff-421f-95cb-38a355392f08.webp', mid: '41ed27a0-8d93-482a-b743-17bb68af9e94' },
  'glowing-fish': { v: 'https://static.higgsfield.ai/cc0d5c9a-4047-459f-acce-75811f0ba729.mp4', t: 'https://static.higgsfield.ai/cc0d5c9a-4047-459f-acce-75811f0ba729.webp', mid: 'cc0d5c9a-4047-459f-acce-75811f0ba729' },
  'gorilla-transfer': { v: 'https://cdn.higgsfield.ai/kling_motion/9f5929b9-5246-4856-9862-daa9b6b0fe53.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/06deaef7-b5f6-4c14-b30f-5658b264b863.webp', mid: '2f000456-93b5-482d-acb4-831f43095efa' },
  'illustration-scene': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/6cf528be-5f99-4651-8358-68d8c61c8c5a.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/03e44541-8610-4dbe-b997-60aa5ce685f6.webp', mid: '3891c001-6191-4c33-bcd2-e518736ea923' },
  'tattoo-animation': { v: 'https://cdn.higgsfield.ai/kling_motion/7c438afb-bc2a-443f-8140-a6173f62b486.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/3b4642fa-322a-43b4-91f2-87f79f4539ee.webp', mid: 'd5ff2bb8-d82d-4ade-b807-e075af15aae6' },
  'saint-glow': { v: 'https://cdn.higgsfield.ai/kling_motion/31843bef-0821-47e1-8f3e-c499e9cd00d4.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/ae410d7d-5c3d-4053-96fe-1d7595bf5bd3.webp', mid: '5772cc26-730f-4fb2-945b-fa4c5313feca' },
  'fast-sprint': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/e05ebca0-041f-45e2-9189-0a969b4cac2a.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/52096e6b-4cbf-4644-a1e9-f4f65174f09c.webp', mid: '5023b9bb-d528-48cd-add8-622e2999d7c6' },
  'spiders-from-mouth': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/3d9906ac-44b5-47d3-b3c0-7fdccfe14f4a.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/1b2b1dde-a2db-469b-849e-055f6dd06e04.webp', mid: 'c5576bd6-2662-4b03-a20e-82dfc5e07da2' },
  'buddy': { v: 'https://cdn.higgsfield.ai/seedance_motion/6d539e15-3de0-4992-b56e-7c688e4e70de.mp4', t: 'https://cdn.higgsfield.ai/seedance_motion/1ecc8b56-d13a-4b22-803e-fa21eb64c592.webp', mid: '12efd233-c7fa-445f-8eb9-f271c902cdbc' },
  'collage': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/5a8f0f01-a4c5-4fdb-a141-7b6ab6ca6779.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/449f6d8f-399c-4bab-92df-5bf90c6de4de.webp', mid: '0d9830d2-4510-4472-9c70-98e1e314a86d' },
  'diamond': { v: 'https://static.higgsfield.ai/8126eea1-263d-4e2a-9e27-da7296638522.mp4', t: 'https://static.higgsfield.ai/8126eea1-263d-4e2a-9e27-da7296638522.webp', mid: '8126eea1-263d-4e2a-9e27-da7296638522' },
  'duplicate': { v: 'https://static.higgsfield.ai/20b46995-5991-48e0-8fcc-6b1f5dfb4c52.mp4', t: 'https://static.higgsfield.ai/20b46995-5991-48e0-8fcc-6b1f5dfb4c52.webp', mid: '20b46995-5991-48e0-8fcc-6b1f5dfb4c52' },
  'set-on-fire': { v: 'https://static.higgsfield.ai/06b50d3a-65a9-432b-bf0b-493fc3dcc006.mp4', t: 'https://static.higgsfield.ai/06b50d3a-65a9-432b-bf0b-493fc3dcc006.webp', mid: '06b50d3a-65a9-432b-bf0b-493fc3dcc006' },
  'fire': { v: 'https://static.higgsfield.ai/06b50d3a-65a9-432b-bf0b-493fc3dcc006.mp4', t: 'https://static.higgsfield.ai/06b50d3a-65a9-432b-bf0b-493fc3dcc006.webp', mid: '06b50d3a-65a9-432b-bf0b-493fc3dcc006' },
  'timelapse-human': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/8e67500f-9453-4fb0-ac9a-b974049b46cd.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/95c3d330-f9d7-4f27-9e11-95b762ff23f6.webp', mid: 'b4ba822f-9171-4547-997e-c86de335385e' },
  // === TRANSITIONS ===
  'flying-cam-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/ecb6fc91-c4df-4133-95da-5e53108a7c6f.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/0fb7068a-f7f0-470b-8b81-3ee5f99da7c9.webp', mid: 'e43378b9-b20b-4158-a626-745bbbcacdbd' },
  'raven-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/8c4795a8-e7ef-4272-8fb3-9d349192a013.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/94b61df4-fff8-4c97-8115-59d8f2fcd93d.webp', mid: 'bbab2a35-ccba-45df-8c37-8ea2bd9e395a' },
  'splash-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/413e9bed-2fb7-4f61-b69f-e8c7466bfcf6.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/c55aaeff-aff4-4555-829e-3ffdc193df7f.webp', mid: '105c744b-05bf-44ae-ba34-5a7144f4ec46' },
  'melt-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/a124bdd1-6c85-4a54-9d38-4c6a25e9eaba.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/a5478993-7f69-40ac-9e53-ee8643088007.webp', mid: 'f064aa72-eb21-4691-a827-5f0fa9f4246c' },
  'roll-transition': { v: 'https://static.higgsfield.ai/a8e2bc3a-e78e-42aa-a0e6-79bc01141ed3.mp4', t: 'https://static.higgsfield.ai/a8e2bc3a-e78e-42aa-a0e6-79bc01141ed3.webp', mid: 'a8e2bc3a-e78e-42aa-a0e6-79bc01141ed3' },
  'seamless-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/bc0678f9-dc5d-470c-8145-ff29303e2979.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/9fb08bc1-82da-4b2f-a165-6b88c3787804.webp', mid: '77ff4447-ab4c-4816-bb79-bff2f4a4f34f' },
  'polygon-transition': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/b96f226b-469c-45e0-85fe-328d7e9789a4.mp4', t: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/fd904f40-a0d5-4164-87cc-9f124c2af2bd.webp', mid: 'fad73347-8c2d-4d96-a70a-155447406281' },
  'trucksition': { v: 'https://cdn.higgsfield.ai/kling_motion/bb84ce87-ed51-4512-94cb-8852983a61dc.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/a8eda643-6ef5-4bb6-b83a-2f5e0ea5a1c2.webp', mid: '81c90748-7852-4bb1-a0ec-1649beb72024' },
  'mouth-transition': { v: 'https://static.higgsfield.ai/7351a8ad-9754-4844-94f1-00baf293d588.mp4', t: 'https://static.higgsfield.ai/7351a8ad-9754-4844-94f1-00baf293d588.webp', mid: '7351a8ad-9754-4844-94f1-00baf293d588' },
  'through-object-in': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/c4fbfcfd-08c6-46bd-b449-7977fb1fc5ea.mp4', t: 'https://cdn.higgsfield.ai/wan2_5_motion/1f631b4e-97d8-4dfe-a0c2-21c6884e1f7e.webp', mid: '7fd00618-aa73-4fae-adb7-98ed16773eaa' },
  // === BATCH 2 — Previously missing items ===
  // Camera controls
  'dolly-out': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/ce75e22b-1680-4cd4-a3de-a1696672b6c1.webp', mid: 'c1a8c847-4ea8-4d31-9cec-ef62897a2d17' },
  'super-dolly-out': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/ee9451aa-da82-4c44-9cb4-f903c88ab800.webp', mid: 'd66685ce-8c2b-4aeb-8d4a-195d474c7eca' },
  'double-dolly': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/886cac42-6af9-4a71-a9db-e40705acbef7.webp', mid: 'e522bff4-da3b-4f7d-8c6e-f925b60979c5' },
  'dolly-zoom-out': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/cedab22a-fa43-4060-9c2b-822685d50d59.webp', mid: 'e057dbd5-1734-4462-bb4c-7d64fe20795e' },
  'pan-right': { v: 'https://cdn.higgsfield.ai/wan2_5_motion/6357b686-6793-41a9-86b1-0df38b6a6cee.mp4', t: '', mid: 'ce0b3d96-be4c-4b2d-962a-340dd386d910' },
  'jib-down': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/ee646153-2f1f-431d-9e02-55bad908e640.webp', mid: '2057206c-09ef-40b2-9cc9-049e41a0b8bb' },
  'crane-over-head': { v: '', t: '', mid: 'cc664502-7fdc-412e-8fd7-6af310c8891b' },
  'whip-pan': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/7c1aa41a-939c-483e-b4fb-eeab96a3fc0e.webp', mid: '7a144766-cdd2-4b73-8a27-67b35f2d4ba2' },
  // Visual effects
  'glitch': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/d8320e8a-da48-4fcb-a613-cb200f949589.mp4', t: '', mid: 'abcf4cae-51d6-413c-95bf-a586cd48391b' },
  'explosion': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/66410c35-7a12-4dd4-8ecd-f50402ceb781.mp4', t: '', mid: 'bc2725cf-4195-4139-881f-f01a71940bea' },
  'plasma-explosion': { v: 'https://cdn.higgsfield.ai/kling_motion/244cbbd1-2ecb-423a-aaec-1c00ed560814.mp4', t: '', mid: 'fda25365-9d4e-4f0f-9bd4-ed2cc5ae6981' },
  'portal': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/4594acd6-0e50-4d41-830d-3c61c6f5e29b.mp4', t: '', mid: '2391dbfb-edc3-4982-b5b0-bf3746a25359' },
  'point-cloud': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/d4d8779c-f3e5-4014-995f-1867ad139201.mp4', t: '', mid: '569ea796-2a19-4ccc-9281-29179e96ebf3' },
  'cyborg': { v: 'https://cdn.higgsfield.ai/kling_motion/840a3d93-564b-43ea-bf5d-46f0a61f12df.mp4', t: '', mid: '1f96bfce-ebca-4eb5-a521-0ccd4f1d73d9' },
  'multiverse': { v: 'https://cdn.higgsfield.ai/kling_motion/25c233ae-26a6-4037-8eb8-e0a65fa8ea11.mp4', t: '', mid: '5949fec9-f70e-45d5-8ab9-5544bb18dd72' },
  'cotton-cloud': { v: 'https://cdn.higgsfield.ai/kling_motion/b297103b-26e2-4c94-8134-0e8f74dddbe8.mp4', t: '', mid: '588486b6-f303-4e2a-b8b0-2b74b01a5f50' },
  'i-can-fly': { v: 'https://cdn.higgsfield.ai/kling_motion/dd160cc5-cc59-48bd-b67e-9c9d7b7b19ba.mp4', t: '', mid: '929856d2-448b-40ad-8781-297e02af0ae7' },
  // Transitions
  'flame-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/8dd17be3-1ba7-4ce0-bede-be5a0159fcfc.mp4', t: '', mid: '6641ebf5-1e07-4a8a-a435-b0ea374861e8' },
  'hand-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/5ce96e11-d02c-4096-843a-972487971c3c.mp4', t: '', mid: '7e9ac07e-703b-4b48-a466-d561d3d9c536' },
  'jump-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/24f2abc3-ccf9-4a73-9e0a-ebf9d37975d7.mp4', t: '', mid: '38f4643a-581b-40d8-bcd6-983aecf12430' },
  'display-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/bf105e54-a39b-42dd-9034-303a8fae6b82.mp4', t: '', mid: 'cf852c5b-8e2a-45b7-807e-2a35b2636a3f' },
  'hole-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/22875b3c-6301-44ea-b1e0-47ad6a4db5b8.mp4', t: '', mid: 'b03d3554-d088-49a4-8050-bda4bd2e456e' },
  'stranger-transition': { v: 'https://cdn.higgsfield.ai/kling_motion/45aada3d-d7a7-4722-923a-0e1f8cbe8bf3.mp4', t: 'https://cdn.higgsfield.ai/kling_motion/89d05584-6e62-462b-a82a-61ea3169d3cb.webp', mid: '2d1f292c-d0d8-4481-8eb9-fb113f64f193' },
  'column-wipe': { v: 'https://cdn.higgsfield.ai/kling_motion/df839982-50b1-4808-bc47-14b747899f1b.mp4', t: '', mid: '0b316480-075a-4999-bfde-c9710c0c6804' },
  'pizza-fall': { v: 'https://cdn.higgsfield.ai/kling_motion/bdc0986b-31e2-4f48-ba8a-349320acfc92.mp4', t: '', mid: '3c3a1331-3524-47da-b956-688595c295b7' },
  'censorship': { v: 'https://cdn.higgsfield.ai/minimax_hailuo_motion/b5ce84b1-abf5-47de-a8e2-e7c94d321e84.mp4', t: '', mid: 'd3c3692f-1aec-4274-9aaf-5f461ad71b6a' },
  'through-object-out': { v: '', t: 'https://d1xarpci4ikg0w.cloudfront.net/84dea938-1f04-4783-9716-69c41f85cb83.webp', mid: '3e217f3c-5133-4e83-ab6c-afb35d1c5852' },
};

// Apply Higgsfield CDN data to BIBLIOTECA_DATA
['efeitos', 'transicoes'].forEach(section => {
  BIBLIOTECA_DATA[section].forEach(item => {
    const cdn = HIGGSFIELD_CDN[item.id];
    if (cdn) {
      if (cdn.v && (!item.video || item.video.trim() === '')) item.video = cdn.v;
      if (cdn.t) item.thumb = cdn.t;
      if (cdn.mid) item.higgsfield = 'https://higgsfield.ai/motion/' + cdn.mid;
    }
  });
});

let bibliotecaRendered = false;
let bibliotecaCurrentSection = 'efeitos';

function renderBiblioteca() {
  if (bibliotecaRendered) return;
  bibliotecaRendered = true;

  renderBibliotecaGrid('efeitos');
  renderBibliotecaGrid('transicoes');
  setupBibliotecaEvents();
}

function renderBibliotecaGrid(section) {
  const gridId = section === 'efeitos' ? 'bibliotecaEfeitosGrid' : 'bibliotecaTransicoesGrid';
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';

  const items = BIBLIOTECA_DATA[section];
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'biblioteca-card';
    card.dataset.id = item.id;
    card.dataset.section = section;
    const hasThumb = item.thumb && item.thumb.trim() !== '';
    const hasVideo = item.video && item.video.trim() !== '';
    card.innerHTML = `
      <div class="biblioteca-card-thumb">
        ${hasThumb
          ? `<img class="biblioteca-card-img" src="${item.thumb}" alt="${escapeHtml(item.name)}" loading="lazy">`
          : hasVideo
            ? `<video class="biblioteca-card-video" src="${item.video}#t=0.5" muted loop playsinline preload="metadata"></video>`
            : `<div class="bib-anim-preview" data-anim="${item.anim}">
                <div class="bib-anim-obj"></div>
              </div>`
        }
      </div>
      <div class="biblioteca-card-name">${escapeHtml(item.name.toUpperCase())}</div>
    `;
    card.addEventListener('click', () => openBibliotecaModal(item, section));
    grid.appendChild(card);

    // Hover: swap thumbnail to video for smooth preview
    if (hasThumb && hasVideo) {
      let vid = null;
      card.addEventListener('mouseenter', () => {
        if (!vid) {
          vid = document.createElement('video');
          vid.className = 'biblioteca-card-video';
          vid.src = item.video;
          vid.muted = true;
          vid.loop = true;
          vid.playsInline = true;
          vid.preload = 'auto';
          const thumbEl = card.querySelector('.biblioteca-card-thumb');
          thumbEl.appendChild(vid);
        }
        const img = card.querySelector('.biblioteca-card-img');
        if (img) img.style.opacity = '0';
        vid.style.opacity = '1';
        try { vid.currentTime = 0; vid.play(); } catch(e){}
      });
      card.addEventListener('mouseleave', () => {
        const img = card.querySelector('.biblioteca-card-img');
        if (img) img.style.opacity = '1';
        if (vid) { vid.style.opacity = '0'; try { vid.pause(); } catch(e){} }
      });
    } else if (hasVideo) {
      const vid = card.querySelector('.biblioteca-card-video');
      card.addEventListener('mouseenter', () => { try { vid.currentTime = 0; vid.play(); } catch(e){} });
      card.addEventListener('mouseleave', () => { try { vid.pause(); vid.currentTime = 0; } catch(e){} });
    } else {
      const preview = card.querySelector('.bib-anim-preview');
      card.addEventListener('mouseenter', () => preview.classList.add('playing'));
      card.addEventListener('mouseleave', () => preview.classList.remove('playing'));
    }
  });
}

function setupBibliotecaEvents() {
  // Section tabs
  document.querySelectorAll('.biblioteca-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.biblioteca-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const section = tab.dataset.section;
      bibliotecaCurrentSection = section;
      document.querySelectorAll('.biblioteca-section').forEach(s => s.classList.remove('active'));
      document.getElementById(section === 'efeitos' ? 'bibliotecaEfeitos' : 'bibliotecaTransicoes').classList.add('active');
      document.getElementById('bibliotecaEmpty').style.display = 'none';
    });
  });

  // Search
  const searchInput = document.getElementById('bibliotecaSearchInput');
  const searchBtn = document.getElementById('bibliotecaSearchBtn');
  const clearBtn = document.getElementById('bibliotecaClearBtn');

  searchBtn.addEventListener('click', () => bibliotecaSearch());
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') bibliotecaSearch();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    // Show all cards
    document.querySelectorAll('.biblioteca-card').forEach(c => {
      c.style.display = '';
      c.classList.remove('highlight');
    });
    document.querySelectorAll('.biblioteca-section').forEach(s => {
      if (s.id === (bibliotecaCurrentSection === 'efeitos' ? 'bibliotecaEfeitos' : 'bibliotecaTransicoes')) {
        s.classList.add('active');
      }
    });
    document.getElementById('bibliotecaEmpty').style.display = 'none';
  });
}

async function bibliotecaSearch() {
  const query = document.getElementById('bibliotecaSearchInput').value.trim();
  if (!query) return;

  const loading = document.getElementById('bibliotecaSearchLoading');
  const clearBtn = document.getElementById('bibliotecaClearBtn');
  const emptyEl = document.getElementById('bibliotecaEmpty');

  loading.style.display = 'flex';
  emptyEl.style.display = 'none';

  // Build the list of all effects and transitions for the LLM
  const allItems = [
    ...BIBLIOTECA_DATA.efeitos.map(e => `EFEITO: ${e.id} - ${e.name}: ${e.desc} [tags: ${e.tags.join(', ')}]`),
    ...BIBLIOTECA_DATA.transicoes.map(t => `TRANSICAO: ${t.id} - ${t.name}: ${t.desc} [tags: ${t.tags.join(', ')}]`)
  ].join('\n');

  const systemPrompt = `Voce e um assistente de busca de efeitos e transicoes de video. O usuario vai descrever o que precisa e voce deve retornar APENAS os IDs dos efeitos/transicoes que correspondem, separados por virgula. Nao retorne nada alem dos IDs. Se nenhum corresponder, retorne "NENHUM".

Lista disponivel:
${allItems}`;

  let matchedIds = [];

  try {
    // Try Pollinations OpenAI endpoint (free)
    const models = ['openai', 'mistral', 'llama'];
    let found = false;

    for (const model of models) {
      if (found) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            temperature: 0.1
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content && content !== 'NENHUM') {
            matchedIds = content.split(',').map(id => id.trim().toLowerCase()).filter(Boolean);
            found = true;
          } else if (content === 'NENHUM') {
            found = true;
          }
        }
      } catch (err) {
        console.warn(`Biblioteca search: model=${model} failed:`, err.message);
      }
    }

    // Fallback: local fuzzy search if LLM fails
    if (!found || matchedIds.length === 0) {
      matchedIds = bibliotecaLocalSearch(query);
    }
  } catch (err) {
    console.warn('Biblioteca LLM search failed, using local:', err);
    matchedIds = bibliotecaLocalSearch(query);
  }

  loading.style.display = 'none';
  clearBtn.style.display = '';

  // Apply filter
  applyBibliotecaFilter(matchedIds);
}

function bibliotecaLocalSearch(query) {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = q.split(/\s+/).filter(w => w.length > 2);
  const results = [];

  const allItems = [...BIBLIOTECA_DATA.efeitos, ...BIBLIOTECA_DATA.transicoes];
  allItems.forEach(item => {
    const searchText = `${item.name} ${item.desc} ${item.tags.join(' ')}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const score = words.reduce((acc, w) => acc + (searchText.includes(w) ? 1 : 0), 0);
    if (score > 0) results.push({ id: item.id, score });
  });

  results.sort((a, b) => b.score - a.score);
  return results.map(r => r.id);
}

function applyBibliotecaFilter(matchedIds) {
  const emptyEl = document.getElementById('bibliotecaEmpty');
  let anyVisible = false;

  // Show both sections when filtering
  document.querySelectorAll('.biblioteca-section').forEach(s => s.classList.add('active'));

  document.querySelectorAll('.biblioteca-card').forEach(card => {
    const id = card.dataset.id;
    if (matchedIds.includes(id)) {
      card.style.display = '';
      card.classList.add('highlight');
      anyVisible = true;
    } else {
      card.style.display = 'none';
      card.classList.remove('highlight');
    }
  });

  emptyEl.style.display = anyVisible ? 'none' : '';
  if (!anyVisible) {
    document.querySelectorAll('.biblioteca-section').forEach(s => s.classList.remove('active'));
  }
}

function openBibliotecaModal(item, section) {
  // Remove existing modal
  document.querySelector('.biblioteca-modal-overlay')?.remove();

  const typeLabel = section === 'efeitos' ? 'Efeito' : 'Transição';
  const overlay = document.createElement('div');
  overlay.className = 'biblioteca-modal-overlay';
  overlay.innerHTML = `
    <div class="biblioteca-modal">
      <div class="biblioteca-modal-header">
        <h3><i class="fas ${section === 'efeitos' ? 'fa-magic' : 'fa-shuffle'}" style="color:var(--accent);margin-right:8px;"></i>${escapeHtml(item.name)}</h3>
        <button class="biblioteca-modal-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="biblioteca-modal-body">
        ${item.video ? `<video class="biblioteca-modal-video" controls autoplay muted loop>
          <source src="${item.video}" type="video/mp4">
        </video>` : `<div class="biblioteca-modal-anim-preview">
          <div class="bib-anim-preview playing" data-anim="${item.anim}" style="height:220px;border-radius:var(--radius-md);">
            <div class="bib-anim-obj"></div>
          </div>
          <p style="text-align:center;color:var(--text-secondary);font-size:0.78rem;margin-top:8px;">Video de exemplo ainda nao adicionado</p>
        </div>`}
        ${item.prompt ? `<div class="biblioteca-modal-prompt">
          <h4><i class="fas fa-terminal" style="color:var(--accent);margin-right:6px;"></i>Prompt</h4>
          <p>${escapeHtml(item.prompt)}</p>
        </div>` : ''}
        <div class="biblioteca-modal-desc">${escapeHtml(item.desc)}</div>
        <div class="biblioteca-modal-tags">
          <span class="biblioteca-tag" style="background:rgba(173,57,251,0.15);border-color:rgba(173,57,251,0.3);">${escapeHtml(typeLabel)}</span>
          ${item.tags.map(t => `<span class="biblioteca-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="biblioteca-modal-usage">
          <h4><i class="fas fa-lightbulb" style="color:var(--accent);margin-right:6px;"></i>Quando usar</h4>
          <p>${escapeHtml(item.usage)}</p>
        </div>
        ${item.higgsfield ? `<a href="${item.higgsfield}" target="_blank" rel="noopener" class="biblioteca-higgsfield-link">
          <i class="fas fa-external-link-alt"></i> Ver no Higgsfield
        </a>` : ''}
        ${item.gallery && item.gallery.length > 0 ? `
        <div class="biblioteca-modal-gallery">
          <h4><i class="fas fa-images" style="color:var(--accent);margin-right:6px;"></i>Exemplos da Comunidade</h4>
          <div class="biblioteca-gallery-grid">
            ${item.gallery.map((g, i) => `
              <div class="biblioteca-gallery-item" data-gallery-index="${i}">
                ${g.thumb ? `<img src="${g.thumb}" alt="${g.title || ''}" loading="lazy">` : `<video src="${g.video}" muted preload="metadata"></video>`}
                ${g.title ? `<span class="biblioteca-gallery-title">${escapeHtml(g.title)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Close events
  overlay.querySelector('.biblioteca-modal-close').addEventListener('click', () => closeBibliotecaModal(overlay));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBibliotecaModal(overlay);
  });

  // Gallery item click events
  if (item.gallery && item.gallery.length > 0) {
    overlay.querySelectorAll('.biblioteca-gallery-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.galleryIndex);
        openBibliotecaGalleryDetail(item.gallery[idx], item.name);
      });
    });
  }
}

function openBibliotecaGalleryDetail(galleryItem, effectName) {
  document.querySelector('.biblioteca-gallery-detail-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'biblioteca-gallery-detail-overlay';
  overlay.innerHTML = `
    <div class="biblioteca-gallery-detail">
      <div class="biblioteca-modal-header">
        <h3><i class="fas fa-play-circle" style="color:var(--accent);margin-right:8px;"></i>${escapeHtml(effectName)}</h3>
        <button class="biblioteca-modal-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="biblioteca-modal-body">
        <video class="biblioteca-modal-video" controls autoplay muted loop>
          <source src="${galleryItem.video}" type="video/mp4">
        </video>
        ${galleryItem.prompt ? `<div class="biblioteca-modal-prompt">
          <h4><i class="fas fa-terminal" style="color:var(--accent);margin-right:6px;"></i>Prompt</h4>
          <p>${escapeHtml(galleryItem.prompt)}</p>
        </div>` : ''}
        ${galleryItem.title ? `<div class="biblioteca-modal-desc">${escapeHtml(galleryItem.title)}</div>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  overlay.querySelector('.biblioteca-modal-close').addEventListener('click', () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 250);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 250);
    }
  });
}

function closeBibliotecaModal(overlay) {
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 250);
}

// ==================== DECUPAGEM - ORDEM DO DIA ====================

let decupagemPdfText = '';
let decupagemRows = [];

function initDecupagem() {
  const uploadArea = document.getElementById('decupagemUploadArea');
  const fileInput = document.getElementById('decupagemFileInput');
  const fileInfo = document.getElementById('decupagemFileInfo');
  const fileRemove = document.getElementById('decupagemFileRemove');
  const generateBtn = document.getElementById('decupagemGenerateBtn');
  const togglePreview = document.getElementById('decupagemTogglePreview');
  const addRowBtn = document.getElementById('decupagemAddRow');
  const exportDocsBtn = document.getElementById('decupagemExportDocs');
  const exportHTMLBtn = document.getElementById('decupagemExportHTML');
  const copyTableBtn = document.getElementById('decupagemCopyTable');

  if (!uploadArea) return;

  // Upload click
  uploadArea.addEventListener('click', () => fileInput.click());

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleDecupagemPdf(file);
    } else {
      showToast('Selecione um arquivo PDF', 'error');
    }
  });

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      handleDecupagemPdf(fileInput.files[0]);
    }
  });

  // Remove file
  fileRemove.addEventListener('click', () => {
    decupagemPdfText = '';
    fileInput.value = '';
    fileInfo.style.display = 'none';
    document.getElementById('decupagemExtractPreview').style.display = 'none';
    uploadArea.style.display = '';
  });

  // Toggle extract preview
  togglePreview.addEventListener('click', () => {
    const textEl = document.getElementById('decupagemExtractText');
    textEl.classList.toggle('collapsed');
    togglePreview.querySelector('i').className = textEl.classList.contains('collapsed')
      ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
  });

  // Generate
  generateBtn.addEventListener('click', generateDecupagem);

  // Add row
  addRowBtn.addEventListener('click', () => {
    decupagemRows.push({ roteiro: '', cena: '', plano: '', ambiente: '', objeto: '', tecnica: '', nivel: '' });
    renderDecupagemTable();
  });

  // Export Google Docs
  exportDocsBtn.addEventListener('click', exportDecupagemToGoogleDocs);

  // Export HTML
  exportHTMLBtn.addEventListener('click', exportDecupagemHTML);

  // Copy table
  copyTableBtn.addEventListener('click', copyDecupagemTable);

  // Set today's date
  const dateInput = document.getElementById('decData');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

async function handleDecupagemPdf(file) {
  const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
  if (file.size > MAX_PDF_SIZE) {
    showToast('PDF muito grande (max 20MB)', 'error');
    return;
  }

  const uploadArea = document.getElementById('decupagemUploadArea');
  const fileInfo = document.getElementById('decupagemFileInfo');
  const extractPreview = document.getElementById('decupagemExtractPreview');
  const extractText = document.getElementById('decupagemExtractText');
  const fileName = document.getElementById('decupagemFileName');
  const pageCount = document.getElementById('decupagemPageCount');

  uploadArea.style.display = 'none';
  fileInfo.style.display = 'flex';
  fileName.textContent = file.name;
  pageCount.textContent = 'Extraindo...';

  try {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js nao carregou. Recarregue a pagina.');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (pdf.numPages > 100) {
      showToast('PDF com muitas paginas (max 100). Use um roteiro mais curto.', 'error');
      pageCount.textContent = 'Muitas paginas';
      return;
    }

    pageCount.textContent = `${pdf.numPages} pagina${pdf.numPages > 1 ? 's' : ''}`;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += `--- Pagina ${i} ---\n${pageText}\n\n`;
    }

    decupagemPdfText = fullText.trim();
    extractText.textContent = decupagemPdfText.substring(0, 3000) + (decupagemPdfText.length > 3000 ? '\n\n[...texto truncado na preview]' : '');
    extractText.classList.remove('collapsed');
    extractPreview.style.display = '';

    showToast(`PDF extraido: ${pdf.numPages} paginas`, 'success');
  } catch (err) {
    showToast('Erro ao extrair PDF: ' + err.message, 'error');
    pageCount.textContent = 'Erro';
    console.error('PDF extraction error:', err);
  }
}

async function generateDecupagem() {
  if (!decupagemPdfText) {
    showToast('Suba um PDF de roteiro primeiro', 'error');
    return;
  }

  const apiKey = getApiKey('gemini_api_key');
  if (!apiKey) {
    openApiKeyModal();
    showToast('Configure sua API key do Gemini primeiro', 'error');
    return;
  }

  const loading = document.getElementById('decupagemLoading');
  const result = document.getElementById('decupagemResult');
  const empty = document.getElementById('decupagemEmpty');
  const generateBtn = document.getElementById('decupagemGenerateBtn');

  loading.style.display = 'flex';
  result.style.display = 'none';
  empty.style.display = 'none';
  generateBtn.disabled = true;

  const cliente = document.getElementById('decCliente').value.trim();
  const projeto = document.getElementById('decProjeto').value.trim();

  // Prompt baseado no formato REAL de Ordem de Gravacao da Allfluence
  // Referencia: Bradesco P04 Ordem de Gravacao (dados reais validados)
  const systemPrompt = `Voce e um assistente de producao audiovisual brasileiro da produtora Allfluence.
Sua UNICA funcao e analisar roteiros/copys de campanhas publicitarias e gerar a DECUPAGEM para Ordem do Dia de gravacao.

=== REGRAS ABSOLUTAS (INEGOCIAVEIS) ===
1. USE SOMENTE informacoes que existem no texto do roteiro. NUNCA invente cenarios, objetos, acoes ou dialogos.
2. Se algo nao esta explicito no roteiro, escreva "A DEFINIR" — nunca presuma.
3. NAO busque informacoes fora do texto fornecido.
4. Cada CENA mencionada no roteiro gera linhas na decupagem. Cada ACAO DISTINTA dentro de uma cena gera um PLANO separado.
5. Se o roteiro menciona multiplos videos/criativos, identifique cada um pelo numero.

=== FORMATO REAL DA TABELA (baseado em ordens de gravacao reais) ===

As colunas da tabela sao:
- "roteiro": numero do roteiro/criativo (ex: "1", "3", "6"). Se o PDF tiver um unico roteiro, use "1" para todos.
- "cena": numero da cena com prefixo # (ex: "#1", "#2", "#3"). Numere sequencialmente por roteiro.
- "plano": numero sequencial do plano DENTRO da cena (ex: "Plano 1", "Plano 2"). Cada angulo ou enquadramento diferente e um plano novo.
- "ambiente": local/cenario onde a cena acontece, extraido do roteiro (ex: "Escritorio", "Quarto", "Rua", "Cozinha", "Tela verde", "Estudio"). Use nomes curtos e diretos.
- "objeto": lista de objetos de cena/props mencionados, separados por virgula (ex: "Celular, Cafe, Caderno, Laptop"). Se nenhum objeto for mencionado, use "—".
- "tecnica": tipo de enquadramento/plano cinematografico (ex: "Plano geral", "Plano medio", "Plano detalhe", "Close-up", "Tela do app", "POV"). Baseie-se na acao descrita.
- "nivel": nivel de complexidade de producao: "1" para cenas simples (estaticas, poucos elementos), "2" para cenas medias (movimento, efeitos leves), "3" para cenas complexas (efeitos especiais, muitos elementos, pos-producao pesada).

=== EXEMPLO REAL DE SAIDA (Bradesco P04) ===
[
  {"roteiro":"1","cena":"#1","plano":"Plano 1","ambiente":"Escritorio","objeto":"Cafe, Caderno, Caneta, Laptop","tecnica":"Plano geral","nivel":"1"},
  {"roteiro":"1","cena":"#2","plano":"Plano 1","ambiente":"Escritorio","objeto":"Cafe, Caderno, Caneta, Laptop","tecnica":"Plano medio","nivel":"1"},
  {"roteiro":"1","cena":"#3","plano":"Plano 1","ambiente":"Escritorio","objeto":"Cafe, Caderno, Caneta, Laptop","tecnica":"Plano geral","nivel":"1"},
  {"roteiro":"1","cena":"#4","plano":"Plano 1","ambiente":"Escritorio","objeto":"Celular, Cafe, Caderno, Caneta, Laptop","tecnica":"Plano medio","nivel":"1"},
  {"roteiro":"1","cena":"#4","plano":"Plano 2","ambiente":"Escritorio","objeto":"Celular","tecnica":"Tela do app","nivel":"1"},
  {"roteiro":"6","cena":"#1","plano":"Plano 1","ambiente":"Cozinha","objeto":"Sacola, Papelzinho","tecnica":"Plano medio","nivel":"2"},
  {"roteiro":"6","cena":"#2","plano":"Plano 1","ambiente":"Tela verde","objeto":"Papelzinho","tecnica":"Plano medio","nivel":"2"}
]

=== COMO ANALISAR O ROTEIRO ===
1. Identifique CADA cena descrita (mudanca de locacao, mudanca de acao, corte descrito).
2. Para cada cena, determine quantos PLANOS sao necessarios (cada angulo/enquadramento = 1 plano).
3. Extraia os OBJETOS DE CENA literalmente mencionados no texto.
4. Determine o AMBIENTE pela descricao do local.
5. Escolha a TECNICA pelo tipo de acao (dialogo frontal = Plano medio, visao geral = Plano geral, detalhe de produto = Plano detalhe, tela de celular = Tela do app).
6. Classifique o NIVEL: cena simples sem efeitos = "1", com movimento ou elementos extras = "2", com efeitos/pos-producao = "3".

${cliente ? `CLIENTE: ${cliente}` : ''}
${projeto ? `PROJETO: ${projeto}` : ''}

Retorne APENAS o JSON array. Sem markdown, sem explicacoes, sem texto antes ou depois do JSON.`;

  const userPrompt = `Analise o roteiro/copy abaixo e gere a decupagem completa para Ordem do Dia:

${decupagemPdfText}`;

  try {
    // Use Gemini with systemInstruction for better instruction following (Bug #4 fix)
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash-lite'];
    let responseText = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.15, maxOutputTokens: 65536 }
            })
          }
        );

        if (!response.ok) {
          // Bug #1 fix: only clear key on 401/403, NOT on 400
          if ([401, 403].includes(response.status)) {
            setApiKey('gemini_api_key', '');
            openApiKeyModal();
            throw new Error('API key invalida ou expirada. Configure uma nova.');
          }
          if (response.status === 400) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg = errBody.error?.message || '';
            if (errMsg.toLowerCase().includes('too long') || errMsg.toLowerCase().includes('token')) {
              throw new Error('Roteiro muito longo para o modelo. Tente um PDF menor.');
            }
            throw new Error('Requisicao invalida: ' + (errMsg || 'verifique o PDF'));
          }
          if (response.status === 429) {
            console.warn(`Quota exceeded for ${model}, trying next...`);
            continue;
          }
          throw new Error(`Erro do servidor (${response.status}). Tente novamente.`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        // Bug #2 fix: detect safety-filtered responses
        if (candidate?.finishReason === 'SAFETY' || data.promptFeedback?.blockReason) {
          throw new Error('Conteudo bloqueado pelo filtro de seguranca da IA. Revise o roteiro ou tente outro modelo.');
        }

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) responseText = part.text.trim();
          }
        }
        if (responseText) break;
      } catch (err) {
        if (err.message.includes('invalida') || err.message.includes('bloqueado') || err.message.includes('longo')) throw err;
        console.warn(`Decupagem: ${model} failed:`, err.message);
        continue;
      }
    }

    if (!responseText) {
      throw new Error('Nenhum modelo retornou resposta. Verifique sua API key do Gemini nas configuracoes e tente novamente.');
    }

    // Bug #6 fix: try direct parse first, then regex fallback
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try extracting JSON array with non-greedy regex anchored to end
      const jsonMatch = responseText.match(/\[[\s\S]*?\](?=\s*$)/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Last resort: find first [ to last ]
        const start = responseText.indexOf('[');
        const end = responseText.lastIndexOf(']');
        if (start !== -1 && end > start) {
          parsed = JSON.parse(responseText.substring(start, end + 1));
        } else {
          throw new Error('A IA nao retornou JSON valido. Tente novamente.');
        }
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('A IA nao retornou dados de decupagem validos. Tente novamente.');
    }

    decupagemRows = parsed.map(row => ({
      roteiro: String(row.roteiro || ''),
      cena: String(row.cena || ''),
      plano: String(row.plano || ''),
      ambiente: String(row.ambiente || ''),
      objeto: String(row.objeto || ''),
      tecnica: String(row.tecnica || ''),
      nivel: String(row.nivel || '')
    }));

    renderDecupagemHeaderPreview();
    renderDecupagemTable();

    loading.style.display = 'none';
    result.style.display = '';
    showToast(`Decupagem gerada: ${decupagemRows.length} planos`, 'success');

  } catch (err) {
    loading.style.display = 'none';
    empty.style.display = '';
    showToast('Erro ao gerar decupagem: ' + err.message, 'error');
    console.error('Decupagem generation error:', err);
  } finally {
    generateBtn.disabled = false;
  }
}

function renderDecupagemHeaderPreview() {
  const preview = document.getElementById('decupagemHeaderPreview');
  const fields = [
    ['Cliente', document.getElementById('decCliente').value || '—'],
    ['Projeto', document.getElementById('decProjeto').value || '—'],
    ['Criativos', document.getElementById('decCriativos').value || '—'],
    ['Data', formatDecDate(document.getElementById('decData').value) || '—'],
    ['Horario Inicio Gravacao', document.getElementById('decHoraInicio').value || '—'],
    ['Horario Final Gravacao', document.getElementById('decHoraFim').value || '—'],
    ['Horario Inicio Log', document.getElementById('decLogInicio').value || '—'],
    ['Horario Final Log', document.getElementById('decLogFim').value || '—'],
  ];

  preview.innerHTML = fields.map(([label, value]) =>
    `<div class="dec-info-item"><span class="dec-info-label">${escapeHtml(label)}:</span><span class="dec-info-value">${escapeHtml(value)}</span></div>`
  ).join('');
}

function formatDecDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function renderDecupagemTable() {
  const tbody = document.getElementById('decupagemTableBody');
  tbody.innerHTML = decupagemRows.map((row, i) => `
    <tr>
      <td><input type="text" value="${escapeHtml(row.roteiro)}" data-row="${i}" data-field="roteiro"></td>
      <td><input type="text" value="${escapeHtml(row.cena)}" data-row="${i}" data-field="cena" style="width:60px;"></td>
      <td><input type="text" value="${escapeHtml(row.plano)}" data-row="${i}" data-field="plano" style="width:80px;"></td>
      <td><textarea rows="2" data-row="${i}" data-field="ambiente">${escapeHtml(row.ambiente)}</textarea></td>
      <td><textarea rows="2" data-row="${i}" data-field="objeto">${escapeHtml(row.objeto)}</textarea></td>
      <td><input type="text" value="${escapeHtml(row.tecnica)}" data-row="${i}" data-field="tecnica" style="width:100px;"></td>
      <td><input type="text" value="${escapeHtml(row.nivel)}" data-row="${i}" data-field="nivel" style="width:80px;"></td>
      <td><button class="decupagem-row-delete" data-row="${i}" title="Remover"><i class="fas fa-trash-alt"></i></button></td>
    </tr>
  `).join('');

  // Bind edits
  tbody.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.row);
      const field = el.dataset.field;
      if (decupagemRows[idx]) {
        decupagemRows[idx][field] = el.value;
      }
    });
  });

  // Bind deletes
  tbody.querySelectorAll('.decupagem-row-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.row);
      decupagemRows.splice(idx, 1);
      renderDecupagemTable();
    });
  });
}

function getDecupagemHeaderData() {
  return {
    cliente: document.getElementById('decCliente').value || '',
    projeto: document.getElementById('decProjeto').value || '',
    criativos: document.getElementById('decCriativos').value || '',
    data: formatDecDate(document.getElementById('decData').value) || '',
    horaInicio: document.getElementById('decHoraInicio').value || '',
    horaFim: document.getElementById('decHoraFim').value || '',
    logInicio: document.getElementById('decLogInicio').value || '',
    logFim: document.getElementById('decLogFim').value || ''
  };
}

function buildDecupagemHTML() {
  const h = getDecupagemHeaderData();
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem do Dia - ${escapeHtml(h.cliente)} - ${escapeHtml(h.projeto)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 20px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .header-table td { border: 1px solid #bbb; padding: 6px 10px; font-size: 13px; }
    .header-table .label { background: #d8c4f0; font-weight: bold; width: 180px; }
    .header-table .value { background: #f5f0ff; }
    .dec-table { width: 100%; border-collapse: collapse; }
    .dec-table th { background: #d8c4f0; border: 1px solid #bbb; padding: 8px 10px; font-size: 12px; text-align: left; font-weight: bold; }
    .dec-table td { border: 1px solid #bbb; padding: 6px 10px; font-size: 12px; vertical-align: top; }
    .dec-table tr:nth-child(even) { background: #faf8ff; }
  </style>
</head>
<body>
  <h1>ORDEM DO DIA — DECUPAGEM</h1>
  <table class="header-table">
    <tr><td class="label">CLIENTE:</td><td class="value">${escapeHtml(h.cliente)}</td><td class="label">Data:</td><td class="value">${escapeHtml(h.data)}</td></tr>
    <tr><td class="label">PROJETO:</td><td class="value">${escapeHtml(h.projeto)}</td><td class="label">Horario Inicio - Gravacao:</td><td class="value">${escapeHtml(h.horaInicio)}</td></tr>
    <tr><td class="label">CRIATIVOS:</td><td class="value">${escapeHtml(h.criativos)}</td><td class="label">Horario Final - Gravacao:</td><td class="value">${escapeHtml(h.horaFim)}</td></tr>
    <tr><td class="label"></td><td class="value"></td><td class="label">Horario Inicio - Log.:</td><td class="value">${escapeHtml(h.logInicio)}</td></tr>
    <tr><td class="label"></td><td class="value"></td><td class="label">Horario Final - Log.:</td><td class="value">${escapeHtml(h.logFim)}</td></tr>
  </table>
  <table class="dec-table">
    <thead>
      <tr>
        <th>N° ROTEIRO</th><th>N° CENA</th><th>Plano</th><th>AMBIENTE / CENARIO</th><th>OBJETO DE CENA</th><th>TECNICA</th><th>Nivel 1</th>
      </tr>
    </thead>
    <tbody>
      ${decupagemRows.map(r => `<tr>
        <td>${escapeHtml(r.roteiro)}</td>
        <td>${escapeHtml(r.cena)}</td>
        <td>${escapeHtml(r.plano)}</td>
        <td>${escapeHtml(r.ambiente)}</td>
        <td>${escapeHtml(r.objeto)}</td>
        <td>${escapeHtml(r.tecnica)}</td>
        <td>${escapeHtml(r.nivel)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;
}

function exportDecupagemHTML() {
  if (decupagemRows.length === 0) {
    showToast('Gere uma decupagem primeiro', 'error');
    return;
  }
  const html = buildDecupagemHTML();
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const h = getDecupagemHeaderData();
  a.href = url;
  a.download = `ordem-do-dia-${h.cliente || 'decupagem'}-${h.data || 'sem-data'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('HTML exportado com sucesso', 'success');
}

function copyDecupagemTable() {
  if (decupagemRows.length === 0) {
    showToast('Gere uma decupagem primeiro', 'error');
    return;
  }
  const h = getDecupagemHeaderData();
  let text = `ORDEM DO DIA — DECUPAGEM\n`;
  text += `Cliente: ${h.cliente}\tProjeto: ${h.projeto}\tData: ${h.data}\n`;
  text += `Criativos: ${h.criativos}\n`;
  text += `Inicio Gravacao: ${h.horaInicio}\tFim Gravacao: ${h.horaFim}\n`;
  text += `Inicio Log: ${h.logInicio}\tFim Log: ${h.logFim}\n\n`;
  text += `N° ROTEIRO\tN° CENA\tPlano\tAMBIENTE / CENARIO\tOBJETO DE CENA\tTECNICA\tNivel 1\n`;
  text += decupagemRows.map(r =>
    `${r.roteiro}\t${r.cena}\t${r.plano}\t${r.ambiente}\t${r.objeto}\t${r.tecnica}\t${r.nivel}`
  ).join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('Tabela copiada (cole no Google Docs ou Sheets)', 'success');
  }).catch(() => {
    showToast('Erro ao copiar', 'error');
  });
}

async function exportDecupagemToGoogleDocs() {
  if (decupagemRows.length === 0) {
    showToast('Gere uma decupagem primeiro', 'error');
    return;
  }

  // Check if user is logged in with Google
  const savedUser = localStorage.getItem('google_user');
  if (!savedUser) {
    showToast('Faca login com Google primeiro para exportar ao Docs', 'error');
    return;
  }

  const exportBtn = document.getElementById('decupagemExportDocs');
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';

  try {
    // Request Google Docs scope via OAuth2
    const accessToken = await requestGoogleDocsToken();
    if (!accessToken) {
      throw new Error('Permissao negada para Google Docs');
    }

    const h = getDecupagemHeaderData();

    // Step 1: Create a new Google Doc
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Ordem do Dia - ${h.cliente || 'Decupagem'} - ${h.projeto || ''} - ${h.data || new Date().toLocaleDateString('pt-BR')}`
      })
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Erro ao criar documento (${createRes.status})`);
    }

    const doc = await createRes.json();
    const docId = doc.documentId;

    // Step 2: Build batch update requests to populate the doc
    const requests = [];
    let idx = 1; // cursor position

    // Title
    const title = 'ORDEM DO DIA — DECUPAGEM\n\n';
    requests.push({ insertText: { location: { index: idx }, text: title } });
    idx += title.length;

    // Header info
    const headerLines = [
      `CLIENTE: ${h.cliente}`,
      `PROJETO: ${h.projeto}`,
      `CRIATIVOS: ${h.criativos}`,
      `Data: ${h.data}    Horario Inicio Gravacao: ${h.horaInicio}`,
      `Horario Final Gravacao: ${h.horaFim}`,
      `Horario Inicio Log: ${h.logInicio}    Horario Final Log: ${h.logFim}`,
      ''
    ].join('\n') + '\n';
    requests.push({ insertText: { location: { index: idx }, text: headerLines } });
    idx += headerLines.length;

    // Insert table
    const numRows = decupagemRows.length + 1; // +1 for header
    const numCols = 7;
    requests.push({
      insertTable: {
        rows: numRows,
        columns: numCols,
        location: { index: idx }
      }
    });

    // Bug #3 fix: check batchUpdate response for errors
    const batchRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    if (!batchRes.ok) {
      const errData = await batchRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Erro ao popular documento (${batchRes.status})`);
    }

    // Step 3: Re-read the doc to get table cell positions
    const docRead = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!docRead.ok) {
      throw new Error(`Erro ao ler documento criado (${docRead.status})`);
    }
    const docData = await docRead.json();

    // Find the table in the document
    const table = docData.body.content.find(el => el.table);
    if (table) {
      const cellRequests = [];
      const headers = ['N° ROTEIRO', 'N° CENA', 'Plano', 'AMBIENTE / CENARIO', 'OBJETO DE CENA', 'TECNICA', 'Nivel 1'];
      const fields = ['roteiro', 'cena', 'plano', 'ambiente', 'objeto', 'tecnica', 'nivel'];

      // Populate header row
      for (let col = 0; col < numCols; col++) {
        const cell = table.table.tableRows[0].tableCells[col];
        const cellIdx = cell.content[0].paragraph.elements[0].startIndex;
        cellRequests.push({
          insertText: { location: { index: cellIdx }, text: headers[col] }
        });
      }

      // Populate data rows (reverse order to maintain indices)
      for (let row = decupagemRows.length; row >= 1; row--) {
        const rowData = decupagemRows[row - 1];
        for (let col = numCols - 1; col >= 0; col--) {
          const cell = table.table.tableRows[row].tableCells[col];
          const cellIdx = cell.content[0].paragraph.elements[0].startIndex;
          const value = String(rowData[fields[col]] || '');
          if (value) {
            cellRequests.push({
              insertText: { location: { index: cellIdx }, text: value }
            });
          }
        }
      }

      if (cellRequests.length > 0) {
        // Sort by index descending to avoid position shifts
        cellRequests.sort((a, b) => b.insertText.location.index - a.insertText.location.index);

        const cellRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests: cellRequests })
        });
        if (!cellRes.ok) {
          console.warn('Erro ao preencher celulas da tabela:', cellRes.status);
        }
      }
    }

    // Open the doc in a new tab
    window.open(`https://docs.google.com/document/d/${docId}/edit`, '_blank');
    showToast('Documento criado no Google Docs!', 'success');

  } catch (err) {
    console.error('Google Docs export error:', err);
    // Fallback: copy as tab-separated for manual paste
    showToast('Erro ao exportar: ' + err.message + '. Tente "Copiar" e cole manualmente no Docs.', 'error');
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = '<i class="fab fa-google-drive"></i> Google Docs';
  }
}

function requestGoogleDocsToken() {
  return new Promise((resolve) => {
    try {
      if (typeof google === 'undefined' || !google.accounts) {
        resolve(null);
        return;
      }
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
        callback: (response) => {
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            resolve(null);
          }
        }
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      console.error('Google Docs auth error:', e);
      resolve(null);
    }
  });
}
