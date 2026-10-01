const state = {
  rows: [],
  headers: [],
  workbookName: 'Nenhum arquivo carregado',
  charts: {}
};

const STATUS = {
  completed: 'GERENCIOU',
  partial: 'PARCIAL',
  pending: 'PENDENTE',
  none: 'SEM REGISTRO'
};

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^A-Z0-9]+/g, ' ').trim();
}

function cleanCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return String(value).trim();
}

function looksLikeSpreadsheetHeader(row) {
  const headers = Object.keys(row).map(normalizeHeader);
  return headers.some((header) => /TUTOR|ORDEM|STATUS|SITUACAO|GERENCIAMENTO/.test(header));
}

function parseRowsFromFile(data, fileName = '') {
  const isCsv = /\.csv$/i.test(fileName);
  const workbook = XLSX.read(data, { type: 'array' });
  const preferredSheet = workbook.SheetNames.find((name) => normalizeHeader(name) === '02SEMESTRE');
  const sheetName = preferredSheet || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const options = { defval: '', raw: false };
  let rows = XLSX.utils.sheet_to_json(sheet, isCsv ? options : { ...options, range: 3 });

  // Some files already contain a compact header row. Fall back instead of
  // treating the title/merged cells above it as column names.
  if (!rows.length || !looksLikeSpreadsheetHeader(rows[0])) {
    const allRows = XLSX.utils.sheet_to_json(sheet, options);
    const headerIndex = allRows.findIndex(looksLikeSpreadsheetHeader);
    if (headerIndex >= 0) {
      rows = XLSX.utils.sheet_to_json(sheet, { ...options, range: headerIndex });
    }
  }

  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  return {
    rows: rows.map((row) => Object.fromEntries(headers.map((key) => [key, cleanCell(row[key])]))),
    headers: headers.map((raw) => ({ raw, normalized: normalizeHeader(raw) })),
    sheetName
  };
}

function findField(headers, candidates) {
  const normalized = headers.map((key) => ({ key, value: normalizeHeader(key) }));
  for (const candidate of candidates) {
    const match = normalized.find(({ value }) => value === candidate || value.includes(candidate));
    if (match) return match.key;
  }
  return '';
}

function getOrderFields(headers) {
  return headers.filter((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes('ORDEM') || /^0?[1-9]$/.test(normalized) || /^ORDEM\s+0?[1-9]+/.test(normalized);
  });
}

function orderLabel(header) {
  const normalized = normalizeHeader(header);
  const match = normalized.match(/(?:ORDEM\s*)?(\d+)/);
  return match ? `ORDEM ${match[1].padStart(2, '0')}` : 'GERAL';
}

function normalizeStatus(value) {
  const text = normalizeText(value);
  if (!text || ['NAN', 'NONE', 'NULL', 'NA', '_EMPTY'].includes(text)) return STATUS.none;
  if (text === 'X' || /PENDENTE|AGUARDANDO|NAO GERENCIADO/.test(text)) return STATUS.pending;
  if (/PARCIAL/.test(text)) return STATUS.partial;
  if (/GERENCIAD|GERENCIOU|OK|REALIZAD|CONCLUID|ATENDID|FEITO/.test(text)) return STATUS.completed;
  return text;
}

function buildModel(sourceRows) {
  if (!sourceRows.length) return { records: [], headers: [], tutorField: '', orderFields: [] };
  const headers = Object.keys(sourceRows[0]);
  const tutorField = findField(headers, ['TUTOR', 'NOME DO TUTOR', 'RESPONSAVEL', 'NOME']);
  const statusField = findField(headers, ['STATUS DO TUTOR', 'STATUS TUTOR', 'SITUACAO DO TUTOR']);
  const orderFields = getOrderFields(headers);
  const fields = orderFields.length ? orderFields : [statusField || tutorField];
  const records = [];

  sourceRows.forEach((row) => {
    const tutor = normalizeText(row[tutorField]);
    if (!tutor) return;
    fields.forEach((field) => {
      records.push({
        TUTOR: tutor,
        STATUS_TUTOR: normalizeText(row[statusField]) || STATUS.none,
        ORDEM: orderFields.length ? orderLabel(field) : 'GERAL',
        GERENCIAMENTO: normalizeStatus(row[field]),
        VALOR_ORIGINAL: cleanCell(row[field])
      });
    });
  });
  return { records, headers, tutorField, orderFields };
}

function tutorStatuses(records) {
  const grouped = new Map();
  records.forEach((record) => {
    if (!grouped.has(record.TUTOR)) grouped.set(record.TUTOR, []);
    grouped.get(record.TUTOR).push(record.GERENCIAMENTO);
  });
  return [...grouped].map(([tutor, values]) => {
    let status = STATUS.none;
    if (values.length && values.every((value) => value === STATUS.completed)) status = STATUS.completed;
    else if (values.length && values.every((value) => value === STATUS.pending)) status = STATUS.pending;
    else if (values.some((value) => value === STATUS.completed || value === STATUS.partial)) status = STATUS.partial;
    return { tutor, status };
  });
}

function countBy(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function renderStats(records) {
  const tutors = tutorStatuses(records);
  const counts = countBy(tutors.map((item) => item.status));
  const total = tutors.length;
  const managed = counts[STATUS.completed] || 0;
  const partial = counts[STATUS.partial] || 0;
  const pending = counts[STATUS.pending] || 0;
  const metrics = [
    { title: 'Tutores', value: formatNumber(total), icon: '👥', hint: 'tutores únicos na planilha', tone: 'blue' },
    { title: 'Gerenciaram', value: `${total ? ((managed / total) * 100).toFixed(1) : '0.0'}%`, icon: '✓', hint: `${formatNumber(managed)} tutor(es) com todas as ordens`, tone: 'green' },
    { title: 'Pendências', value: formatNumber(pending), icon: '!', hint: 'tutores ainda pendentes', tone: 'orange' },
    { title: 'Parciais', value: formatNumber(partial), icon: '↗', hint: 'tutores com gerenciamento parcial', tone: 'purple' }
  ];
  const container = document.getElementById('cardsContainer');
  container.innerHTML = metrics.map((metric) => `
    <article class="stat-card ${metric.tone}">
      <div class="stat-icon">${metric.icon}</div>
      <p>${metric.title}</p>
      <h3>${metric.value}</h3>
      <span>${metric.hint}</span>
    </article>
  `).join('');
}

function renderTable(records) {
  const headers = ['TUTOR', 'STATUS_TUTOR', 'ORDEM', 'GERENCIAMENTO'];
  document.getElementById('theadTable').innerHTML = `<tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>`;
  document.getElementById('tbodyTable').innerHTML = records.length
    ? records.slice(0, 100).map((row) => `<tr>${headers.map((header) => `<td>${row[header] || '—'}</td>`).join('')}</tr>`).join('')
    : '<tr><td colspan="4" class="empty-state">Nenhum tutor encontrado na planilha.</td></tr>';
}

function buildChart(elementId, config) {
  if (state.charts[elementId]) state.charts[elementId].destroy();
  const canvas = document.getElementById(elementId);
  if (canvas) state.charts[elementId] = new Chart(canvas, config);
}

function renderCharts(records) {
  const tutors = tutorStatuses(records);
  const status = countBy(tutors.map((item) => item.status));
  const labels = [STATUS.completed, STATUS.partial, STATUS.pending, STATUS.none].filter((label) => status[label]);
  const colors = ['#16a34a', '#f59e0b', '#ef4444', '#94a3b8'];
  buildChart('chartStatus', {
    type: 'doughnut',
    data: { labels: labels.length ? labels : ['Sem dados'], datasets: [{ data: labels.length ? labels.map((label) => status[label]) : [1], backgroundColor: colors, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' } } }
  });

  const byOrder = countBy(records.filter((row) => row.GERENCIAMENTO === STATUS.pending).map((row) => row.ORDEM));
  const orderLabels = Object.keys(byOrder).sort();
  buildChart('chartDistribuicao', {
    type: 'bar',
    data: { labels: orderLabels.length ? orderLabels : ['Sem pendências'], datasets: [{ label: 'Pendências', data: orderLabels.length ? orderLabels.map((label) => byOrder[label]) : [0], backgroundColor: '#f97316', borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  const byOrderTotal = countBy(records.map((row) => row.ORDEM));
  const byOrderManaged = countBy(records.filter((row) => row.GERENCIAMENTO === STATUS.completed).map((row) => row.ORDEM));
  const timelineLabels = Object.keys(byOrderTotal).sort();
  buildChart('chartTimeline', {
    type: 'line',
    data: { labels: timelineLabels.length ? timelineLabels : ['Sem ordens'], datasets: [{ label: '% gerenciado', data: timelineLabels.map((label) => ((byOrderManaged[label] || 0) / byOrderTotal[label]) * 100), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: .35, pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } } }
  });
}

function renderDashboard(records) {
  if (!records.length) {
    document.getElementById('cardsContainer').innerHTML = '<div class="alert" style="grid-column:1/-1">⚠️ Envie a planilha de controle para visualizar os indicadores corretos.</div>';
    renderTable([]);
    return;
  }
  renderStats(records);
  renderTable(records);
  renderCharts(records);
}

function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = parseRowsFromFile(e.target.result, file.name);
      if (!parsed) throw new Error('A planilha está vazia ou não possui uma linha de cabeçalho válida.');
      const model = buildModel(parsed.rows);
      if (!model.records.length) throw new Error('Não foi possível identificar tutores na planilha.');
      state.rows = model.records;
      state.headers = parsed.headers;
      state.workbookName = file.name;
      document.getElementById('arquivoNome').textContent = `✓ ${file.name} · aba ${parsed.sheetName}`;
      renderDashboard(state.rows);
    } catch (error) {
      alert(`Erro ao carregar o arquivo: ${error.message}`);
      document.getElementById('arquivoNome').textContent = 'Erro ao carregar';
    }
  };
  reader.readAsArrayBuffer(file);
}

document.getElementById('fileInput').addEventListener('change', handleFileUpload);
document.getElementById('recarregarBtn').addEventListener('click', () => renderDashboard(state.rows));
document.getElementById('exportBtn').addEventListener('click', () => window.print());
window.addEventListener('DOMContentLoaded', () => renderDashboard([]));
