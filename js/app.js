// === AI Performance Studio - Main Application ===

// Gemini API Key - salva apenas no navegador do usuario via localStorage

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTopbar();
  initPrompt();
  initSettings();
  initGeneration();
  initLightbox();
  initKeyboardShortcuts();
  initApiKeyModal();
});

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

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (window.innerWidth <= 900) closeSidebar();
    });
  });
}

// === TOPBAR ===
function initTopbar() {
  document.querySelectorAll('.topbar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.topbar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

// === PROMPT ===
let syncTimeout = null;

function initPrompt() {
  const textarea = document.getElementById('promptInput');

  // Auto-resize textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // Enhance button (Gemini) - opens bilingual
  document.getElementById('enhanceBtn').addEventListener('click', () => {
    if (!textarea.value.trim()) {
      showToast('Escreva um prompt primeiro', 'error');
      return;
    }
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

    syncTimeout = setTimeout(() => {
      syncPTtoEN();
    }, 1500); // Wait 1.5s after user stops typing
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

  // Close bilingual
  document.getElementById('closeBilingualBtn').addEventListener('click', () => {
    document.getElementById('bilingualArea').style.display = 'none';
  });
}

// === GEMINI ENHANCE (BILINGUAL) ===
async function callGemini(prompt) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) { openApiKeyModal(); return null; }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    if (response.status === 403 || response.status === 401 || response.status === 400) {
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

async function enhancePromptBilingual(original) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) { openApiKeyModal(); return; }

  // UI loading
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

    // Parse PT and EN
    let ptText = '';
    let enText = '';

    const ptMatch = result.match(/---PT---\s*([\s\S]*?)\s*---EN---/);
    const enMatch = result.match(/---EN---\s*([\s\S]*?)$/);

    if (ptMatch) ptText = ptMatch[1].trim();
    if (enMatch) enText = enMatch[1].trim();

    // Fallback if format not matched
    if (!ptText && !enText) {
      ptText = result;
      enText = result;
    }

    // Fill bilingual area
    document.getElementById('promptPT').value = ptText;
    document.getElementById('promptEN').value = enText;
    document.getElementById('bilingualArea').style.display = 'block';
    document.getElementById('syncStatus').innerHTML = '<i class="fas fa-check"></i> Sincronizado';
    document.getElementById('syncStatus').className = 'bilingual-sync';

    // Also update main prompt with EN (for generation)
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

// Sync PT edits to EN automatically
async function syncPTtoEN() {
  const ptText = document.getElementById('promptPT').value.trim();
  if (!ptText) return;

  const syncStatus = document.getElementById('syncStatus');
  syncStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
  syncStatus.className = 'bilingual-sync syncing';

  try {
    const enText = await callGemini(
      `INSTRUCAO: Traduza o texto abaixo para ingles. Este e um prompt para geracao de imagem com IA. Retorne SOMENTE a traducao, nada mais. Sem explicacoes, sem prefixos.\n\nTexto: ${ptText}`
    );

    if (enText) {
      document.getElementById('promptEN').value = enText;
      document.getElementById('promptInput').value = enText;
      syncStatus.innerHTML = '<i class="fas fa-check"></i> Sincronizado';
      syncStatus.className = 'bilingual-sync';
    }
  } catch (error) {
    syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro ao sincronizar';
    syncStatus.className = 'bilingual-sync';
    console.error('Sync error:', error);
  }
}

// === SETTINGS ===
function initSettings() {
  // Ratio pills
  document.querySelectorAll('.ratio-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Quantity pills
  document.querySelectorAll('.qty-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Seed toggle
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

// === GENERATION (Real AI Images via Pollinations.ai - 100% FREE) ===
function initGeneration() {
  document.getElementById('generateBtn').addEventListener('click', startGeneration);
  document.getElementById('generateBtnMain').addEventListener('click', startGeneration);
}

async function startGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) {
    showToast('Escreva um prompt para gerar', 'error');
    document.getElementById('promptInput').focus();
    return;
  }

  // Get settings
  const activeRatio = document.querySelector('.ratio-pill.active');
  const width = parseInt(activeRatio?.dataset.w || 1024);
  const height = parseInt(activeRatio?.dataset.h || 1024);
  const qty = parseInt(document.querySelector('.qty-pill.active')?.dataset.qty || 1);
  const model = document.getElementById('modelSelect').value;
  const seedToggle = document.getElementById('seedToggle');
  const baseSeed = seedToggle.classList.contains('locked') ? parseInt(seedToggle.dataset.seed) : null;

  // Map model to Pollinations model names
  const modelMap = {
    'flux': 'flux',
    'turbo': 'turbo',
    'sdxl': 'flux-realism'
  };
  const pollinationsModel = modelMap[model] || 'flux';

  // Show loading
  document.getElementById('displayEmpty').style.display = 'none';
  document.getElementById('displayResults').style.display = 'none';
  document.getElementById('displayLoading').style.display = 'block';

  // Disable buttons
  const genBtn = document.getElementById('generateBtnMain');
  const sendBtn = document.getElementById('generateBtn');
  genBtn.disabled = true;
  sendBtn.disabled = true;
  genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Gerando...</span>';

  const grid = document.getElementById('resultsMasonry');
  let successCount = 0;

  // Generate images sequentially for reliability
  for (let i = 0; i < qty; i++) {
    const seed = baseSeed ? baseSeed + i : Math.floor(Math.random() * 999999999);

    try {
      const imageUrl = await generateSingleImage(prompt, width, height, seed, pollinationsModel);

      if (imageUrl) {
        const safePrompt = prompt.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
          <img src="${imageUrl}" alt="Generated" crossorigin="anonymous">
          <div class="result-card-overlay">
            <button title="Download" onclick="event.stopPropagation(); downloadImage(this.closest('.result-card').querySelector('img').src, 'ai-image-${seed}.png')"><i class="fas fa-download"></i></button>
            <button title="Variacao" onclick="event.stopPropagation(); startGeneration()"><i class="fas fa-copy"></i></button>
            <button title="Favoritar" onclick="event.stopPropagation(); this.style.color='var(--accent)'"><i class="fas fa-heart"></i></button>
          </div>
        `;
        const ratio = activeRatio?.dataset.ratio || '1:1';
        card.addEventListener('click', () => openLightbox(card.querySelector('img').src, prompt, ratio));
        grid.insertBefore(card, grid.firstChild);
        successCount++;

        // Show results progressively
        document.getElementById('displayLoading').style.display = 'none';
        document.getElementById('displayResults').style.display = 'block';
      }
    } catch (error) {
      console.error('Generation error:', error);
    }
  }

  // Finish
  genBtn.disabled = false;
  sendBtn.disabled = false;
  genBtn.innerHTML = '<i class="fas fa-bolt"></i> <span>Gerar</span>';

  if (successCount > 0) {
    document.getElementById('displayLoading').style.display = 'none';
    document.getElementById('displayResults').style.display = 'block';
    showToast(`${successCount} imagem(ns) gerada(s)!`, 'success');
  } else {
    document.getElementById('displayLoading').style.display = 'none';
    document.getElementById('displayEmpty').style.display = 'flex';
    showToast('Erro ao gerar. Tente novamente.', 'error');
  }
}

async function generateSingleImage(prompt, width, height, seed, model) {
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true&enhance=true&nofeed=true`;

  // Fetch the image as blob to ensure it loads completely
  const response = await fetch(url, { mode: 'cors' });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();

  if (blob.size < 1000) {
    throw new Error('Image too small, likely an error');
  }

  // Create object URL from blob
  const objectUrl = URL.createObjectURL(blob);
  return objectUrl;
}

async function downloadImage(imgSrc, filename) {
  try {
    let blob;

    if (imgSrc.startsWith('blob:')) {
      // Already a blob URL, fetch it
      const response = await fetch(imgSrc);
      blob = await response.blob();
    } else {
      const response = await fetch(imgSrc, { mode: 'cors' });
      blob = await response.blob();
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Download iniciado!', 'success');
  } catch (e) {
    console.error('Download error:', e);
    // Fallback: open in new tab
    window.open(imgSrc, '_blank');
  }
}

// === LIGHTBOX ===
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function openLightbox(src, prompt, ratio) {
  const lightbox = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxInfo').innerHTML = `
    <p><strong>Prompt:</strong> ${prompt}</p>
    <p><strong>Ratio:</strong> ${ratio}</p>
  `;
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
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      startGeneration();
    }
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      document.getElementById('promptInput').focus();
    }
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
        <h3><i class="fas fa-key" style="color: var(--accent); margin-right: 8px;"></i>Configurar Gemini API</h3>
        <button class="btn-tiny" onclick="closeApiKeyModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 12px;">
          Para usar o botao "Melhorar" com IA, voce precisa de uma API key do Google Gemini.
          <a href="https://aistudio.google.com/apikey" target="_blank" style="color: var(--accent);">Criar chave gratis aqui</a>
        </p>
        <div class="setting-group">
          <label>API Key do Gemini</label>
          <div style="display: flex; gap: 6px;">
            <input type="password" class="input-field" id="apiKeyInput" placeholder="Cole sua API key aqui...">
            <button class="btn-tiny" id="toggleKeyVisibility" title="Mostrar/ocultar"><i class="fas fa-eye"></i></button>
          </div>
        </div>
        <div style="margin-top: 8px; padding: 8px 10px; background: var(--accent-subtle); border-radius: var(--radius-md); font-size: 0.75rem; color: var(--text-secondary);">
          <i class="fas fa-shield-halved" style="color: var(--accent);"></i>
          Sua chave fica salva apenas no seu navegador e nunca e enviada para nossos servidores.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeApiKeyModal()">Cancelar</button>
        <button class="btn-primary" id="saveApiKeyBtn"><i class="fas fa-check"></i> Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) { showToast('Cole uma API key valida', 'error'); return; }
    localStorage.setItem('gemini_api_key', key);
    closeApiKeyModal();
    showToast('API key salva!', 'success');
  });

  document.getElementById('toggleKeyVisibility').addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('toggleKeyVisibility').querySelector('i');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('saveApiKeyBtn').click();
  });

  updateApiKeyStatus();
}

function openApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  document.getElementById('apiKeyInput').value = localStorage.getItem('gemini_api_key') || '';
  modal.classList.add('open');
}

function closeApiKeyModal() {
  document.getElementById('apiKeyModal').classList.remove('open');
  updateApiKeyStatus();
}

function updateApiKeyStatus() {
  const hasKey = !!localStorage.getItem('gemini_api_key');
  const creditsDisplay = document.querySelector('.credits-display');
  if (hasKey) {
    creditsDisplay.innerHTML = '<i class="fas fa-check-circle" style="color: var(--green);"></i> <span>Gemini conectado</span>';
  } else {
    creditsDisplay.innerHTML = '<i class="fas fa-key"></i> <span>Configurar Gemini</span>';
  }
  creditsDisplay.onclick = openApiKeyModal;
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
