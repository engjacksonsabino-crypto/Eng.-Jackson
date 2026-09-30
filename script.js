const workbookUrl = 'GERENCIAMENTO CONTROLE JACKSON.xlsx';

const state = {
  rows: [],
  headers: [],
  workbookName: 'Planilha de tutoria',
  charts: {}
};

const statusLabels = {
  completed: ['concluido', 'concluída', 'feito', 'finalizado', 'ok', 'aprovado'],
  pending: ['pendente', 'em andamento', 'andamento', 'aguardando', 'a fazer'],
  cancelled: ['cancelado', 'cancelada', 'não realizado', 'incompleto']
};

const cardMeta = [
  { key: 'total', title: 'Registros', icon: '📊', hint: 'Total de linhas carregadas' },
  { key: 'completos', title: 'Concluídos', icon: '✅', hint: 'Percentual de registros finalizados' },
  { key: 'categorias', title: 'Categorias', icon: '🏷️', hint: 'Valores únicos em colunas-chave' },
  { key: 'media', title: 'Média', icon: '📈', hint: 'Média da coluna numérica principal' }
];

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return String(value).trim();
}

function parseRowsFromWorkbook(data) {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));

  const mapped = rows.map((row) => {
    const obj = {};
    for (const col of Object.keys(row)) {
      obj[col] = cleanCell(row[col]);
    }
    return obj;
  });

  return { rows: mapped, headers: normalizedHeaders, sheetName };
}

function getBestFieldName(rows, candidates) {
  const allKeys = rows.length ? Object.keys(rows[0]) : [];
  const map = allKeys.map((key) => ({ key, normalized: normalizeHeader(key) }));

  for (const candidate of candidates) {
    const match = map.find((item) => item.normalized.includes(candidate));
    if (match) return match.key;
  }

  return allKeys[0] || '';
}

function getNumericColumns(rows) {
  const allKeys = rows.length ? Object.keys(rows[0]) : [];
  return allKeys.filter((key) => {
    const values = rows.map((row) => Number(row[key])).filter((num) => !Number.isNaN(num));
    return values.length > 0 && values.length >= Math.max(1, Math.ceil(rows.length * 0.2));
  });
}

function getCategoryColumns(rows) {
  const allKeys = rows.length ? Object.keys(rows[0]) : [];
  return allKeys.filter((key) => {
    const uniques = [...new Set(rows.map((row) => String(row[key]).trim()).filter(Boolean))];
    return uniques.length > 0 && uniques.length <= Math.min(20, Math.max(2, rows.length));
  });
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMetric(value, type = 'number') {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'currency') return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  return value.toLocaleString('pt-BR');
}

function statusSummary(rows) {
  const statusField = getBestFieldName(rows, ['status', 'situacao', 'estado', 'resultado']);
  const values = rows.map((row) => String(row[statusField] || '').trim().toLowerCase());

  if (!statusField || values.every((v) => !v)) {
    return {
      labels: ['Sem status'],
      data: [rows.length || 1],
      field: null
    };
  }

  const counts = {};
  for (const value of values) {
    if (!value) continue;
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const found = Object.keys(statusLabels).find((key) => {
      const aliases = statusLabels[key];
      return aliases.some((alias) => normalized.includes(alias));
    });
    const key = found || normalized;
    counts[key] = (counts[key] || 0) + 1;
  }

  return {
    labels: Object.keys(counts),
    data: Object.values(counts),
    field: statusField
  };
}

function distributionSummary(rows) {
  const categoryField = getBestFieldName(rows, ['tutor', 'professor', 'aluno', 'estudante', 'disciplina', 'materia', 'curso', 'tipo', 'categoria']);
  const values = rows.map((row) => String(row[categoryField] || '').trim()).filter(Boolean);

  if (!categoryField || !values.length) return null;

  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }

  return {
    labels: Object.keys(counts),
    data: Object.values(counts),
    field: categoryField
  };
}

function timelineSummary(rows) {
  const dateField = getBestFieldName(rows, ['data', 'date', 'dt', 'periodo', 'mes', 'semana', 'dia']);
  const values = rows.map((row) => row[dateField]).filter((v) => v !== '' && v !== undefined && v !== null);

  if (!dateField || !values.length) return null;

  const parsed = values
    .map((value) => {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return { label: d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }), date: d };
    })
    .filter(Boolean);

  if (!parsed.length) return null;

  const counts = {};
  for (const item of parsed) {
    counts[item.label] = (counts[item.label] || 0) + 1;
  }

  return {
    labels: Object.keys(counts),
    data: Object.values(counts),
    field: dateField
  };
}

function renderStats(rows) {
  const cardsContainer = document.getElementById('cardsContainer');
  cardsContainer.innerHTML = '';

  const total = rows.length;
  const numericField = getNumericColumns(rows)[0] || null;
  const numericValues = numericField ? rows.map((row) => safeNumber(row[numericField])).filter((value) => value > 0) : [];
  const avg = numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : 0;

  const status = statusSummary(rows);
  const completedCount = status.field ? status.data[status.labels.findIndex((label) => statusLabels.completed.some((alias) => label.includes(alias)))] || 0 : 0;
  const percentCompleted = total ? ((completedCount / total) * 100) : 0;
  const uniqueCategories = new Set(
    rows.flatMap((row) => Object.values(row).map((value) => String(value).trim())).filter(Boolean)
  ).size;

  const metrics = [
    { key: 'total', value: formatMetric(total), details: 'Linhas registradas' },
    { key: 'completos', value: formatMetric(percentCompleted, 'percent'), details: 'de registros concluídos' },
    { key: 'categorias', value: formatMetric(uniqueCategories), details: 'itens únicos no conjunto' },
    { key: 'media', value: numericField ? formatMetric(avg, 'number') : '—', details: numericField ? `média em ${numericField}` : 'sem dados numéricos' }
  ];

  cardMeta.forEach((meta, index) => {
    const card = document.createElement('article');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-icon">${meta.icon}</div>
      <p>${meta.title}</p>
      <h3>${metrics[index].value}</h3>
      <span>${metrics[index].details}</span>
    `;
    cardsContainer.appendChild(card);
  });
}

function renderTable(rows) {
  const thead = document.getElementById('theadTable');
  const tbody = document.getElementById('tbodyTable');

  if (!rows.length) {
    thead.innerHTML = '<tr><th>Dados</th></tr>';
    tbody.innerHTML = '<tr><td class="empty-state">Nenhuma linha encontrada na planilha.</td></tr>';
    return;
  }

  const headers = Object.keys(rows[0]);
  thead.innerHTML = `
    <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
  `;

  tbody.innerHTML = rows
    .slice(0, 25)
    .map((row) => {
      return `<tr>${headers
        .map((header) => `<td>${String(row[header] ?? '').slice(0, 120)}</td>`)
        .join('')}</tr>`;
    })
    .join('');
}

function buildChart(elementId, config) {
  if (state.charts[elementId]) {
    state.charts[elementId].destroy();
  }

  state.charts[elementId] = new Chart(document.getElementById(elementId), config);
}

function renderCharts(rows) {
  const status = statusSummary(rows);
  const distribution = distributionSummary(rows);
  const timeline = timelineSummary(rows);

  const chartStatusConfig = {
    type: 'doughnut',
    data: {
      labels: status.labels.length ? status.labels : ['Sem status'],
      datasets: [{
        label: status.field ? `Status (${status.field})` : 'Status',
        data: status.data.length ? status.data : [1],
        backgroundColor: ['#2563eb', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  };

  buildChart('chartStatus', chartStatusConfig);

  if (distribution) {
    buildChart('chartDistribuicao', {
      type: 'bar',
      data: {
        labels: distribution.labels,
        datasets: [{
          label: distribution.field,
          data: distribution.data,
          backgroundColor: '#60a5fa'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } else {
    buildChart('chartDistribuicao', {
      type: 'bar',
      data: {
        labels: ['Sem categoria'],
        datasets: [{ data: [1], backgroundColor: '#cbd5e1' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (timeline) {
    buildChart('chartTimeline', {
      type: 'line',
      data: {
        labels: timeline.labels,
        datasets: [{
          label: timeline.field,
          data: timeline.data,
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(59,130,246,0.2)',
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } else {
    buildChart('chartTimeline', {
      type: 'line',
      data: {
        labels: ['Sem data'],
        datasets: [{ label: 'Dados', data: [0], borderColor: '#94a3b8', fill: false }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

async function loadWorkbook() {
  try {
    const response = await fetch(workbookUrl);
    if (!response.ok) {
      throw new Error('Planilha não encontrada no repositório.');
    }

    const buffer = await response.arrayBuffer();
    const parsed = parseRowsFromWorkbook(buffer);

    if (!parsed.rows.length) {
      throw new Error('A planilha não contém linhas válidas para montar o dashboard.');
    }

    state.rows = parsed.rows;
    state.headers = parsed.headers;
    state.workbookName = parsed.sheetName || state.workbookName;

    document.getElementById('arquivoNome').textContent = state.workbookName;

    renderStats(state.rows);
    renderTable(state.rows);
    renderCharts(state.rows);
  } catch (error) {
    document.getElementById('arquivoNome').textContent = 'Erro ao carregar';
    document.getElementById('cardsContainer').innerHTML = `
      <div class="stat-card" style="grid-column: 1 / -1;">
        <div class="stat-icon">⚠️</div>
        <p>Erro</p>
        <h3>Não foi possível carregar a planilha</h3>
        <span>${error.message}</span>
      </div>
    `;
  }
}

document.getElementById('recarregarBtn').addEventListener('click', loadWorkbook);

window.addEventListener('DOMContentLoaded', loadWorkbook);
