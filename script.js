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
    rows: rows.map((row) =>
      Object.fromEntries(headers.map((key) => [key, cleanCell(row[key])]))
    ),
    headers: headers.map((raw) => ({ raw, normalized: normalizeHeader(raw) })),
    sheetName
  };
}

function findField(headers, candidates) {
  const normalized = headers.map((key) => ({
    key,
    value: normalizeHeader(key)
  }));

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
  const tutorField = findField(headers, ['TUTOR', 'PROFESSOR', 'ALUNO', 'RESPONSAVEL']);
  const statusField = findField(headers, ['STATUS', 'SITUACAO', 'ESTADO', 'GERENCIAMENTO']);
  const dateField = findField(headers, ['DATA', 'PERIODO', 'MES', 'DATA DO ATENDIMENTO']);
  const orderFields = getOrderFields(headers);

  return {
    records: sourceRows.map((row) => ({
      ...row,
      _status: normalizeStatus(row[statusField]),
      _tutor: row[tutorField] || 'SEM TUTOR',
      _date: row[dateField] || '',
      _orders: orderFields.reduce((acc, field) => {
        acc[field] = row[field] || '';
        return acc;
      }, {})
    })),
    headers,
    tutorField,
    statusField,
    dateField,
    orderFields
  };
}

function renderCards(records, headers) {
  const container = document.getElementById('cardsContainer');
  if (!container) return;

  const totalRecords = records.length;
  const completedCount = records.filter((r) => r._status === STATUS.completed).length;
  const completedPercent = totalRecords > 0 ? Math.round((completedCount / totalRecords) * 100) : 0;

  const uniqueTutors = new Set(records.map((r) => r._tutor)).size;
  const numericHeaders = headers.filter((h) => {
    const firstVal = records[0]?.[h];
    return typeof firstVal === 'number' || !isNaN(parseFloat(firstVal));
  });
  let avgValue = 0;
  if (numericHeaders.length > 0) {
    const sum = records.reduce((acc, r) => {
      const val = parseFloat(r[numericHeaders[0]]) || 0;
      return acc + val;
    }, 0);
    avgValue = (sum / records.length).toFixed(2);
  }

  const cards = [
    { label: 'Total de Registros', value: totalRecords, icon: '📊' },
    { label: 'Concluídos', value: `${completedPercent}%`, icon: '✅' },
    { label: 'Tutores Únicos', value: uniqueTutors, icon: '👤' },
    { label: 'Média', value: avgValue, icon: '📈' }
  ];

  container.innerHTML = cards.map((card) => `
    <div class="stat-card">
      <div class="stat-icon">${card.icon}</div>
      <div class="stat-content">
        <p class="stat-label">${card.label}</p>
        <p class="stat-value">${card.value}</p>
      </div>
    </div>
  `).join('');
}

function renderTable(records, headers, maxRows = 50) {
  const theadTable = document.getElementById('theadTable');
  const tbodyTable = document.getElementById('tbodyTable');
  if (!theadTable || !tbodyTable) return;

  theadTable.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  tbodyTable.innerHTML = records.slice(0, maxRows).map((r) =>
    `<tr>${headers.map((h) => `<td>${r[h] || ''}</td>`).join('')}</tr>`
  ).join('');
}

function renderCharts(records) {
  const chartStatus = document.getElementById('chartStatus');
  const chartDistribuicao = document.getElementById('chartDistribuicao');
  const chartTimeline = document.getElementById('chartTimeline');

  if (!chartStatus || !chartDistribuicao || !chartTimeline) return;

  // Chart 1: Status (Pie)
  const statusCounts = Object.values(STATUS).reduce((acc, status) => {
    acc[status] = records.filter((r) => r._status === status).length;
    return acc;
  }, {});

  const ctx1 = chartStatus.getContext('2d');
  if (state.charts.chartStatus) state.charts.chartStatus.destroy();
  state.charts.chartStatus = new Chart(ctx1, {
    type: 'pie',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#10b981', '#f97316', '#ef4444', '#9ca3af']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Chart 2: Distribuição por Tutor (Bar)
  const tutorCounts = {};
  records.forEach((r) => {
    tutorCounts[r._tutor] = (tutorCounts[r._tutor] || 0) + 1;
  });

  const ctx2 = chartDistribuicao.getContext('2d');
  if (state.charts.chartDistribuicao) state.charts.chartDistribuicao.destroy();
  state.charts.chartDistribuicao = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: Object.keys(tutorCounts),
      datasets: [{
        label: 'Quantidade de Registros',
        data: Object.values(tutorCounts),
        backgroundColor: '#315fe9'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Chart 3: Timeline (Line)
  const dateCounts = {};
  records.forEach((r) => {
    if (r._date) {
      dateCounts[r._date] = (dateCounts[r._date] || 0) + 1;
    }
  });

  const ctx3 = chartTimeline.getContext('2d');
  if (state.charts.chartTimeline) state.charts.chartTimeline.destroy();
  state.charts.chartTimeline = new Chart(ctx3, {
    type: 'line',
    data: {
      labels: Object.keys(dateCounts),
      datasets: [{
        label: 'Registros por Data',
        data: Object.values(dateCounts),
        borderColor: '#315fe9',
        backgroundColor: 'rgba(49,95,233,0.1)',
        borderWidth: 2,
        fill: true
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function loadData(data, fileName) {
  const parsed = parseRowsFromFile(data, fileName);
  if (!parsed) {
    alert('Nenhuma dados válidos encontrados no arquivo');
    return;
  }

  const model = buildModel(parsed.rows);
  state.rows = model.records;
  state.headers = parsed.headers.map((h) => h.raw);
  state.workbookName = fileName;

  document.getElementById('arquivoNome').textContent = fileName;
  renderCards(state.rows, state.headers);
  renderTable(state.rows, state.headers);
  renderCharts(state.rows);
}

document.getElementById('fileInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    loadData(event.target.result, file.name);
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById('recarregarBtn')?.addEventListener('click', () => {
  alert('Dados recarregados!');
});

document.getElementById('exportBtn')?.addEventListener('click', () => {
  alert('Função de exportação será implementada em breve!');
});

console.log('Dashboard carregado com sucesso! 🚀');
