// === AI Performance Studio - Main Application ===

// Gemini API Key - salva apenas no navegador do usuario via localStorage

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTabs();
  initPrompt();
  initSettings();
  initUpload();
  initGeneration();
  initLightbox();
  initGallery();
  initKeyboardShortcuts();
  initApiKeyModal();
});

// === SIDEBAR ===
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  menuToggle.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  });

  sidebarClose.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }

  // Nav items
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (window.innerWidth <= 900) closeSidebar();
    });
  });
}

// === TABS ===
function initTabs() {
  // Topbar model tabs
  document.querySelectorAll('.topbar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.topbar-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      showToast(`Modelo: ${tab.textContent}`, 'success');
    });
  });

  // Output tabs
  document.querySelectorAll('.output-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const outputEmpty = document.getElementById('outputEmpty');
      const outputResults = document.getElementById('outputResults');
      const gallerySection = document.getElementById('gallerySection');

      outputEmpty.style.display = 'none';
      outputResults.style.display = 'none';
      gallerySection.style.display = 'none';

      const tabText = tab.textContent.trim();
      if (tabText === 'Resultado') {
        if (document.getElementById('resultsGrid').children.length > 0) {
          outputResults.style.display = 'block';
        } else {
          outputEmpty.style.display = 'flex';
        }
      } else if (tabText === 'Galeria') {
        gallerySection.style.display = 'block';
      } else {
        outputEmpty.style.display = 'flex';
      }
    });
  });

  // Mobile nav
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// === PROMPT ===
function initPrompt() {
  const negToggle = document.getElementById('negPromptToggle');
  const negContent = document.getElementById('negPromptContent');

  negToggle.addEventListener('click', () => {
    negToggle.classList.toggle('open');
    negContent.classList.toggle('open');
  });

  // Quick prompt chips
  document.querySelectorAll('.quick-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      document.getElementById('promptInput').value = prompt;
      document.getElementById('promptInput').focus();
    });
  });

  // Auto-resize textarea
  const promptInput = document.getElementById('promptInput');
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = promptInput.scrollHeight + 'px';
  });

  // Enhance prompt button
  document.querySelector('.prompt-actions .btn-small:first-child').addEventListener('click', () => {
    const textarea = document.getElementById('promptInput');
    if (!textarea.value.trim()) {
      showToast('Escreva um prompt primeiro', 'error');
      return;
    }
    enhancePrompt(textarea);
  });

  // Random prompt
  document.querySelector('.prompt-actions .btn-small:last-child').addEventListener('click', () => {
    const prompts = [
      'Castelo flutuante nas nuvens ao por do sol, estilo fantasia epico, iluminacao dramatica, ultra detalhado 8k',
      'Retrato de astronauta com reflexo de nebulosa no capacete, fotorrealista, cinematico',
      'Cidade subaquatica futurista com bioluminescencia, estilo concept art, atmosfera mistica',
      'Lobo mecanico steampunk em floresta encantada, arte digital, cores vibrantes',
      'Interior de biblioteca magica com livros voando, iluminacao quente, estilo anime detalhado',
      'Guerreiro cyberpunk em moto futurista nas ruas de Tokyo, neon, chuva, cinematico',
      'Jardim japones zen com cerejeiras em flor, estilo aquarela, sereno e detalhado',
      'Dragao de cristal voando sobre montanhas nevadas, fantasia epica, ray tracing'
    ];
    const random = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById('promptInput').value = random;
  });
}

async function enhancePrompt(textarea) {
  const apiKey = localStorage.getItem('gemini_api_key');

  if (!apiKey) {
    openApiKeyModal();
    return;
  }

  const original = textarea.value.trim();
  if (!original) {
    showToast('Escreva um prompt primeiro', 'error');
    return;
  }

  // UI feedback - loading state
  textarea.parentElement.classList.add('prompt-enhancing');
  const enhanceBtn = document.querySelector('.prompt-actions .btn-small:first-child');
  const originalBtnHTML = enhanceBtn.innerHTML;
  enhanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pensando...';
  enhanceBtn.disabled = true;
  textarea.disabled = true;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `INSTRUCAO: Voce vai receber um prompt para geracao de imagem com IA. Sua unica tarefa e reescrever esse prompt de forma melhorada, mais detalhada e profissional. NAO escreva explicacoes, NAO escreva introducoes, NAO escreva "Aqui esta", NAO escreva nada alem do prompt melhorado. Retorne SOMENTE o texto do prompt melhorado, nada mais.\n\nPrompt para melhorar: ${original}`
            }]
          }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 65536
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403 || response.status === 401 || response.status === 400) {
        localStorage.removeItem('gemini_api_key');
        openApiKeyModal();
        throw new Error('API key invalida. Cole uma nova chave.');
      }
      throw new Error(errorData.error?.message || `Erro ${response.status}`);
    }

    const data = await response.json();

    // Gemini Thinking model returns thoughts + response in candidates
    let enhancedText = '';
    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts) {
      // Get the last text part (the actual response, not the thinking)
      for (const part of candidate.content.parts) {
        if (part.text) {
          enhancedText = part.text.trim();
        }
      }
    }

    if (enhancedText) {
      textarea.value = enhancedText;
      // Auto-resize
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
      showToast('Prompt melhorado com Gemini AI!', 'success');
    } else {
      throw new Error('Resposta vazia do Gemini');
    }

  } catch (error) {
    console.error('Gemini API error:', error);
    showToast(error.message || 'Erro ao melhorar prompt', 'error');

    if (error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('invalid')) {
      localStorage.removeItem('gemini_api_key');
      openApiKeyModal();
    }
  } finally {
    textarea.parentElement.classList.remove('prompt-enhancing');
    enhanceBtn.innerHTML = originalBtnHTML;
    enhanceBtn.disabled = false;
    textarea.disabled = false;
    textarea.focus();
  }
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
        <button class="btn-icon" onclick="closeApiKeyModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 14px;">
          Para usar o botao "Melhorar" com IA, voce precisa de uma API key do Google Gemini.
          <a href="https://aistudio.google.com/apikey" target="_blank" style="color: var(--accent);">Criar chave gratis aqui</a>
        </p>
        <div class="setting-group">
          <label>API Key do Gemini</label>
          <div style="display: flex; gap: 8px;">
            <input type="password" class="input-field" id="apiKeyInput" placeholder="Cole sua API key aqui...">
            <button class="btn-tiny" id="toggleKeyVisibility" title="Mostrar/ocultar"><i class="fas fa-eye"></i></button>
          </div>
        </div>
        <div style="margin-top: 10px; padding: 10px; background: var(--accent-subtle); border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-secondary);">
          <i class="fas fa-shield-halved" style="color: var(--accent);"></i>
          Sua chave fica salva apenas no seu navegador (localStorage) e nunca e enviada para nossos servidores.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeApiKeyModal()">Cancelar</button>
        <button class="btn-primary" id="saveApiKeyBtn"><i class="fas fa-check"></i> Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Save key
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
      showToast('Cole uma API key valida', 'error');
      return;
    }
    localStorage.setItem('gemini_api_key', key);
    closeApiKeyModal();
    showToast('API key salva com sucesso!', 'success');
  });

  // Toggle visibility
  document.getElementById('toggleKeyVisibility').addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('toggleKeyVisibility').querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  });

  // Enter to save
  document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('saveApiKeyBtn').click();
  });

  // Show config button in sidebar footer if key exists
  updateApiKeyStatus();
}

function openApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  const input = document.getElementById('apiKeyInput');
  const savedKey = localStorage.getItem('gemini_api_key') || '';
  input.value = savedKey;
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
    creditsDisplay.style.cursor = 'pointer';
    creditsDisplay.onclick = openApiKeyModal;
  } else {
    creditsDisplay.innerHTML = '<i class="fas fa-key"></i> <span>Configurar Gemini</span>';
    creditsDisplay.style.cursor = 'pointer';
    creditsDisplay.onclick = openApiKeyModal;
  }
}

// === SETTINGS ===
function initSettings() {
  // Advanced toggle
  const advToggle = document.getElementById('advancedToggle');
  const advSettings = document.getElementById('advancedSettings');

  advToggle.addEventListener('click', () => {
    advSettings.classList.toggle('open');
    advToggle.querySelector('i').style.transform = advSettings.classList.contains('open') ? 'rotate(180deg)' : '';
  });

  // Ratio buttons
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Style chips
  document.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Quantity buttons
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Sliders
  initSlider('cfgSlider', 'cfgValue');
  initSlider('stepsSlider', 'stepsValue');
  initSlider('refStrengthSlider', 'refStrengthValue');

  // Random seed
  document.getElementById('randomSeed').addEventListener('click', () => {
    document.getElementById('seedInput').value = Math.floor(Math.random() * 999999999);
  });
}

function initSlider(sliderId, valueId) {
  const slider = document.getElementById(sliderId);
  const value = document.getElementById(valueId);
  if (!slider || !value) return;

  slider.addEventListener('input', () => {
    value.textContent = slider.value;
    // Update slider track fill
    const percent = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--accent) ${percent}%, var(--border) ${percent}%)`;
  });

  // Init fill
  const percent = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent) ${percent}%, var(--border) ${percent}%)`;
}

// === FILE UPLOAD ===
function initUpload() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--accent)';
    uploadZone.style.background = 'var(--accent-subtle)';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = '';
    uploadZone.style.background = '';
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    uploadZone.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleUpload(e.target.files[0]);
  });
}

function handleUpload(file) {
  const uploadZone = document.getElementById('uploadZone');
  const reader = new FileReader();

  reader.onload = (e) => {
    uploadZone.innerHTML = `
      <img src="${e.target.result}" alt="Reference" style="max-width: 100%; max-height: 150px; border-radius: var(--radius-md); object-fit: contain;">
      <button class="btn-small" onclick="removeUpload()" style="margin-top: 6px;"><i class="fas fa-trash"></i> Remover</button>
    `;
    showToast('Imagem de referencia carregada!', 'success');
  };

  reader.readAsDataURL(file);
}

function removeUpload() {
  const uploadZone = document.getElementById('uploadZone');
  uploadZone.innerHTML = `
    <i class="fas fa-cloud-upload-alt"></i>
    <p>Arraste uma imagem ou <span class="upload-link">clique aqui</span></p>
    <span class="upload-hint">PNG, JPG ou WebP ate 10MB</span>
  `;
}

// === GENERATION ===
function initGeneration() {
  const generateBtn = document.getElementById('generateBtn');

  generateBtn.addEventListener('click', startGeneration);
}

function startGeneration() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) {
    showToast('Escreva um prompt para gerar', 'error');
    document.getElementById('promptInput').focus();
    return;
  }

  const qty = document.querySelector('.qty-btn.active')?.dataset.qty || 2;
  const ratio = document.querySelector('.ratio-btn.active')?.dataset.ratio || '16:9';
  const style = document.querySelector('.style-chip.active')?.textContent || 'Nenhum';

  // Show loading
  document.getElementById('outputEmpty').style.display = 'none';
  document.getElementById('outputResults').style.display = 'none';
  document.getElementById('outputLoading').style.display = 'flex';

  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  let progress = 0;

  const interval = setInterval(() => {
    progress += Math.random() * 8 + 2;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(() => showResults(parseInt(qty), prompt, ratio, style), 500);
    }
    progressBar.style.width = progress + '%';
    progressPercent.textContent = Math.round(progress) + '%';
  }, 200);

  // Disable button during generation
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Gerando...</span>';

  showToast('Geracao iniciada...', 'success');
}

function showResults(qty, prompt, ratio, style) {
  document.getElementById('outputLoading').style.display = 'none';
  document.getElementById('outputResults').style.display = 'block';

  const grid = document.getElementById('resultsGrid');

  // Generate placeholder images using picsum
  const newCards = [];
  for (let i = 0; i < qty; i++) {
    const seed = Math.floor(Math.random() * 1000);
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <img src="https://picsum.photos/seed/${seed}/640/360" alt="Generated image" loading="lazy">
      <div class="result-card-overlay">
        <div class="result-card-actions">
          <button title="Download" onclick="event.stopPropagation()"><i class="fas fa-download"></i></button>
          <button title="Upscale" onclick="event.stopPropagation()"><i class="fas fa-expand"></i></button>
          <button title="Variacao" onclick="event.stopPropagation()"><i class="fas fa-copy"></i></button>
          <button title="Favoritar" onclick="event.stopPropagation()"><i class="fas fa-heart"></i></button>
        </div>
      </div>
    `;
    card.setAttribute('data-prompt', prompt);
    card.setAttribute('data-ratio', ratio);
    card.setAttribute('data-style', style);
    card.addEventListener('click', () => openLightbox(card.querySelector('img').src, prompt, ratio, style));
    newCards.push(card);
  }

  // Prepend new results
  newCards.reverse().forEach(card => {
    grid.insertBefore(card, grid.firstChild);
  });

  // Reset button
  const btn = document.getElementById('generateBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-bolt"></i> <span>Gerar Imagem</span> <span class="credit-cost">2 creditos</span>';

  showToast(`${qty} imagens geradas com sucesso!`, 'success');
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

function openLightbox(src, prompt, ratio, style) {
  const lightbox = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxInfo').innerHTML = `
    <p><strong>Prompt:</strong> ${prompt}</p>
    <p><strong>Proporcao:</strong> ${ratio} | <strong>Estilo:</strong> ${style}</p>
  `;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

// === GALLERY ===
function initGallery() {
  const galleryGrid = document.getElementById('galleryGrid');

  // Create sample gallery items
  const sampleImages = [];
  for (let i = 0; i < 12; i++) {
    const seed = 100 + i * 37;
    sampleImages.push({
      src: `https://picsum.photos/seed/${seed}/400/400`,
      prompt: 'Imagem da galeria',
      style: ['Fotorrealista', 'Anime', 'Digital Art', 'Cinematico', '3D'][i % 5]
    });
  }

  sampleImages.forEach(img => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `<img src="${img.src}" alt="${img.prompt}" loading="lazy">`;
    item.addEventListener('click', () => openLightbox(img.src, img.prompt, '1:1', img.style));
    galleryGrid.appendChild(item);
  });

  // Gallery filter chips
  document.querySelectorAll('.gallery-filters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

// === KEYBOARD SHORTCUTS ===
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter to generate
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('generateBtn').click();
    }

    // Ctrl+/ to focus prompt
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      document.getElementById('promptInput').focus();
    }
  });
}

// === TOAST NOTIFICATIONS ===
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
