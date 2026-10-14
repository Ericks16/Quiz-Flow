// State Management
let currentQuiz = null;
let currentResponses = [];
let lastSubmissionResult = null;
let selectedPdfFile = null;

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initDateDefault();
  await loadServerInfo();
  await loadCurrentQuiz('seguridad-incendios-rtm');
  await loadAdminResponses();
  lucide.createIcons();
});

// Set default date input to today
function initDateDefault() {
  const dateInput = document.getElementById('form-date-input');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// Fetch server info (IP, QR code)
async function loadServerInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    const qrImg = document.getElementById('qr-code-img');
    const shareLink = document.getElementById('mobile-share-link');
    if (qrImg && data.qrCodeDataUrl) qrImg.src = data.qrCodeDataUrl;
    if (shareLink && data.mobileUrl) shareLink.value = data.mobileUrl;
  } catch (err) {
    console.error('Error loading server info:', err);
  }
}

// Switch main view
function switchView(viewId) {
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('results-view').classList.add('hidden');
  document.getElementById('admin-view').classList.add('hidden');

  document.getElementById(viewId).classList.remove('hidden');

  // Update nav buttons
  const quizBtn = document.getElementById('nav-quiz-btn');
  const adminBtn = document.getElementById('nav-admin-btn');

  if (viewId === 'quiz-view' || viewId === 'results-view') {
    quizBtn.className = 'flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all text-brand-700 bg-brand-50';
    adminBtn.className = 'flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100';
  } else {
    adminBtn.className = 'flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all text-brand-700 bg-brand-50';
    quizBtn.className = 'flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100';
    loadAdminResponses();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => lucide.createIcons(), 50);
}

// Load Quiz
async function loadCurrentQuiz(quizId) {
  try {
    const res = await fetch(`/api/quizzes/${quizId}`);
    if (!res.ok) throw new Error('Error al cargar cuestionario');
    currentQuiz = await res.json();
    renderQuizHeader();
    renderQuestions();
    populateAdminEditor();
    
    // Update Excel download button
    const excelBtn = document.getElementById('btn-export-excel');
    if (excelBtn) {
      excelBtn.href = `/api/quizzes/${currentQuiz.id}/export-excel`;
    }
  } catch (err) {
    console.error(err);
    alert('Error conectando con el servidor.');
  }
}

// Render Header details
function renderQuizHeader() {
  if (!currentQuiz) return;
  document.getElementById('quiz-title').innerText = currentQuiz.title;
  document.getElementById('quiz-subtitle').innerText = currentQuiz.subtitle || '';
  document.getElementById('quiz-org-label').innerText = currentQuiz.organization || 'EVALUACIÓN';
  document.getElementById('quiz-badge-points').innerText = `${currentQuiz.totalPoints || 10} pts`;
  document.getElementById('quiz-badge-pass').innerText = `${currentQuiz.passingScore || 7} pts`;

  const bannerDisplay = document.getElementById('quiz-banner-display');
  const bannerPrompt = document.getElementById('quiz-banner-upload-prompt');
  const bannerImg = document.getElementById('quiz-banner-img');

  if (currentQuiz.bannerImage && currentQuiz.bannerImage.trim() !== '') {
    bannerImg.src = currentQuiz.bannerImage;
    bannerDisplay.classList.remove('hidden');
    bannerPrompt.classList.add('hidden');
  } else {
    bannerDisplay.classList.add('hidden');
    bannerPrompt.classList.remove('hidden');
  }
}

// Upload Banner Image from Participant or Admin View
async function handleBannerUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      currentQuiz.bannerImage = data.url;
      renderQuizHeader();
      populateAdminEditor();
      await saveQuizSilently();
    } else {
      alert('Error subiendo imagen: ' + data.error);
    }
  } catch (err) {
    alert('Error al conectar con el servidor para subir la imagen: ' + err.message);
  }
}

// Remove Banner Image
async function removeBannerImage() {
  if (confirm('¿Desea quitar la imagen de portada del formulario?')) {
    currentQuiz.bannerImage = '';
    renderQuizHeader();
    populateAdminEditor();
    await saveQuizSilently();
  }
}

// Silent save helper when uploading images
async function saveQuizSilently() {
  if (!currentQuiz) return;
  try {
    await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentQuiz)
    });
  } catch (e) {
    console.error('Silent save error:', e);
  }
}

// Admin Banner Upload
async function handleAdminBannerUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      currentQuiz.bannerImage = data.url;
      const bannerInput = document.getElementById('editor-quiz-banner');
      if (bannerInput) bannerInput.value = data.url;
      const previewBox = document.getElementById('editor-banner-preview');
      const previewImg = document.getElementById('editor-banner-preview-img');
      if (previewBox && previewImg) {
        previewImg.src = data.url;
        previewBox.classList.remove('hidden');
      }
      renderQuizHeader();
      await saveQuizSilently();
    } else {
      alert('Error subiendo imagen: ' + data.error);
    }
  } catch (err) {
    alert('Error al subir imagen: ' + err.message);
  }
}

function removeAdminBanner() {
  currentQuiz.bannerImage = '';
  const bannerInput = document.getElementById('editor-quiz-banner');
  if (bannerInput) bannerInput.value = '';
  const previewBox = document.getElementById('editor-banner-preview');
  if (previewBox) previewBox.classList.add('hidden');
  renderQuizHeader();
  saveQuizSilently();
}

// Render dynamic questions list for participant
function renderQuestions() {
  const container = document.getElementById('questions-container');
  container.innerHTML = '';

  if (!currentQuiz || !currentQuiz.questions) return;

  currentQuiz.questions.forEach((q, index) => {
    const qNum = index + 1;
    const isFeedback = q.type === 'feedback';
    const card = document.createElement('div');
    card.className = 'question-card bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-4';
    card.id = `q-card-${q.id}`;

    // Header of Question Card
    let headerHtml = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <span class="w-8 h-8 rounded-xl bg-slate-900 text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-sm">
            ${qNum}
          </span>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              ${escapeHtml(q.prompt)}
            </h3>
            <span class="text-xs text-slate-400 font-semibold">${isFeedback ? 'Pregunta de opinión' : `Valor: ${q.points || 1} Punto(s)`}</span>
          </div>
        </div>
        ${!isFeedback ? `
          <span class="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold shrink-0 border border-brand-100">
            ${q.points || 1} pto
          </span>
        ` : ''}
      </div>
    `;

    // Question Image if present
    let imageHtml = '';
    if (q.image) {
      imageHtml = `
        <div class="rounded-xl overflow-hidden border border-slate-200 max-h-72 bg-slate-50 flex items-center justify-center">
          <img src="${q.image}" alt="Imagen de pregunta ${qNum}" class="max-h-72 w-auto object-contain">
        </div>
      `;
    }

    // Input body depending on question type
    let bodyHtml = '';

    if (q.type === 'text_multi') {
      const subfields = q.subfields || ['Respuesta 1', 'Respuesta 2', 'Respuesta 3'];
      bodyHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-${Math.min(subfields.length, 3)} gap-3 pt-2">
          ${subfields.map((sf, i) => `
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">${escapeHtml(sf)}</label>
              <input type="text" name="q_${q.id}_${i}" data-qid="${q.id}" data-index="${i}" oninput="updateProgressBar()" placeholder="Escriba aquí..."
                class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all">
            </div>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'grid_radio') {
      const rows = q.rows || [];
      const cols = q.columns || ['SI', 'NO'];
      bodyHtml = `
        <div class="space-y-3 pt-2">
          ${rows.map((row, rIdx) => `
            <div class="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span class="text-xs sm:text-sm font-semibold text-slate-800">${escapeHtml(row.label)}</span>
              <div class="flex items-center gap-2 shrink-0">
                ${cols.map(col => `
                  <label class="relative flex items-center cursor-pointer">
                    <input type="radio" name="grid_${q.id}_${row.id}" value="${col}" onchange="updateProgressBar()" class="sr-only peer">
                    <span class="matrix-radio-label peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-700">
                      ${col}
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'fill_blank') {
      bodyHtml = `
        <div class="flex flex-wrap items-center gap-2 pt-2 text-sm sm:text-base font-semibold text-slate-800">
          <span>${escapeHtml(q.blankPrefix || 'Cada ')}</span>
          <input type="text" name="q_${q.id}" data-qid="${q.id}" oninput="updateProgressBar()" placeholder="..."
            class="w-24 text-center px-3 py-1.5 rounded-xl border-2 border-brand-300 focus:border-brand-600 bg-brand-50/30 text-brand-900 font-bold outline-none transition-all">
          <span>${escapeHtml(q.blankSuffix || ' segundos')}</span>
        </div>
      `;
    } else if (q.type === 'feedback') {
      bodyHtml = `
        <div class="space-y-3 pt-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-500">Valoración:</span>
            <div class="flex gap-1" id="stars-${q.id}">
              ${[1, 2, 3, 4, 5].map(star => `
                <button type="button" onclick="setFeedbackRating('${q.id}', ${star})" class="text-slate-300 hover:text-amber-400 star-btn" data-star="${star}">
                  <i data-lucide="star" class="w-6 h-6 fill-current"></i>
                </button>
              `).join('')}
            </div>
          </div>
          <textarea name="q_${q.id}" data-qid="${q.id}" rows="2.5" placeholder="Escriba su comentario sobre el seminario..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"></textarea>
        </div>
      `;
    } else {
      // Default single text
      bodyHtml = `
        <div class="pt-2">
          <textarea name="q_${q.id}" data-qid="${q.id}" rows="2" oninput="updateProgressBar()" placeholder="Escriba su respuesta detallada..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"></textarea>
        </div>
      `;
    }

    card.innerHTML = headerHtml + imageHtml + bodyHtml;
    container.appendChild(card);
  });

  updateProgressBar();
  lucide.createIcons();
}

// Track interactive star feedback
const feedbackRatings = {};
function setFeedbackRating(qId, rating) {
  feedbackRatings[qId] = rating;
  const container = document.getElementById(`stars-${qId}`);
  if (!container) return;
  const buttons = container.querySelectorAll('.star-btn');
  buttons.forEach((btn, idx) => {
    if (idx < rating) {
      btn.className = 'text-amber-400 star-btn';
    } else {
      btn.className = 'text-slate-300 hover:text-amber-400 star-btn';
    }
  });
}

// Progress Bar updater
function updateProgressBar() {
  if (!currentQuiz || !currentQuiz.questions) return;
  const total = currentQuiz.questions.length;
  let answered = 0;

  currentQuiz.questions.forEach(q => {
    if (q.type === 'grid_radio') {
      const rows = q.rows || [];
      const answeredRows = rows.filter(r => {
        const checked = document.querySelector(`input[name="grid_${q.id}_${r.id}"]:checked`);
        return Boolean(checked);
      });
      if (answeredRows.length === rows.length && rows.length > 0) answered++;
    } else if (q.type === 'text_multi') {
      const inputs = document.querySelectorAll(`input[data-qid="${q.id}"]`);
      const hasSome = Array.from(inputs).some(inp => inp.value.trim().length > 0);
      if (hasSome) answered++;
    } else {
      const el = document.querySelector(`[data-qid="${q.id}"]`);
      if (el && el.value && el.value.trim().length > 0) answered++;
    }
  });

  const percent = Math.round((answered / total) * 100);
  document.getElementById('progress-percent').innerText = `${percent}%`;
  document.getElementById('progress-bar-fill').style.width = `${percent}%`;
  document.getElementById('progress-text').innerText = `${answered} de ${total} preguntas respondidas`;
}

// Handle Form Submission
async function handleExamSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('exam-form');
  const formData = new FormData(form);

  const participantInfo = {
    empresa: formData.get('empresa'),
    fecha: formData.get('fecha'),
    nombre: formData.get('nombre'),
    cedula: formData.get('cedula'),
    cargo: formData.get('cargo'),
    correo: formData.get('correo')
  };

  const answers = {};

  currentQuiz.questions.forEach(q => {
    if (q.type === 'grid_radio') {
      const gridObj = {};
      (q.rows || []).forEach(r => {
        const checked = document.querySelector(`input[name="grid_${q.id}_${r.id}"]:checked`);
        gridObj[r.id] = checked ? checked.value : '';
      });
      answers[q.id] = gridObj;
    } else if (q.type === 'text_multi') {
      const inputs = document.querySelectorAll(`input[data-qid="${q.id}"]`);
      answers[q.id] = Array.from(inputs).map(inp => inp.value.trim());
    } else if (q.type === 'feedback') {
      const txt = document.querySelector(`textarea[data-qid="${q.id}"]`);
      answers[q.id] = (txt ? txt.value : '') + (feedbackRatings[q.id] ? ` (Calificación: ${feedbackRatings[q.id]}/5 estrellas)` : '');
    } else {
      const el = document.querySelector(`[data-qid="${q.id}"]`);
      answers[q.id] = el ? el.value.trim() : '';
    }
  });

  const submitBtn = document.getElementById('submit-btn');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Evaluando...`;

  try {
    const res = await fetch(`/api/quizzes/${currentQuiz.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantInfo, answers })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al procesar examen');

    lastSubmissionResult = data.result;
    displayResultsScreen(data.result);
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

// Display Results Screen
function displayResultsScreen(result) {
  switchView('results-view');

  const circle = document.getElementById('result-score-circle');
  const scoreNum = document.getElementById('result-score-number');
  const scoreMax = document.getElementById('result-score-max');
  const percentTag = document.getElementById('result-percent');
  const headline = document.getElementById('result-headline');
  const submessage = document.getElementById('result-submessage');

  scoreNum.innerText = result.score;
  scoreMax.innerText = `/${result.maxScore}`;
  percentTag.innerText = `${result.percentage}%`;

  document.getElementById('stat-correct').innerText = result.correctCount;
  document.getElementById('stat-incorrect').innerText = result.incorrectCount;
  document.getElementById('stat-percentage').innerText = `${result.percentage}%`;

  const statusBadge = document.getElementById('stat-status-badge');

  if (result.isApproved) {
    circle.className = 'mx-auto w-32 h-32 rounded-full flex flex-col items-center justify-center relative mb-4 shadow-xl border-4 bg-emerald-50 border-emerald-500 text-emerald-700';
    headline.innerText = `¡Felicitaciones ${result.participantName}! Has aprobado.`;
    headline.className = 'text-2xl sm:text-3xl font-extrabold text-emerald-800';
    submessage.innerText = `Has obtenido ${result.score} de ${result.maxScore} puntos requeridos. ¡Excelente desempeño en seguridad industrial!`;
    statusBadge.innerText = 'APROBADO';
    statusBadge.className = 'text-sm font-black text-emerald-700 mt-1';

    // Celebration confetti!
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  } else {
    circle.className = 'mx-auto w-32 h-32 rounded-full flex flex-col items-center justify-center relative mb-4 shadow-xl border-4 bg-rose-50 border-rose-500 text-rose-700';
    headline.innerText = `Evaluación Finalizada: ${result.score} / ${result.maxScore} Puntos`;
    headline.className = 'text-2xl sm:text-3xl font-extrabold text-rose-800';
    submessage.innerText = `El puntaje mínimo para aprobar es de ${result.passingScore} puntos. Le recomendamos revisar el material y las correcciones.`;
    statusBadge.innerText = 'NO APROBADO';
    statusBadge.className = 'text-sm font-black text-rose-700 mt-1';
  }

  // Populate detailed questions review
  renderDetailedReviewList(result.questionResults);
}

// Render Detailed Review list
function renderDetailedReviewList(questionResults) {
  const container = document.getElementById('review-questions-list');
  container.innerHTML = '';

  questionResults.forEach(qr => {
    const card = document.createElement('div');
    const isFeedback = qr.type === 'feedback';
    const isCorrect = qr.isCorrect;

    const borderColor = isFeedback ? 'border-slate-200' : (isCorrect ? 'border-emerald-300 bg-emerald-50/20' : 'border-rose-300 bg-rose-50/20');
    const badge = isFeedback ? '<span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">Opinión</span>' :
      (isCorrect ? '<span class="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Correcto (+'+qr.earnedPoints+' pt)</span>' :
      '<span class="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold flex items-center gap-1"><i data-lucide="x" class="w-3 h-3"></i> Incorrecto (0 pt)</span>');

    card.className = `p-4 sm:p-5 rounded-2xl border ${borderColor} space-y-3 bg-white`;

    let answerStr = '';
    if (typeof qr.userAnswer === 'object' && qr.userAnswer !== null) {
      if (Array.isArray(qr.userAnswer)) {
        answerStr = qr.userAnswer.join(' | ');
      } else {
        answerStr = Object.entries(qr.userAnswer).map(([k, v]) => `${k}: ${v}`).join('; ');
      }
    } else {
      answerStr = String(qr.userAnswer || '(Sin respuesta)');
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <h4 class="text-sm font-bold text-slate-900">
          <span class="text-slate-400 mr-1">#${qr.number}</span> ${escapeHtml(qr.prompt)}
        </h4>
        <div>${badge}</div>
      </div>
      <div class="text-xs space-y-1.5 bg-slate-50 p-3 rounded-xl">
        <p><strong class="text-slate-700">Tu respuesta:</strong> <span class="text-slate-800">${escapeHtml(answerStr)}</span></p>
        ${qr.correctSampleAnswer ? `
          <p class="text-emerald-700"><strong class="text-emerald-800">Respuesta correcta esperada:</strong> ${escapeHtml(qr.correctSampleAnswer).replace(/\n/g, '<br>')}</p>
        ` : ''}
        ${qr.explanation ? `
          <p class="text-slate-500 pt-1 border-t border-slate-200"><strong class="text-slate-600">Explicación técnica:</strong> ${escapeHtml(qr.explanation)}</p>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });

  lucide.createIcons();
}

// Toggle review visibility
function toggleDetailedReview() {
  const section = document.getElementById('detailed-review-section');
  const btnText = document.getElementById('review-toggle-text');
  if (section.classList.contains('hidden')) {
    section.classList.remove('hidden');
    btnText.innerText = 'Ocultar Correcciones';
    section.scrollIntoView({ behavior: 'smooth' });
  } else {
    section.classList.add('hidden');
    btnText.innerText = 'Ver Respuestas y Correcciones';
  }
}

function retakeExam() {
  document.getElementById('exam-form').reset();
  initDateDefault();
  updateProgressBar();
  switchView('quiz-view');
}

// ==========================================
// ADMIN DASHBOARD LOGIC
// ==========================================
function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'text-brand-600', 'border-b-2', 'border-brand-600');
    btn.classList.add('text-slate-500');
  });

  document.getElementById('tab-responses').classList.add('hidden');
  document.getElementById('tab-editor').classList.add('hidden');
  document.getElementById('tab-qr').classList.add('hidden');

  document.getElementById(tabId).classList.remove('hidden');

  const activeBtn = document.getElementById(tabId.replace('tab-', 'tab-btn-'));
  if (activeBtn) {
    activeBtn.classList.add('active', 'text-brand-600', 'border-b-2', 'border-brand-600');
    activeBtn.classList.remove('text-slate-500');
  }

  setTimeout(() => lucide.createIcons(), 50);
}

// Load responses from server
async function loadAdminResponses() {
  if (!currentQuiz) return;
  try {
    const res = await fetch(`/api/quizzes/${currentQuiz.id}/responses`);
    currentResponses = await res.json();
    renderResponsesTable(currentResponses);
    updateAdminStats(currentResponses);
  } catch (err) {
    console.error('Error loading responses:', err);
  }
}

// Update Admin Stats Cards
function updateAdminStats(responses) {
  const total = responses.length;
  document.getElementById('admin-total-responses-count').innerText = total;
  document.getElementById('stat-admin-total').innerText = total;

  if (total === 0) {
    document.getElementById('stat-admin-avg').innerText = '0.0';
    document.getElementById('stat-admin-passed').innerText = '0';
    document.getElementById('stat-admin-failed').innerText = '0';
    document.getElementById('stat-admin-rate').innerText = '0% de aprobación';
    return;
  }

  const passed = responses.filter(r => r.isApproved).length;
  const failed = total - passed;
  const sumScores = responses.reduce((acc, r) => acc + (r.score || 0), 0);
  const avg = (sumScores / total).toFixed(1);
  const rate = Math.round((passed / total) * 100);

  document.getElementById('stat-admin-avg').innerText = `${avg} / 10`;
  document.getElementById('stat-admin-passed').innerText = passed;
  document.getElementById('stat-admin-failed').innerText = failed;
  document.getElementById('stat-admin-rate').innerText = `${rate}% de aprobación`;
}

// Render Responses Table
function renderResponsesTable(list) {
  const tbody = document.getElementById('admin-responses-tbody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400">
          No hay evaluaciones registradas aún.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';

    const p = r.participantInfo || {};
    const dateFormatted = new Date(r.submittedAt).toLocaleDateString('es-EC', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const statusBadge = r.isApproved
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">APROBADO</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">REPROBADO</span>';

    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-900">${escapeHtml(p.nombre || 'Anónimo')}</td>
      <td class="py-3 px-4 text-slate-600">${escapeHtml(p.empresa || '-')} <br><span class="text-[10px] text-slate-400">${escapeHtml(p.cargo || '-')}</span></td>
      <td class="py-3 px-4 text-slate-600">${escapeHtml(p.cedula || '-')}</td>
      <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${dateFormatted}</td>
      <td class="py-3 px-4">
        <span class="text-sm font-black ${r.isApproved ? 'text-emerald-700' : 'text-rose-700'}">${r.score}</span>
        <span class="text-slate-400 text-xs">/${r.maxScore}</span>
      </td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4 text-right">
        <button onclick="viewSubmissionDetail('${r.id}')" class="px-3 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-bold text-xs">
          Ver Examen
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// Filter Responses Table
function filterResponsesTable() {
  const query = document.getElementById('admin-search-input').value.toLowerCase();
  const statusFilter = document.getElementById('admin-filter-status').value;

  const filtered = currentResponses.filter(r => {
    const p = r.participantInfo || {};
    const textMatch = (p.nombre || '').toLowerCase().includes(query) ||
                      (p.empresa || '').toLowerCase().includes(query) ||
                      (p.cedula || '').toLowerCase().includes(query);

    let statusMatch = true;
    if (statusFilter === 'passed') statusMatch = r.isApproved;
    if (statusFilter === 'failed') statusMatch = !r.isApproved;

    return textMatch && statusMatch;
  });

  renderResponsesTable(filtered);
}

// View Submission Detail Modal
function viewSubmissionDetail(submissionId) {
  const sub = currentResponses.find(r => r.id === submissionId);
  if (!sub) return;

  const p = sub.participantInfo || {};
  document.getElementById('modal-sub-participant').innerText = p.nombre || 'Participante';
  document.getElementById('modal-sub-meta').innerText = `${p.empresa || ''} - ${p.cargo || ''} (C.I: ${p.cedula || ''}) | Nota: ${sub.score}/${sub.maxScore} (${sub.percentage}%)`;

  const content = document.getElementById('modal-sub-content');
  content.innerHTML = '';

  (sub.questionResults || []).forEach(qr => {
    const card = document.createElement('div');
    const isCorrect = qr.isCorrect;
    card.className = `p-4 rounded-xl border ${isCorrect ? 'border-emerald-200 bg-emerald-50/10' : 'border-rose-200 bg-rose-50/10'} text-xs space-y-2`;

    let answerStr = '';
    if (typeof qr.userAnswer === 'object' && qr.userAnswer !== null) {
      if (Array.isArray(qr.userAnswer)) {
        answerStr = qr.userAnswer.join(' | ');
      } else {
        answerStr = Object.entries(qr.userAnswer).map(([k, v]) => `${k}: ${v}`).join('; ');
      }
    } else {
      answerStr = String(qr.userAnswer || '(Sin respuesta)');
    }

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-800">Pregunta ${qr.number}: ${escapeHtml(qr.prompt)}</span>
        <span class="font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-600'}">${qr.earnedPoints} / ${qr.maxPoints} pts</span>
      </div>
      <p class="text-slate-700"><strong>Respuesta enviada:</strong> ${escapeHtml(answerStr)}</p>
      ${qr.reviewDetails ? `<p class="text-slate-500 italic">${escapeHtml(qr.reviewDetails)}</p>` : ''}
    `;
    content.appendChild(card);
  });

  const modal = document.getElementById('submission-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeSubmissionModal() {
  const modal = document.getElementById('submission-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ==========================================
// QUESTION & ANSWER EDITOR (ADMIN)
// ==========================================
function populateAdminEditor() {
  if (!currentQuiz) return;
  document.getElementById('editor-quiz-title').value = currentQuiz.title || '';
  document.getElementById('editor-quiz-org').value = currentQuiz.organization || '';
  document.getElementById('editor-quiz-subtitle').value = currentQuiz.subtitle || '';
  document.getElementById('editor-quiz-pass').value = currentQuiz.passingScore || 7;

  const bannerInput = document.getElementById('editor-quiz-banner');
  const previewBox = document.getElementById('editor-banner-preview');
  const previewImg = document.getElementById('editor-banner-preview-img');
  if (bannerInput) bannerInput.value = currentQuiz.bannerImage || '';
  if (previewBox && previewImg) {
    if (currentQuiz.bannerImage && currentQuiz.bannerImage.trim() !== '') {
      previewImg.src = currentQuiz.bannerImage;
      previewBox.classList.remove('hidden');
    } else {
      previewBox.classList.add('hidden');
    }
  }

  renderEditorQuestionsList();
}

function renderEditorQuestionsList() {
  const list = document.getElementById('editor-questions-list');
  list.innerHTML = '';

  if (!currentQuiz || !currentQuiz.questions) return;

  currentQuiz.questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4';
    card.id = `editor-card-${idx}`;

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 font-black text-xs flex items-center justify-center">
            ${idx + 1}
          </span>
          <span class="text-xs font-bold text-slate-700">Pregunta #${idx + 1}</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="deleteEditorQuestion(${idx})" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1 font-semibold" title="Eliminar pregunta">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span class="hidden sm:inline">Eliminar</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div class="sm:col-span-3">
          <label class="block text-xs font-bold text-slate-600 mb-1">Enunciado de la Pregunta</label>
          <input type="text" value="${escapeHtml(q.prompt)}" onchange="updateQuestionField(${idx}, 'prompt', this.value)"
            class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">Puntos</label>
          <input type="number" min="0" max="50" value="${q.points || 1}" onchange="updateQuestionField(${idx}, 'points', Number(this.value))"
            class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">Tipo de Pregunta</label>
          <select onchange="updateQuestionField(${idx}, 'type', this.value); renderEditorQuestionsList();"
            class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white">
            <option value="text_single" ${q.type === 'text_single' ? 'selected' : ''}>Texto Abierto Simple</option>
            <option value="text_multi" ${q.type === 'text_multi' ? 'selected' : ''}>Multicampo (3 o 4 elementos)</option>
            <option value="grid_radio" ${q.type === 'grid_radio' ? 'selected' : ''}>Matriz SI / NO</option>
            <option value="fill_blank" ${q.type === 'fill_blank' ? 'selected' : ''}>Llenar Espacio en Blanco</option>
            <option value="feedback" ${q.type === 'feedback' ? 'selected' : ''}>Comentario / Opinión (0 pts)</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1">Imagen de la Pregunta (Opcional)</label>
          <div class="flex items-center gap-2">
            <input type="text" placeholder="URL o subir imagen ->" value="${q.image || ''}" onchange="updateQuestionField(${idx}, 'image', this.value)"
              id="img-input-${idx}" class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono">
            <label class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1">
              <i data-lucide="image-plus" class="w-3.5 h-3.5"></i>
              Subir
              <input type="file" accept="image/*" class="hidden" onchange="uploadQuestionImage(${idx}, event)">
            </label>
          </div>
          ${q.image ? `<div class="mt-2"><img src="${q.image}" class="h-16 rounded border object-cover"></div>` : ''}
        </div>
      </div>

      <!-- Verification details based on type -->
      <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
        <span class="text-xs font-bold text-brand-700 uppercase tracking-wider block">Verificación de Respuestas Correctas:</span>
        
        ${q.type === 'grid_radio' ? `
          <div class="space-y-2">
            ${(q.rows || []).map((row, rIdx) => `
              <div class="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
                <input type="text" value="${escapeHtml(row.label)}" onchange="updateGridRowLabel(${idx}, ${rIdx}, this.value)" class="flex-1 mr-3 border-b border-transparent hover:border-slate-300 px-1 font-semibold">
                <select onchange="updateGridRowCorrect(${idx}, ${rIdx}, this.value)" class="text-xs font-bold px-2 py-1 border rounded bg-slate-50">
                  <option value="SI" ${row.correct === 'SI' ? 'selected' : ''}>Correcto: SI</option>
                  <option value="NO" ${row.correct === 'NO' ? 'selected' : ''}>Correcto: NO</option>
                </select>
              </div>
            `).join('')}
          </div>
        ` : q.type === 'fill_blank' ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Respuesta Esperada Exacta:</label>
              <input type="text" value="${escapeHtml(q.correctAnswerText || '')}" onchange="updateQuestionField(${idx}, 'correctAnswerText', this.value)"
                class="w-full px-2.5 py-1.5 border rounded-lg bg-white font-bold text-slate-800">
            </div>
          </div>
        ` : `
          <div>
            <label class="block font-semibold text-slate-600 mb-1 text-xs">Respuesta Guía / Palabras Clave Aceptadas:</label>
            <textarea rows="2" onchange="updateQuestionField(${idx}, 'correctSampleAnswer', this.value)"
              placeholder="Ej: a) Salidas de emergencia, b) Extintores..."
              class="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs">${escapeHtml(q.correctSampleAnswer || '')}</textarea>
          </div>
        `}

        <div>
          <label class="block font-semibold text-slate-600 mb-1 text-xs">Explicación Técnica (se muestra en la revisión al participante):</label>
          <input type="text" value="${escapeHtml(q.explanation || '')}" onchange="updateQuestionField(${idx}, 'explanation', this.value)"
            class="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs text-slate-600">
        </div>
      </div>
    `;

    list.appendChild(card);
  });

  lucide.createIcons();
}

function updateQuestionField(index, field, value) {
  if (currentQuiz && currentQuiz.questions[index]) {
    currentQuiz.questions[index][field] = value;
  }
}

function updateGridRowLabel(qIndex, rIndex, label) {
  if (currentQuiz && currentQuiz.questions[qIndex]?.rows[rIndex]) {
    currentQuiz.questions[qIndex].rows[rIndex].label = label;
  }
}

function updateGridRowCorrect(qIndex, rIndex, val) {
  if (currentQuiz && currentQuiz.questions[qIndex]?.rows[rIndex]) {
    currentQuiz.questions[qIndex].rows[rIndex].correct = val;
  }
}

function deleteEditorQuestion(index) {
  if (confirm('¿Está seguro de eliminar esta pregunta?')) {
    currentQuiz.questions.splice(index, 1);
    renderEditorQuestionsList();
  }
}

function addNewBlankQuestion() {
  if (!currentQuiz) return;
  const newQ = {
    id: 'q_' + Date.now(),
    number: (currentQuiz.questions.length || 0) + 1,
    prompt: 'Nueva pregunta...',
    type: 'text_single',
    points: 1,
    image: '',
    correctSampleAnswer: '',
    explanation: ''
  };
  currentQuiz.questions.push(newQ);
  renderEditorQuestionsList();
  
  // Scroll to new question
  const lastCard = document.getElementById(`editor-card-${currentQuiz.questions.length - 1}`);
  if (lastCard) lastCard.scrollIntoView({ behavior: 'smooth' });
}

// Upload image for a question
async function uploadQuestionImage(qIndex, event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      currentQuiz.questions[qIndex].image = data.url;
      renderEditorQuestionsList();
    } else {
      alert('Error subiendo imagen: ' + data.error);
    }
  } catch (err) {
    alert('Error al conectar con el servidor para subir la imagen.');
  }
}

// Save entire Quiz to backend
async function saveEntireQuiz() {
  if (!currentQuiz) return;

  // Sync general settings
  currentQuiz.title = document.getElementById('editor-quiz-title').value;
  currentQuiz.organization = document.getElementById('editor-quiz-org').value;
  currentQuiz.subtitle = document.getElementById('editor-quiz-subtitle').value;
  currentQuiz.passingScore = Number(document.getElementById('editor-quiz-pass').value) || 7;
  const bannerInput = document.getElementById('editor-quiz-banner');
  if (bannerInput) currentQuiz.bannerImage = bannerInput.value.trim();

  try {
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentQuiz)
    });

    const data = await res.json();
    if (data.success) {
      currentQuiz = data.quiz;
      renderQuizHeader();
      renderQuestions();
      alert('¡Cuestionario guardado exitosamente!');
    } else {
      alert('Error guardando cuestionario.');
    }
  } catch (err) {
    alert('Error de conexión al guardar cuestionario: ' + err.message);
  }
}

// ==========================================
// PDF UPLOADER LOGIC
// ==========================================
function openPdfModal() {
  const modal = document.getElementById('pdf-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePdfModal() {
  const modal = document.getElementById('pdf-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

const dropZone = document.getElementById('pdf-drop-zone');
if (dropZone) {
  dropZone.addEventListener('click', () => {
    document.getElementById('pdf-file-input').click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-brand-500', 'bg-brand-50/40');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-brand-500', 'bg-brand-50/40');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-brand-500', 'bg-brand-50/40');
    if (e.dataTransfer.files.length) {
      handlePdfFile(e.dataTransfer.files[0]);
    }
  });
}

function handlePdfSelected(e) {
  if (e.target.files.length) {
    handlePdfFile(e.target.files[0]);
  }
}

function handlePdfFile(file) {
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    alert('Por favor seleccione un archivo en formato PDF.');
    return;
  }
  selectedPdfFile = file;
  const nameLabel = document.getElementById('pdf-selected-name');
  nameLabel.innerText = `Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  nameLabel.classList.remove('hidden');

  document.getElementById('pdf-process-btn').disabled = false;
}

async function processPdfUpload() {
  if (!selectedPdfFile) return;

  const btn = document.getElementById('pdf-process-btn');
  const indicator = document.getElementById('pdf-loading-indicator');

  btn.disabled = true;
  indicator.classList.remove('hidden');

  const formData = new FormData();
  formData.append('pdf', selectedPdfFile);

  try {
    const res = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success && data.parsedData) {
      const parsed = data.parsedData;
      
      // Update current quiz with parsed content
      currentQuiz.title = parsed.title || currentQuiz.title;
      currentQuiz.subtitle = parsed.subtitle || currentQuiz.subtitle;
      if (parsed.questions && parsed.questions.length > 0) {
        currentQuiz.questions = parsed.questions;
      }

      // Re-populate editor and quiz
      populateAdminEditor();
      renderQuizHeader();
      renderQuestions();

      closePdfModal();
      switchAdminTab('tab-editor');
      alert(`¡PDF procesado exitosamente! Se extrajeron ${parsed.questions.length} preguntas listas para editar o responder.`);
    } else {
      alert('No se pudieron extraer preguntas del PDF: ' + (data.error || 'Formato desconocido'));
    }
  } catch (err) {
    alert('Error al procesar el archivo PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    indicator.classList.add('hidden');
  }
}

// Copy Mobile Link
function copyShareLink() {
  const linkInp = document.getElementById('mobile-share-link');
  linkInp.select();
  navigator.clipboard.writeText(linkInp.value);
  const copyText = document.getElementById('copy-btn-text');
  copyText.innerText = '¡Copiado!';
  setTimeout(() => copyText.innerText = 'Copiar', 2000);
}

// Helper: Escape HTML to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
