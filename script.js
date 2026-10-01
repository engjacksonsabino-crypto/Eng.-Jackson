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
  const tutorField = findField(headers,

