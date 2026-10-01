const state = {
  rows: [],
  headers: [],
  workbookName: 'Nenhum arquivo carregado',
  charts: {}
};

const statusLabels = {
  completed: ['concluido', 'concluída', 'feito', 'finalizado', 'ok', 'aprovado', 'sim'],
  pending: ['pendente', 'em andamento', 'andamento', 'aguardando', 'a fazer', 'nao', 'não'],
  cancelled: ['cancelado', 'cancelada', 'não realizado', 'incompleto']
};

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

function parseRowsFromFile(data) {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (!rows.length) return null;

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
  const categoryField = getBestFieldName(rows, ['tutor', 'professor', 'aluno', 'estudante', 'disciplina', 'materia', 'curso', 'tipo', 'categoria', 'turma']);
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
  const dateField = getBestFieldName(rows, ['data', 'date', 'dt', 'periodo', 'mes', 'semana', 'dia', 'data aula']);
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
  const completedCount = status.field ? status.data[status.labels.findIndex((label) => label.includes('completed'))] || 0 : 0;
  const percentCompleted = total ? ((completedCount / total) * 100) : 0;
  const uniqueCategories = new Set(
    rows.flatMap((row) => Object.values(row).map((value) => String(value).trim())).filter(Boolean)
  ).size;

  const metrics = [
    { title: 'Registros', value: formatMetric(total), icon: '📊', hint: 'Linhas registradas' },
    { title: 'Concluídos', value: formatMetric(percentCompleted, 'percent'), icon: '✅', hint: 'de registros finalizados' },
    { title: 'Categorias', value: formatMetric(uniqueCategories), icon: '🏷️', hint: 'itens únicos no conjunto' },
    { title: 'Média', value: numericField ? formatMetric(avg, 'number') : '—', icon: '📈', hint: numericField ? `média em ${numericField}` : 'sem dados numéricos' }
  ];

  metrics.forEach((meta) => {
    const card = document.createElement('article');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-icon">${meta.icon}</div>
      <p>${meta.title}</p>
      <h3>${meta.value}</h3>
      <span>${meta.hint}</span>
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
    .slice(0, 50)
    .map((row) => {
      return `<tr>${headers
        .map((header) => `<td>${String(row[header] ?? '').slice(0, 100)}</td>`)
        .join('')}</tr>`;
    })
    .join('');
}

function buildChart(elementId, config) {
  if (state.charts[elementId]) {
    state.charts[elementId].destroy();
  }

  const ctx = document.getElementById(elementId);
  if (!ctx) return;

  state.charts[elementId] = new Chart(ctx, config);
}

function renderCharts(rows) {
  const status = statusSummary(rows);
  const distribution = distributionSummary(rows);
  const timeline = timelineSummary(rows);

  const chartStatusConfig = {
    type: 'doughnut',
    data: {
      labels: status.labels.length ? status.labels : ['Sem status'],
      datasets: [
        {
          label: status.field ? `Status (${status.field})` : 'Status',
          data: status.data.length ? status.data : [1],
          backgroundColor: ['#2563eb', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']
        }
      ]
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
        labels: distribution.labels.slice(0, 10),
        datasets: [
          {
            label: distribution.field,
            data: distribution.data.slice(0, 10),
            backgroundColor: '#60a5fa'
          }
        ]
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
        labels: timeline.labels.slice(0, 15),
        datasets: [
          {
            label: timeline.field,
            data: timeline.data.slice(0, 15),
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(59,130,246,0.2)',
            fill: true,
            tension: 0.35
          }
        ]
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

function renderDashboard(rows) {
  if (!rows || !rows.length) {
    document.getElementById('cardsContainer').innerHTML = `
      <div class="alert" style="grid-column: 1 / -1;">
        ⚠️ Envie uma planilha para começar a visualizar o dashboard.
      </div>
    `;
    return;
  }

  renderStats(rows);
  renderTable(rows);
  renderCharts(rows);
}

function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result;
      if (!buffer) throw new Error('Não foi possível ler o arquivo.');

      const parsed = parseRowsFromFile(buffer);

      if (!parsed) {
        throw new Error('A planilha está vazia ou em um formato não suportado.');
      }

      state.rows = parsed.rows;
      state.headers = parsed.headers;
      state.workbookName = file.name;

      document.getElementById('arquivoNome').textContent = `✓ ${file.name}`;
      renderDashboard(state.rows);
    } catch (error) {
      alert(`Erro ao carregar o arquivo: ${error.message}`);
      document.getElementById('arquivoNome').textContent = 'Erro ao carregar';
    }
  };

  reader.readAsArrayBuffer(file);
}

document.getElementById('fileInput').addEventListener('change', handleFileUpload);

document.getElementById('recarregarBtn').addEventListener('click', () => {
  if (state.rows.length) {
    renderDashboard(state.rows);
  } else {
    alert('Carregue uma planilha primeiro.');
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  alert('Funcionalidade de exportação em desenvolvimento. Use Print (Ctrl+P) para salvar como PDF.');
});

window.addEventListener('DOMContentLoaded', () => {
  renderDashboard([]);
});
