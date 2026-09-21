// SeatFlow — import.js
// Drives the guest CSV import modal: upload → map columns → preview → import.
// Excel (.xlsx/.xls) files are accepted by the dropzone but parsed only once
// a spreadsheet library is wired up on the backend — see the note in
// handleFile() below. CSV is fully supported client-side.

import { apiRequest } from './api.js';
import { toast, isValidEmail } from './utils.js';

const TARGET_FIELDS = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'group', label: 'Group', required: false },
  { key: 'vip', label: 'VIP', required: false },
  { key: 'meal', label: 'Meal', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 0);
}

function guessMapping(headers) {
  const mapping = {};
  headers.forEach((header, i) => {
    const h = header.trim().toLowerCase();
    if (/^first/.test(h)) mapping.firstName = i;
    else if (/^last/.test(h)) mapping.lastName = i;
    else if (/^(name|full name)$/.test(h)) mapping.__fullName = i;
    else if (/email/.test(h)) mapping.email = i;
    else if (/phone/.test(h)) mapping.phone = i;
    else if (/group|party|household/.test(h)) mapping.group = i;
    else if (/vip/.test(h)) mapping.vip = i;
    else if (/meal|diet/.test(h)) mapping.meal = i;
    else if (/note/.test(h)) mapping.notes = i;
  });
  return mapping;
}

export function initImportModal({ modalEl, eventId, onImported }) {
  if (!modalEl) return;

  const dropzone = modalEl.querySelector('[data-dropzone]');
  const fileInput = modalEl.querySelector('[data-file-input]');
  const stepEls = { upload: modalEl.querySelector('[data-step-upload]'), map: modalEl.querySelector('[data-step-map]'), preview: modalEl.querySelector('[data-step-preview]') };
  const mapBody = modalEl.querySelector('[data-map-body]');
  const previewSummary = modalEl.querySelector('[data-preview-summary]');
  const previewTable = modalEl.querySelector('[data-preview-table]');
  const backBtn = modalEl.querySelector('[data-import-back]');
  const nextBtn = modalEl.querySelector('[data-import-next]');
  const importBtn = modalEl.querySelector('[data-import-commit]');
  const templateLink = modalEl.querySelector('[data-template-download]');

  let headers = [];
  let dataRows = [];
  let mapping = {};
  let currentStep = 'upload';
  let parsedGuests = [];

  const stepLabels = modalEl.querySelectorAll('[data-step-label]');

  function showStep(step) {
    currentStep = step;
    Object.entries(stepEls).forEach(([key, el]) => { if (el) el.style.display = key === step ? 'block' : 'none'; });
    stepLabels.forEach((el) => el.classList.toggle('current', el.dataset.stepLabel === step));
    backBtn.style.visibility = step === 'upload' ? 'hidden' : 'visible';
    nextBtn.style.display = step === 'preview' ? 'none' : 'inline-flex';
    importBtn.style.display = step === 'preview' ? 'inline-flex' : 'none';
  }

  function reset() {
    headers = []; dataRows = []; mapping = {}; parsedGuests = [];
    fileInput.value = '';
    showStep('upload');
  }

  function handleFile(file) {
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    if (!isCsv) {
      toast('Excel import needs the backend spreadsheet service — export this file as CSV for now.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      if (rows.length < 2) { toast('That file doesn\u2019t have any guest rows.', 'error'); return; }
      headers = rows[0];
      dataRows = rows.slice(1);
      mapping = guessMapping(headers);
      renderMapStep();
      showStep('map');
    };
    reader.readAsText(file);
  }

  function renderMapStep() {
    mapBody.innerHTML = TARGET_FIELDS.map((field) => {
      const options = ['<option value="">\u2014 Not mapped \u2014</option>']
        .concat(headers.map((h, i) => `<option value="${i}" ${mapping[field.key] === i ? 'selected' : ''}>${h}</option>`));
      return `
        <div class="column-map-row">
          <div class="source-col"><strong>${field.label}${field.required ? ' *' : ''}</strong>SeatFlow field</div>
          <select data-map-select="${field.key}">${options.join('')}</select>
        </div>`;
    }).join('');

    mapBody.querySelectorAll('[data-map-select]').forEach((select) => {
      select.addEventListener('change', () => {
        const key = select.dataset.mapSelect;
        mapping[key] = select.value === '' ? undefined : Number(select.value);
      });
    });
  }

  function buildPreview() {
    const seen = new Set();
    parsedGuests = dataRows.map((row) => {
      let firstName = mapping.firstName !== undefined ? row[mapping.firstName] : '';
      let lastName = mapping.lastName !== undefined ? row[mapping.lastName] : '';
      if ((!firstName || !lastName) && mapping.__fullName !== undefined) {
        const parts = String(row[mapping.__fullName] || '').trim().split(/\s+/);
        firstName = firstName || parts[0] || '';
        lastName = lastName || parts.slice(1).join(' ') || '';
      }
      const email = mapping.email !== undefined ? row[mapping.email] : '';
      const guest = {
        firstName: (firstName || '').trim(),
        lastName: (lastName || '').trim(),
        email: (email || '').trim(),
        phone: mapping.phone !== undefined ? (row[mapping.phone] || '').trim() : '',
        group: mapping.group !== undefined ? (row[mapping.group] || '').trim() : '',
        vip: mapping.vip !== undefined ? /^(yes|true|1|vip)$/i.test((row[mapping.vip] || '').trim()) : false,
        meal: mapping.meal !== undefined ? (row[mapping.meal] || '').trim() : '',
        notes: mapping.notes !== undefined ? (row[mapping.notes] || '').trim() : '',
      };

      let status = 'valid';
      if (!guest.firstName || !guest.lastName) status = 'invalid';
      else if (guest.email && !isValidEmail(guest.email)) status = 'invalid';
      else {
        const key = `${guest.firstName.toLowerCase()}|${guest.lastName.toLowerCase()}|${guest.email.toLowerCase()}`;
        if (seen.has(key)) status = 'duplicate';
        seen.add(key);
      }
      return { ...guest, status };
    });

    const valid = parsedGuests.filter((g) => g.status === 'valid').length;
    const dupes = parsedGuests.filter((g) => g.status === 'duplicate').length;
    const invalid = parsedGuests.filter((g) => g.status === 'invalid').length;

    previewSummary.innerHTML = `
      <div class="import-summary-item valid"><strong>${valid}</strong><span>Valid rows</span></div>
      <div class="import-summary-item dupe"><strong>${dupes}</strong><span>Duplicate rows</span></div>
      <div class="import-summary-item invalid"><strong>${invalid}</strong><span>Invalid rows</span></div>
    `;

    previewTable.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
        <tbody>
          ${parsedGuests.slice(0, 50).map((g) => `
            <tr>
              <td>${g.firstName} ${g.lastName}</td>
              <td>${g.email || '\u2014'}</td>
              <td><span class="status-pill ${g.status === 'valid' ? 'live' : 'draft'}">${g.status}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  templateLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const csv = 'First Name,Last Name,Email,Phone,Group,VIP,Meal,Notes\nJane,Doe,jane@example.com,,Bride\u2019s side,No,Standard,\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'seatflow-guest-template.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  nextBtn.addEventListener('click', () => {
    if (currentStep === 'upload') { toast('Choose a CSV file first.', 'error'); return; }
    if (currentStep === 'map') {
      if (mapping.firstName === undefined || mapping.lastName === undefined) {
        if (mapping.__fullName === undefined) { toast('Map at least First Name and Last Name (or a Full Name column).', 'error'); return; }
      }
      buildPreview();
      showStep('preview');
    }
  });

  backBtn.addEventListener('click', () => {
    if (currentStep === 'map') showStep('upload');
    else if (currentStep === 'preview') showStep('map');
  });

  importBtn.addEventListener('click', async () => {
    const toImport = parsedGuests.filter((g) => g.status !== 'invalid').map(({ status, ...g }) => g);
    if (toImport.length === 0) { toast('No valid rows to import.', 'error'); return; }
    importBtn.disabled = true;
    importBtn.textContent = 'Importing\u2026';
    try {
      const result = await apiRequest(`/events/${eventId}/guests/import`, { method: 'POST', body: JSON.stringify({ guests: toImport }) });
      toast(`Imported ${result.imported} guests.`, 'success');
      onImported?.();
      modalEl.classList.remove('open');
      reset();
    } catch (err) {
      toast('Import failed. Please try again.', 'error');
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = 'Import Guests';
    }
  });

  reset();
}
