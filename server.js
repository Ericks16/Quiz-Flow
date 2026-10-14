const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const qrcode = require('qrcode');
const os = require('os');
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not loaded directly:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories (with Vercel serverless /tmp support)
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
if (isVercel) {
  app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
  app.use('/uploads', express.static(UPLOADS_DIR));
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// JSON helper storage
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');

function readJsonFile(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Seed initial default quiz from the user's exam
function initSeedData() {
  if (isVercel) {
    const defaultQuizzesFile = path.join(__dirname, 'data', 'quizzes.json');
    const defaultResponsesFile = path.join(__dirname, 'data', 'responses.json');
    try {
      if (!fs.existsSync(QUIZZES_FILE) && fs.existsSync(defaultQuizzesFile)) {
        fs.copyFileSync(defaultQuizzesFile, QUIZZES_FILE);
      }
      if (!fs.existsSync(RESPONSES_FILE) && fs.existsSync(defaultResponsesFile)) {
        fs.copyFileSync(defaultResponsesFile, RESPONSES_FILE);
      }
    } catch (e) {
      console.warn('Vercel seed copy warning:', e.message);
    }
  }

  const quizzes = readJsonFile(QUIZZES_FILE, []);
  if (quizzes.length === 0) {
    const defaultQuiz = {
      id: 'seguridad-incendios-rtm',
      title: 'EXAMEN DE SEGURIDAD CONTRA INCENDIOS',
      subtitle: 'Evaluación de Capacitación Técnica y Prevención',
      organization: 'RTM INTERNACIONAL',
      bannerImage: '/uploads/portada_seguridad_incendios.jpg',
      totalPoints: 10,
      passingScore: 7, // 7 sobre 10
      headerFields: [
        { id: 'empresa', label: 'Empresa', type: 'text', required: true },
        { id: 'fecha', label: 'Fecha', type: 'date', required: true },
        { id: 'nombre', label: 'Apellido y Nombre', type: 'text', required: true },
        { id: 'cedula', label: 'Número de Identidad / Cédula', type: 'text', required: true },
        { id: 'cargo', label: 'Cargo', type: 'text', required: true },
        { id: 'correo', label: 'Correo Electrónico', type: 'email', required: true }
      ],
      questions: [
        {
          id: 'q1',
          number: 1,
          prompt: 'Indique 3 factores de seguridad que debe observar para prevención de incendio',
          type: 'text_multi',
          points: 1,
          image: '',
          subfields: ['Factor 1', 'Factor 2', 'Factor 3'],
          correctKeywords: ['salida', 'emergencia', 'extintor', 'ph', 'gci', 'combustible', 'concentracion', 'senalizacion', 'orden', 'limpieza'],
          correctSampleAnswer: 'a) Salidas de emergencia\nb) Ubicación de extintores / PH / GCI\nc) Mayor concentración de combustible',
          explanation: 'Se debe identificar salidas de emergencia despejadas, ubicación de extintores y control de acumulación de materiales combustibles.'
        },
        {
          id: 'q2',
          number: 2,
          prompt: '¿Qué elementos se necesita para formar el triángulo del fuego?',
          type: 'text_multi',
          points: 1,
          image: '',
          subfields: ['Elemento 1', 'Elemento 2', 'Elemento 3'],
          correctKeywords: ['oxigeno', 'oxígeno', 'combustible', 'calor'],
          correctSampleAnswer: '1- Oxígeno, 2- Combustible, 3- Calor',
          explanation: 'El triángulo del fuego está formado por tres componentes fundamentales: Oxígeno, Combustible y Calor.'
        },
        {
          id: 'q3',
          number: 3,
          prompt: 'Enumere 3 fuentes (causas) de calor',
          type: 'text_multi',
          points: 1,
          image: '',
          subfields: ['Fuente 1', 'Fuente 2', 'Fuente 3'],
          correctKeywords: ['electrica', 'eléctrica', 'mecanica', 'mecánica', 'quimica', 'química', 'friccion', 'fricción', 'chispas', 'llama'],
          correctSampleAnswer: '1- Eléctricas, 2- Mecánicas, 3- Químicas',
          explanation: 'Las principales fuentes de calor son eléctricas (cortocircuitos, sobrecargas), mecánicas (fricción) y químicas (reacciones exotérmicas).'
        },
        {
          id: 'q4',
          number: 4,
          prompt: '¿Puedo usar agua para combatir fuegos de causas eléctricas? Justifique su respuesta.',
          type: 'text_single',
          points: 1,
          image: '',
          correctAnswerText: 'No',
          correctKeywords: ['no', 'conductor', 'conduce', 'electricidad', 'electrocuci', 'choque'],
          correctSampleAnswer: 'No, porque el agua es conductor de electricidad y causa electrocución.',
          explanation: 'NUNCA se debe usar agua en equipos energizados porque el agua conduce la corriente y provocaría electrocución.'
        },
        {
          id: 'q5',
          number: 5,
          prompt: 'Describa las tres clases de combustibles, indique 2 ejemplos de cada uno:',
          type: 'text_multi',
          points: 1,
          image: '',
          subfields: ['Clase A (Sólidos + 2 ej.)', 'Clase B (Líquidos/Gases + 2 ej.)', 'Clase C (Eléctricos + 2 ej.)'],
          correctKeywords: ['solido', 'sólido', 'madera', 'papel', 'carton', 'cartón', 'liquido', 'líquido', 'gas', 'gasolina', 'tiner', 'thinner', 'electrico', 'eléctrico', 'computador', 'plancha'],
          correctSampleAnswer: 'a) A Sólidos: Madera, papel, cartón.\nb) B Líquidos y gases inflamables: Tiner, gasolina.\nc) C Eléctricos: Computadores, plancha.',
          explanation: 'Clase A: Sólidos combustibles ordinarios. Clase B: Líquidos y gases inflamables. Clase C: Equipos eléctricos energizados.'
        },
        {
          id: 'q6',
          number: 6,
          prompt: 'Indique las 4 reglas de un Plan de Emergencia General',
          type: 'text_multi',
          points: 1,
          image: '',
          subfields: ['Regla 1', 'Regla 2', 'Regla 3', 'Regla 4'],
          correctKeywords: ['calma', 'alarma', '911', 'bomberos', 'extintor', 'extintores', 'evacuar', 'evacuacion'],
          correctSampleAnswer: '1) Mantener la calma y dar la voz de alarma\n2) Llamar al 911\n3) Usar extintores\n4) Evacuar ordenadamente',
          explanation: 'Las 4 fases inmediatas: Calma/Alarma, Llamada de socorro (911), Mitigación inicial si es seguro, y Evacuación al punto de encuentro.'
        },
        {
          id: 'q7',
          number: 7,
          prompt: '¿En qué tiempo se reproduce el fuego en temperatura, volumen e intensidad?',
          type: 'fill_blank',
          points: 1,
          image: '',
          blankPrefix: 'Cada ',
          blankSuffix: ' segundos',
          correctAnswerText: '2',
          alternativeAnswers: ['2', '2s', 'dos', 'dos segundos'],
          explanation: 'El fuego en condiciones adecuadas duplica su temperatura e intensidad aproximadamente cada 2 segundos.'
        },
        {
          id: 'q8',
          number: 8,
          prompt: 'Los extintores en POLVO QUÍMICO SECO: (Seleccione SI o NO para cada afirmación)',
          type: 'grid_radio',
          points: 1,
          image: '',
          columns: ['SI', 'NO'],
          rows: [
            { id: 'manometro', label: 'Tienen manómetro', correct: 'SI' },
            { id: 'corneta', label: 'Tiene corneta', correct: 'NO' },
            { id: 'clase_abc', label: 'Es para fuegos clase ABC', correct: 'SI' },
            { id: 'elimina_brasa', label: 'Elimina la brasa', correct: 'SI' }
          ],
          explanation: 'Los extintores de polvo químico seco tienen manómetro indicador de presión, manguera con boquilla (no corneta), son polivalentes ABC y sofocan la brasa.'
        },
        {
          id: 'q9',
          number: 9,
          prompt: 'Extintor de CO2 (Dióxido de Carbono): (Seleccione SI o NO para cada afirmación)',
          type: 'grid_radio',
          points: 1,
          image: '',
          columns: ['SI', 'NO'],
          rows: [
            { id: 'corneta', label: 'Tiene corneta difusora', correct: 'SI' },
            { id: 'dana_equipos', label: 'Daña equipos electrónicos', correct: 'NO' },
            { id: 'clase_bc', label: 'Es para fuegos clase BC', correct: 'SI' }
          ],
          explanation: 'El extintor de CO2 tiene una corneta difusora para evitar congelamiento de la piel, NO daña equipos electrónicos (es gas limpio) y es idóneo para fuegos B y C.'
        },
        {
          id: 'q10',
          number: 10,
          prompt: '¿Qué significan las siglas "HAPA" de operación de extintor?',
          type: 'text_multi',
          points: 1,
          image: '',
          subfields: ['H', 'A', 'P', 'A'],
          correctKeywords: ['halar', 'apuntar', 'presionar', 'abanicar'],
          correctSampleAnswer: 'H: Halar (el pasador o seguro)\nA: Apuntar (a la base del fuego)\nP: Presionar (la palanca o percutor)\nA: Abanicar (de lado a lado)',
          explanation: 'HAPA: Halar el seguro, Apuntar a la base de la llama, Presionar el percutor, Abanicar en abanico horizontal.'
        },
        {
          id: 'q11',
          number: 11,
          prompt: '¿Cómo calificaría el presente seminario y capacitación? (Haga un breve comentario)',
          type: 'feedback',
          points: 0,
          image: '',
          ratingScale: 5,
          explanation: 'Sección de retroalimentación de los participantes para mejora continua.'
        }
      ],
      createdAt: new Date().toISOString()
    };
    quizzes.push(defaultQuiz);
    writeJsonFile(QUIZZES_FILE, quizzes);
  }
}

initSeedData();

// Helper to get local IP address for mobile testing
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ---------------- API ROUTES ----------------

// Get system info and mobile URL
app.get('/api/info', async (req, res) => {
  const ip = getLocalIp();
  const mobileUrl = `http://${ip}:${PORT}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await qrcode.toDataURL(mobileUrl);
  } catch (e) {
    console.error('QR code error:', e);
  }
  res.json({ ip, port: PORT, mobileUrl, qrCodeDataUrl });
});

// List all quizzes
app.get('/api/quizzes', (req, res) => {
  const quizzes = readJsonFile(QUIZZES_FILE, []);
  // Return summary
  const summary = quizzes.map(q => ({
    id: q.id,
    title: q.title,
    subtitle: q.subtitle,
    organization: q.organization,
    totalPoints: q.totalPoints || q.questions?.filter(x => x.type !== 'feedback').length || 10,
    questionsCount: q.questions?.length || 0,
    createdAt: q.createdAt
  }));
  res.json(summary);
});

// Get single quiz
app.get('/api/quizzes/:id', (req, res) => {
  const quizzes = readJsonFile(QUIZZES_FILE, []);
  const quiz = quizzes.find(q => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Formulario no encontrado' });
  res.json(quiz);
});

// Create or update quiz
app.post('/api/quizzes', (req, res) => {
  const quizzes = readJsonFile(QUIZZES_FILE, []);
  const newQuiz = req.body;
  if (!newQuiz.id) {
    newQuiz.id = 'quiz-' + Date.now();
  }
  newQuiz.createdAt = newQuiz.createdAt || new Date().toISOString();

  // Recalculate total points
  let calculatedPoints = 0;
  if (Array.isArray(newQuiz.questions)) {
    newQuiz.questions.forEach((q, idx) => {
      q.number = idx + 1;
      calculatedPoints += Number(q.points) || 0;
    });
  }
  newQuiz.totalPoints = calculatedPoints;

  const existingIndex = quizzes.findIndex(q => q.id === newQuiz.id);
  if (existingIndex >= 0) {
    quizzes[existingIndex] = newQuiz;
  } else {
    quizzes.push(newQuiz);
  }

  writeJsonFile(QUIZZES_FILE, quizzes);
  res.json({ success: true, quiz: newQuiz });
});

// Delete quiz
app.delete('/api/quizzes/:id', (req, res) => {
  let quizzes = readJsonFile(QUIZZES_FILE, []);
  quizzes = quizzes.filter(q => q.id !== req.params.id);
  writeJsonFile(QUIZZES_FILE, quizzes);
  res.json({ success: true });
});

// Upload image (for question or banner)
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: imageUrl, filename: req.file.filename });
});

// Upload and Parse PDF into Questions
app.post('/api/parse-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se ha subido ningún archivo PDF' });
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    let extractedText = '';

    if (pdfParse) {
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text || '';
    } else {
      extractedText = dataBuffer.toString('utf8');
    }

    // Process extracted text and parse questions
    const parsedData = parsePdfContentToQuestions(extractedText, req.file.originalname);
    res.json({ success: true, parsedData });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    res.status(500).json({ error: 'Error procesando el PDF: ' + error.message });
  }
});

// Intelligent parser for exam questions from PDF text
function parsePdfContentToQuestions(text, originalFilename) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let title = originalFilename.replace(/\.pdf$/i, '').toUpperCase();
  let subtitle = 'Formulario importado desde PDF';
  let organization = 'Evaluación';

  // Check lines for common title clues
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    if (line.includes('EXAMEN') || line.includes('EVALUACI') || line.includes('CUESTIONARIO') || line.includes('SEGURIDAD')) {
      title = line;
      break;
    }
  }

  const questions = [];
  let currentQuestion = null;
  const questionRegex = /^(\d+)[\.\-\)]\s*(.*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(questionRegex);

    if (match) {
      if (currentQuestion) {
        questions.push(finalizeQuestion(currentQuestion));
      }

      const qNum = parseInt(match[1], 10);
      let promptText = match[2].trim();
      let points = 1;

      // Extract points like (1 Punto)
      const pointsMatch = promptText.match(/\((\d+)\s*(?:punto|ptos|pts)?\)/i);
      if (pointsMatch) {
        points = parseInt(pointsMatch[1], 10);
        promptText = promptText.replace(pointsMatch[0], '').trim();
      }

      currentQuestion = {
        number: qNum,
        rawPrompt: promptText,
        lines: [],
        points: points
      };
    } else if (currentQuestion) {
      currentQuestion.lines.push(line);
    }
  }

  if (currentQuestion) {
    questions.push(finalizeQuestion(currentQuestion));
  }

  // If questions are empty, provide fallback
  if (questions.length === 0) {
    questions.push({
      id: 'q1',
      number: 1,
      prompt: 'Pregunta 1 extraída del documento',
      type: 'text_single',
      points: 1,
      correctKeywords: [],
      explanation: ''
    });
  }

  return {
    title,
    subtitle,
    organization,
    questions
  };
}

function finalizeQuestion(q) {
  let prompt = q.rawPrompt;
  const extraLines = q.lines;
  let type = 'text_single';
  let correctKeywords = [];
  let subfields = [];
  let rows = [];
  let columns = ['SI', 'NO'];

  const combined = (prompt + ' ' + extraLines.join(' ')).toLowerCase();

  // Detect grid / matrix (SI / NO)
  if (combined.includes('si') && combined.includes('no') && (combined.includes('seleccione') || combined.includes('marque'))) {
    type = 'grid_radio';
    // extract items from lines
    const potentialItems = extraLines.filter(l =>
      !l.toLowerCase().includes('escriba su respuesta') &&
      !l.toLowerCase().includes('microsoft forms') &&
      l.length > 2
    );
    rows = potentialItems.map((item, idx) => ({
      id: `row_${idx + 1}`,
      label: item,
      correct: 'SI'
    }));
    if (rows.length === 0) {
      rows = [
        { id: 'row_1', label: 'Opción 1', correct: 'SI' },
        { id: 'row_2', label: 'Opción 2', correct: 'NO' }
      ];
    }
  } else if (combined.includes('indique 3') || combined.includes('enumere 3') || combined.includes('3 factores') || combined.includes('4 reglas') || combined.includes('hapa')) {
    type = 'text_multi';
    const countMatch = combined.match(/(\d+)/);
    const count = countMatch ? parseInt(countMatch[1], 10) : 3;
    const effectiveCount = Math.min(Math.max(count, 2), 5);
    for (let k = 1; k <= effectiveCount; k++) {
      subfields.push(`Elemento ${k}`);
    }
  } else if (combined.includes('calificar') || combined.includes('comentario') || combined.includes('seminario')) {
    type = 'feedback';
    q.points = 0;
  } else if (combined.includes('segundos') || combined.includes('cada _____')) {
    type = 'fill_blank';
  }

  return {
    id: 'q_' + q.number + '_' + Date.now(),
    number: q.number,
    prompt: prompt || extraLines[0] || 'Pregunta ' + q.number,
    type,
    points: q.points || 1,
    image: '',
    subfields: subfields.length > 0 ? subfields : undefined,
    rows: rows.length > 0 ? rows : undefined,
    columns: rows.length > 0 ? columns : undefined,
    correctKeywords: correctKeywords,
    correctAnswerText: '',
    explanation: ''
  };
}

// ---------------- SUBMIT EXAM & VERIFY ANSWERS ----------------
app.post('/api/quizzes/:id/submit', (req, res) => {
  const quizzes = readJsonFile(QUIZZES_FILE, []);
  const quiz = quizzes.find(q => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });

  const { participantInfo, answers } = req.body;
  if (!participantInfo || !participantInfo.nombre) {
    return res.status(400).json({ error: 'Debe ingresar sus datos personales' });
  }

  let totalScore = 0;
  let maxPossibleScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const questionResults = [];

  quiz.questions.forEach(q => {
    const isFeedback = q.type === 'feedback';
    const qPoints = isFeedback ? 0 : (Number(q.points) || 1);
    if (!isFeedback) {
      maxPossibleScore += qPoints;
    }

    const userAnswer = answers ? answers[q.id] : null;
    let earnedPoints = 0;
    let isCorrect = false;
    let reviewDetails = '';

    if (isFeedback) {
      isCorrect = true;
      reviewDetails = 'Comentario registrado. No aplica puntuación.';
    } else if (q.type === 'grid_radio') {
      // Expecting { row_id: 'SI' | 'NO', ... }
      if (userAnswer && typeof userAnswer === 'object') {
        const totalRows = q.rows.length;
        let correctRows = 0;
        const subChecks = [];

        q.rows.forEach(r => {
          const uVal = (userAnswer[r.id] || '').trim().toUpperCase();
          const cVal = (r.correct || '').trim().toUpperCase();
          const match = uVal === cVal && uVal !== '';
          if (match) correctRows++;
          subChecks.push(`${r.label}: ${uVal || '(sin marcar)'} ${match ? '✔' : '❌ (Correcto: ' + cVal + ')'}`);
        });

        // Proportional score
        const frac = totalRows > 0 ? correctRows / totalRows : 0;
        earnedPoints = Math.round((frac * qPoints) * 100) / 100;
        isCorrect = correctRows === totalRows;
        reviewDetails = subChecks.join(' | ');
      } else {
        isCorrect = false;
        reviewDetails = 'Sin responder';
      }
    } else if (q.type === 'fill_blank') {
      const uStr = (userAnswer || '').toString().trim().toLowerCase();
      const cStr = (q.correctAnswerText || '').trim().toLowerCase();
      const alt = (q.alternativeAnswers || []).map(a => a.toLowerCase().trim());
      if (uStr && (uStr === cStr || alt.includes(uStr) || uStr.includes(cStr))) {
        earnedPoints = qPoints;
        isCorrect = true;
        reviewDetails = `Respuesta correcta: ${userAnswer}`;
      } else {
        reviewDetails = `Respuesta dada: "${userAnswer || '(vacío)'}". Respuesta correcta esperada: "${q.correctAnswerText}"`;
      }
    } else if (q.type === 'text_single') {
      const uStr = (userAnswer || '').toString().trim().toLowerCase();
      if (!uStr) {
        reviewDetails = 'Sin responder';
      } else {
        const keywords = (q.correctKeywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
        if (keywords.length > 0) {
          // Check how many keywords appear
          const found = keywords.filter(k => uStr.includes(k));
          const matchRatio = found.length / Math.min(keywords.length, 3);
          if (matchRatio >= 0.5) {
            earnedPoints = qPoints;
            isCorrect = true;
            reviewDetails = `Acierto: incluye conceptos clave (${found.join(', ')})`;
          } else {
            // Partial or review needed
            earnedPoints = found.length > 0 ? Math.round((qPoints * 0.5) * 100) / 100 : 0;
            isCorrect = earnedPoints === qPoints;
            reviewDetails = `Conceptos clave esperados: ${keywords.slice(0, 4).join(', ')}`;
          }
        } else {
          // Default credit for answer or teacher manual check
          earnedPoints = qPoints;
          isCorrect = true;
          reviewDetails = 'Respuesta guardada';
        }
      }
    } else if (q.type === 'text_multi') {
      // Subfields array or multiple items
      if (userAnswer && (Array.isArray(userAnswer) || typeof userAnswer === 'object')) {
        const answersList = Array.isArray(userAnswer) ? userAnswer : Object.values(userAnswer);
        const filled = answersList.map(a => String(a || '').trim()).filter(Boolean);
        const keywords = (q.correctKeywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);

        if (filled.length === 0) {
          reviewDetails = 'Sin responder';
        } else if (keywords.length > 0) {
          const allText = filled.join(' ').toLowerCase();
          const matched = keywords.filter(kw => allText.includes(kw));
          if (matched.length >= 2 || filled.length >= (q.subfields?.length || 3)) {
            earnedPoints = qPoints;
            isCorrect = true;
            reviewDetails = `Acierto: ${filled.length} respuestas válidas registradas.`;
          } else {
            earnedPoints = Math.round((qPoints * 0.5) * 100) / 100;
            reviewDetails = `Respuestas registradas. Claves sugeridas: ${keywords.slice(0, 4).join(', ')}`;
          }
        } else {
          earnedPoints = filled.length >= 2 ? qPoints : 0.5;
          isCorrect = earnedPoints === qPoints;
          reviewDetails = `${filled.length} elementos completados.`;
        }
      } else {
        reviewDetails = 'Sin responder';
      }
    } else if (q.type === 'multiple_choice') {
      const uVal = String(userAnswer || '').trim().toLowerCase();
      const cVal = String(q.correctAnswer || '').trim().toLowerCase();
      if (uVal && uVal === cVal) {
        earnedPoints = qPoints;
        isCorrect = true;
        reviewDetails = `Correcto: ${userAnswer}`;
      } else {
        reviewDetails = `Seleccionó: ${userAnswer || '(ninguno)'}. Correcto: ${q.correctAnswer}`;
      }
    }

    totalScore += earnedPoints;
    if (isCorrect && !isFeedback) correctCount++;
    if (!isCorrect && !isFeedback) incorrectCount++;

    questionResults.push({
      questionId: q.id,
      number: q.number,
      prompt: q.prompt,
      type: q.type,
      maxPoints: qPoints,
      earnedPoints: earnedPoints,
      isCorrect: isCorrect,
      userAnswer: userAnswer,
      correctSampleAnswer: q.correctSampleAnswer || q.correctAnswerText || '',
      explanation: q.explanation || '',
      reviewDetails: reviewDetails
    });
  });

  const finalScore = Math.round(totalScore * 100) / 100;
  const percentage = maxPossibleScore > 0 ? Math.round((finalScore / maxPossibleScore) * 100) : 100;
  const isApproved = finalScore >= (quiz.passingScore || 7);

  const submissionRecord = {
    id: 'sub-' + Date.now() + '-' + Math.round(Math.random() * 1000),
    quizId: quiz.id,
    quizTitle: quiz.title,
    submittedAt: new Date().toISOString(),
    participantInfo,
    score: finalScore,
    maxScore: maxPossibleScore,
    percentage,
    correctCount,
    incorrectCount,
    isApproved,
    questionResults
  };

  const allResponses = readJsonFile(RESPONSES_FILE, []);
  allResponses.unshift(submissionRecord);
  writeJsonFile(RESPONSES_FILE, allResponses);

  res.json({
    success: true,
    result: {
      id: submissionRecord.id,
      score: finalScore,
      maxScore: maxPossibleScore,
      percentage,
      correctCount,
      incorrectCount,
      isApproved,
      passingScore: quiz.passingScore || 7,
      participantName: participantInfo.nombre,
      questionResults
    }
  });
});

// Admin: Get all responses for a quiz
app.get('/api/quizzes/:id/responses', (req, res) => {
  const allResponses = readJsonFile(RESPONSES_FILE, []);
  const filtered = allResponses.filter(r => r.quizId === req.params.id);
  res.json(filtered);
});

// Admin: Delete a response
app.delete('/api/responses/:id', (req, res) => {
  let allResponses = readJsonFile(RESPONSES_FILE, []);
  allResponses = allResponses.filter(r => r.id !== req.params.id);
  writeJsonFile(RESPONSES_FILE, allResponses);
  res.json({ success: true });
});

// ---------------- EXPORT TO EXCEL (.xlsx) ----------------
app.get('/api/quizzes/:id/export-excel', (req, res) => {
  const quizzes = readJsonFile(QUIZZES_FILE, []);
  const quiz = quizzes.find(q => q.id === req.params.id);
  if (!quiz) return res.status(404).send('Formulario no encontrado');

  const allResponses = readJsonFile(RESPONSES_FILE, []);
  const quizResponses = allResponses.filter(r => r.quizId === req.params.id);

  // Build rows for Excel
  const excelRows = quizResponses.map((r, index) => {
    const row = {
      'N°': index + 1,
      'Fecha y Hora': new Date(r.submittedAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
      'Empresa': r.participantInfo?.empresa || '',
      'Fecha Evaluación': r.participantInfo?.fecha || '',
      'Participante (Apellidos y Nombres)': r.participantInfo?.nombre || '',
      'Cédula / Identidad': r.participantInfo?.cedula || '',
      'Cargo': r.participantInfo?.cargo || '',
      'Correo Electrónico': r.participantInfo?.correo || '',
      'Nota / Puntaje': r.score,
      'Puntaje Máximo': r.maxScore,
      '% Rendimiento': `${r.percentage}%`,
      'Aciertos': r.correctCount,
      'Errores': r.incorrectCount,
      'Estado': r.isApproved ? 'APROBADO' : 'REPROBADO'
    };

    // Add each question's answer and result
    if (Array.isArray(r.questionResults)) {
      r.questionResults.forEach(qr => {
        const qHeader = `P${qr.number}. ${qr.prompt.substring(0, 35)}...`;
        let answerStr = '';
        if (typeof qr.userAnswer === 'object' && qr.userAnswer !== null) {
          answerStr = JSON.stringify(qr.userAnswer);
        } else {
          answerStr = String(qr.userAnswer || '');
        }
        row[qHeader] = `${answerStr} [${qr.isCorrect ? 'ACIERTO' : 'FALLO'}: ${qr.earnedPoints} pts]`;
      });
    }

    return row;
  });

  // If no responses yet, output headers with demo empty row
  if (excelRows.length === 0) {
    excelRows.push({
      'N°': '-',
      'Fecha y Hora': '-',
      'Empresa': 'Sin registros aún',
      'Fecha Evaluación': '-',
      'Participante (Apellidos y Nombres)': '-',
      'Cédula / Identidad': '-',
      'Cargo': '-',
      'Correo Electrónico': '-',
      'Nota / Puntaje': 0,
      'Puntaje Máximo': quiz.totalPoints || 10,
      '% Rendimiento': '0%',
      'Aciertos': 0,
      'Errores': 0,
      'Estado': 'SIN DATOS'
    });
  }

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(excelRows);

  // Set column widths
  const colWidths = [
    { wch: 5 },  // N°
    { wch: 20 }, // Fecha
    { wch: 22 }, // Empresa
    { wch: 15 }, // Fecha eval
    { wch: 30 }, // Nombre
    { wch: 18 }, // Cedula
    { wch: 20 }, // Cargo
    { wch: 28 }, // Correo
    { wch: 14 }, // Nota
    { wch: 14 }, // Max
    { wch: 14 }, // %
    { wch: 10 }, // Aciertos
    { wch: 10 }, // Errores
    { wch: 15 }  // Estado
  ];
  ws['!cols'] = colWidths;

  xlsx.utils.book_append_sheet(wb, ws, 'Resultados');

  const safeTitle = quiz.title.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30);
  const filename = `Reporte_${safeTitle}_${Date.now()}.xlsx`;
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Quiz Flow server running on http://localhost:${PORT}`);
    console.log(`📱 Mobile network access: http://${getLocalIp()}:${PORT}`);
  });
}

module.exports = app;
