/* ==========================================================
   Медресе — Документтерди башкаруу системасы (демо frontend)
   Структура: CONFIG → API катмары (Storage) → Auth → UI
   Backend кошкондо ТЕК "API" объектинин ичин өзгөртүү жетиштүү
   (fetch('/api/...') менен алмаштырылат). Бардык UI ушул API аркылуу иштейт.
   ЭСКЕРТҮҮ: frontend текшерүү — демо гана. Реалдуу коопсуздук серверде болушу керек.
   ========================================================== */
'use strict';

/* ---------- 1. КОНФИГУРАЦИЯ ---------- */
// Сыр сөздөр ачык текст эмес, SHA-256 хэш түрүндө (демо). Серверде bcrypt/argon2 колдонуңуз.
const CONFIG = {
  users: {
    admin: { hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'admin' },
    user:  { hash: 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', role: 'viewer' }
  },
  adminCodeHash: 'ac1b697d502d7cdb8f5c0e1dbcb8fa62e347fdd187acc96d50f4585f5c0c9590',
  maxFileMB: 10,
  allowed: ['application/pdf', 'image/jpeg', 'image/png'],
  docTypes: ['Паспорт', 'Туулгандыгы тууралуу күбөлүк', 'Диплом', 'Сертификат', 'Арыз', 'Келишим', 'Сүрөт', 'Башка'],
  statuses: ['Активдүү', 'Текшерилүүдө', 'Архивде']
};

/* ---------- 2. КИЧИНЕ ЖАРДАМЧЫЛАР ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Кириллицаны папка аты үчүн латынга которуу
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',ң:'n',о:'o',ө:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ү:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sh',ы:'y',э:'e',ю:'yu',я:'ya',ъ:'',ь:'' };
const slug = n => n.toLowerCase().split('').map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const folderOf = p => `/${p.type === 'student' ? 'students' : 'teachers'}/${slug(p.name)}/`;

/* ---------- 3. API КАТМАРЫ (localStorage + IndexedDB) ---------- */
const API = {
  db: null, idb: null,
  async init() {
    this.idb = await new Promise((res, rej) => {
      const r = indexedDB.open('medrese_files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    this.db = JSON.parse(localStorage.getItem('medrese_db') || 'null');
    if (!this.db) { this.db = seed(); this.save(); }
  },
  save() { localStorage.setItem('medrese_db', JSON.stringify(this.db)); },
  putFile(key, blob) { return this._tx('readwrite', s => s.put(blob, key)); },
  getFile(key) { return this._tx('readonly', s => s.get(key)); },
  delFile(key) { return this._tx('readwrite', s => s.delete(key)); },
  _tx(mode, fn) {
    return new Promise((res, rej) => {
      const r = fn(this.idb.transaction('files', mode).objectStore('files'));
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  person: id => API.db.people.find(p => p.id === id),
  doc: id => API.db.docs.find(d => d.id === id)
};

/* Демо маалымат — биринчи ачылганда бош болбосун */
function seed() {
  const P = (type, name, extra) => ({ id: uid(), type, name, status: 'Активдүү', phone: '+996 700 00 00 00', address: 'Бишкек ш.', ...extra });
  const people = [
    P('student', 'Абдуллах Ахмад', { birth: 2012, joined: '2023-09-01', phone: '+996 700 11 22 33' }),
    P('student', 'Мухаммад Али', { birth: 2011, joined: '2022-09-01' }),
    P('student', 'Омар Абдулла', { birth: 2013, joined: '2024-09-01' }),
    P('teacher', 'Абдурахман Устаз', { subject: 'Куран жана тажвид', joined: '2019-08-15' }),
    P('teacher', 'Мухаммад Устаз', { subject: 'Арабча', joined: '2021-01-10' })
  ];
  const D = (i, title, type, daysAgo, status = 'Активдүү', cat) => ({
    id: uid(), title, personId: people[i].id, category: people[i].type, type, number: '№' + (1000 + Math.floor(Math.random() * 9000)),
    comment: 'Демо документ', date: new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10), status, archived: status === 'Архивде', fileKey: null, mime: ''
  });
  const docs = [
    D(0, 'Паспорт — Абдуллах', 'Паспорт', 0), D(0, 'Туулгандыгы тууралуу күбөлүк', 'Туулгандыгы тууралуу күбөлүк', 3),
    D(0, 'Окууга кабыл алуу арызы', 'Арыз', 10), D(1, 'Паспорт — Мухаммад Али', 'Паспорт', 1),
    D(1, 'Арыз', 'Арыз', 20, 'Текшерилүүдө'), D(2, 'Сүрөт 3x4', 'Сүрөт', 0), D(3, 'Диплом — Абдурахман', 'Диплом', 40),
    D(3, 'Сертификат', 'Сертификат', 5), D(4, 'Паспорт — Мухаммад Устаз', 'Паспорт', 2), D(4, 'Эмгек келишими', 'Келишим', 60, 'Архивде')
  ];
  return { people, docs, notes: [] };
}

/* ---------- 4. ҮЛКӨН АБАЛ ---------- */
const S = { role: null, page: 'dashboard', q: '', fCat: 'all', fType: 'all', fDate: 'all', pending: null, stream: null, scanBlob: null };
const isAdmin = () => S.role === 'admin';

/* ---------- 5. БИЛДИРҮҮЛӨР ---------- */
function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3500);
  API.db.notes.unshift({ msg, err, at: new Date().toLocaleString('ky-KG') });
  API.db.notes = API.db.notes.slice(0, 30); API.save(); renderBell(true);
}
function renderBell(fresh) {
  const c = $('#bellCount'); if (fresh) S.unread = (S.unread || 0) + 1;
  c.hidden = !S.unread; c.textContent = S.unread;
}

/* ---------- 6. МОДАЛ СИСТЕМАСЫ ---------- */
function openModal(html, big = false) {
  $('#modalBox').className = 'modal' + (big ? ' big' : '');
  $('#modalBox').innerHTML = html; $('#modal').hidden = false;
}
function closeModal() {
  $('#modal').hidden = true; $('#modalBox').innerHTML = '';
  if (S.stream && S.page !== 'scanner') stopCam();
}
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Admin Code сурамы: туура болсо гана callback чакырылат
function askCode(cb) {
  openModal(`<h3>🔐 Администратордун коду</h3><p class="muted">Администратордун кодун киргизиңиз</p>
    <input id="acode" type="password" placeholder="______________" autofocus>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Жок</button><button class="btn primary" id="acOk">Текшерүү</button></div>`);
  const go = async () => {
    if (await sha256($('#acode').value.trim()) === CONFIG.adminCodeHash) { closeModal(); cb(); }
    else { toast('Ката кетти: код туура эмес', true); $('#acode').value = ''; }
  };
  $('#acOk').onclick = go; $('#acode').onkeydown = e => e.key === 'Enter' && go();
}
function confirmBox(text, yes) {
  openModal(`<h3>⚠️ Ырастоо</h3><p>${esc(text)}</p>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Жок</button><button class="btn danger" id="cfYes">Ооба, өчүрүү</button></div>`);
  $('#cfYes').onclick = () => { closeModal(); yes(); };
}

/* ---------- 7. КИРҮҮ / ЧЫГУУ ---------- */
let loginRole = 'viewer';
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  loginRole = b.dataset.role;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
});
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const u = CONFIG.users[$('#loginUser').value.trim().toLowerCase()];
  if (!u || u.role !== loginRole || u.hash !== await sha256($('#loginPass').value)) {
    const f = $('.login-card'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = 'pop .3s';
    return alert('Логин же сыр сөз туура эмес (же ролду туура тандаңыз)');
  }
  sessionStorage.setItem('medrese_role', u.role); startApp(u.role);
};
function logout() { sessionStorage.removeItem('medrese_role'); stopCam(); location.reload(); }

function startApp(role) {
  S.role = role; $('#login').hidden = true; $('#app').hidden = false;
  $('#roleBadge').textContent = isAdmin() ? '👤 Администратор' : '👁 Көрүүчү';
  buildNav(); go(S.page);
}

/* ---------- 8. НАВИГАЦИЯ ---------- */
const NAV = [['dashboard', '🏠', 'Башкы бет'], ['documents', '📁', 'Документтер'], ['students', '👨‍🎓', 'Окуучулар'], ['teachers', '👨‍🏫', 'Устаздар'],
  ['folders', '📂', 'Папкалар'], ['scanner', '📷', 'Сканер'], ['search', '🔍', 'Издөө'], ['archive', '🗃', 'Архив'], ['settings', '⚙️', 'Орнотуулар']];
function buildNav() {
  $('#nav').innerHTML = NAV.map(([id, i, t]) => `<button data-p="${id}">${i} ${t}</button>`).join('') + `<button data-p="logout">🚪 Чыгуу</button>`;
  $('#nav').onclick = e => { const p = e.target.dataset.p; if (p === 'logout') logout(); else if (p === 'search') { go('documents'); $('#search').focus(); } else if (p) go(p); };
}
function go(page) {
  if (page !== 'scanner') stopCam();
  S.page = page; closeSide();
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'p-' + page));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.p === page));
  render();
}
const openSide = () => { $('#sidebar').classList.add('open'); $('#backdrop').classList.add('show'); };
const closeSide = () => { $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('show'); };
$('#burger').onclick = openSide; $('#backdrop').onclick = closeSide;

function render() {
  ({ dashboard: rDash, documents: rDocs, students: () => rPeople('student'), teachers: () => rPeople('teacher'),
     folders: rFolders, scanner: rScanner, archive: rArchive, settings: rSettings })[S.page]();
}

/* ---------- 9. ДАШБОРД ---------- */
function rDash() {
  const live = API.db.docs.filter(d => !d.archived);
  const st = [['📁', 'Бардык документтер', live.length], ['👨‍🎓', 'Окуучулар', live.filter(d => d.category === 'student').length],
    ['👨‍🏫', 'Устаздар', live.filter(d => d.category === 'teacher').length], ['📅', 'Бүгүн кошулган', live.filter(d => d.date === today()).length],
    ['🗃', 'Архивде', API.db.docs.length - live.length]];
  const recent = [...live].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $('#p-dashboard').innerHTML = `<div class="page-head"><h2>Башкы бет</h2>${addBtn()}</div>
    <div class="cards">${st.map(([i, t, n]) => `<div class="card stat">${i} ${t}<b>${n}</b></div>`).join('')}</div>
    <h3 style="margin-bottom:10px">Акыркы документтер</h3>${docTable(recent)}`;
}
const addBtn = () => isAdmin() ? `<button class="btn primary" onclick="docForm()">＋ Документ кошуу</button>` : '';

/* ---------- 10. ДОКУМЕНТТЕР: ТАБЛИЦА, ИЗДӨӨ, ФИЛЬТР ---------- */
function filtered() {
  const q = S.q.toLowerCase(), now = new Date(), t = today();
  return API.db.docs.filter(d => {
    if (d.archived) return false;
    const owner = ownerName(d).toLowerCase();
    if (q && ![owner, d.title, d.type, catName(d.category)].some(v => v.toLowerCase().includes(q))) return false;
    if (S.fCat !== 'all' && d.category !== S.fCat) return false;
    if (S.fType !== 'all' && d.type !== S.fType) return false;
    const age = (now - new Date(d.date)) / 864e5;
    if (S.fDate === 'today' && d.date !== t) return false;
    if (S.fDate === 'week' && age > 7) return false;
    if (S.fDate === 'month' && age > 31) return false;
    return true;
  });
}
const ownerName = d => API.person(d.personId)?.name || '—';
const catName = c => ({ student: 'Окуучу', teacher: 'Устаз', other: 'Башка' }[c]);
const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('');

function rDocs() {
  $('#p-documents').innerHTML = `<div class="page-head"><h2>Документтер</h2>${addBtn()}</div>
    <div class="filters">
      <select id="fCat">${opt([['all', 'Категория: Бардыгы'], ['student', 'Окуучу'], ['teacher', 'Устаз'], ['other', 'Башка']], S.fCat)}</select>
      <select id="fType">${opt([['all', 'Түрү: Бардыгы'], ...CONFIG.docTypes.map(t => [t, t])], S.fType)}</select>
      <select id="fDate">${opt([['all', 'Дата: Баары'], ['today', 'Бүгүн'], ['week', 'Бул жума'], ['month', 'Бул ай']], S.fDate)}</select>
    </div><div id="docList"></div>`;
  ['fCat', 'fType', 'fDate'].forEach(id => $('#' + id).onchange = e => { S[id] = e.target.value; $('#docList').innerHTML = docTable(filtered()); });
  $('#docList').innerHTML = docTable(filtered());
}
function docTable(list, mode = 'docs') {
  if (!list.length) return emptyState(mode === 'archive' ? 'Архив бош' : 'Документтер азырынча кошула элек');
  const stc = s => s === 'Активдүү' ? '' : s === 'Архивде' ? 'a' : 'w';
  const acts = d => mode === 'archive'
    ? (isAdmin() ? `<button class="btn sm" title="Калыбына келтирүү" onclick="restoreDoc('${d.id}')">♻️</button><button class="btn sm" title="Толугу менен өчүрүү" onclick="purgeDoc('${d.id}')">🗑</button>` : '—')
    : `<button class="btn sm" title="Көрүү" onclick="viewDoc('${d.id}')">👁</button><button class="btn sm" title="Жүктөө" onclick="downloadDoc('${d.id}')">📥</button>`
      + (isAdmin() ? `<button class="btn sm" title="Өзгөртүү" onclick="editDoc('${d.id}')">✏️</button><button class="btn sm" title="Өчүрүү" onclick="deleteDoc('${d.id}')">🗑</button>` : '');
  return `<div class="table-wrap"><table><thead><tr><th>№</th><th>Документтин аталышы</th><th>Адамдын аты-жөнү</th><th>Категория</th><th>Түрү</th><th>Дата</th><th>Статус</th><th>Аракеттер</th></tr></thead><tbody>
    ${list.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.title)}</td><td>${esc(ownerName(d))}</td><td>${catName(d.category)}</td><td>${esc(d.type)}</td><td>${d.date}</td><td><span class="st ${stc(d.status)}">${esc(d.status)}</span></td><td class="actions">${acts(d)}</td></tr>`).join('')}</tbody></table></div>`;
}
const emptyState = (t, withBtn = true) => `<div class="empty"><div class="e">📂</div><p>${t}</p>${withBtn && isAdmin() ? `<button class="btn primary" onclick="docForm()">＋ Документ кошуу</button>` : ''}</div>`;

// Издөө талаасы
$('#search').oninput = e => { S.q = e.target.value; if (S.page !== 'documents') go('documents'); else $('#docList').innerHTML = docTable(filtered()); };

/* ---------- 11. ОКУУЧУЛАР / УСТАЗДАР ---------- */
function rPeople(type) {
  const list = API.db.people.filter(p => p.type === type), s = type === 'student';
  $('#p-' + type + 's').innerHTML = `<div class="page-head"><h2>${s ? 'Окуучулар' : 'Устаздар'}</h2>
    ${isAdmin() ? `<button class="btn primary" onclick="personForm('${type}')">＋ ${s ? 'Окуучу' : 'Устаз'} кошуу</button>` : ''}</div>
    ${list.length ? `<div class="cards">${list.map(p => `<div class="card person" onclick="profile('${p.id}')"><div class="ico">${s ? '👨‍🎓' : '👨‍🏫'}</div><b>${esc(p.name)}</b>
      <div class="muted">${esc(s ? p.joined : p.subject)}</div><code>${folderOf(p)}</code><div>📄 ${API.db.docs.filter(d => d.personId === p.id && !d.archived).length} документ</div></div>`).join('')}</div>` : emptyState('Азырынча эч ким жок', false)}`;
}
function profile(id) {
  const p = API.person(id), s = p.type === 'student', docs = API.db.docs.filter(d => d.personId === id && !d.archived);
  openModal(`<h3>${s ? '👨‍🎓' : '👨‍🏫'} ${esc(p.name)}</h3><code>${folderOf(p)}</code>
    <div class="meta">${s ? `<div><span>Туулган жылы</span>${esc(p.birth)}</div>` : `<div><span>Предмети</span>${esc(p.subject)}</div>`}
    <div><span>Телефон</span>${esc(p.phone)}</div><div><span>Дареги</span>${esc(p.address)}</div>
    <div><span>${s ? 'Окууга кирген' : 'Ишке кирген'}</span>${esc(p.joined)}</div><div><span>Статус</span>${esc(p.status)}</div></div>
    <h4>Документтер (${docs.length})</h4>
    ${docs.length ? docs.map(d => `<div class="file">📄 ${esc(d.title)} <button class="btn sm" onclick="viewDoc('${d.id}')">👁</button></div>`).join('') : `<div class="empty"><div class="e">📂</div>Бул папкада азырынча документ жок</div>`}
    <div class="modal-foot">${isAdmin() ? `<button class="btn gold" onclick="docForm(null,'${id}')">＋ Документ</button>` : ''}<button class="btn" onclick="closeModal()">Жабуу</button></div>`, true);
}
function personForm(type) {
  const s = type === 'student';
  openModal(`<h3>＋ ${s ? 'Окуучу' : 'Устаз'} кошуу</h3>
    <label>Аты-жөнү<input id="pn"></label>
    ${s ? `<label>Туулган жылы<input id="pb" type="number" min="1990" max="2025"></label>` : `<label>Предмети<input id="ps"></label>`}
    <label>Телефон<input id="pp"></label><label>Дареги<input id="pa"></label>
    <label>${s ? 'Окууга кирген' : 'Ишке кирген'} датасы<input id="pj" type="date" value="${today()}"></label>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Жок</button><button class="btn primary" id="pOk">Сактоо</button></div>`);
  $('#pOk').onclick = () => {
    const name = $('#pn').value.trim(); if (!name) return toast('Ката кетти: аты-жөнү керек', true);
    API.db.people.push({ id: uid(), type, name, birth: $('#pb')?.value, subject: $('#ps')?.value, phone: $('#pp').value, address: $('#pa').value, joined: $('#pj').value, status: 'Активдүү' });
    API.save(); closeModal(); toast('Жеке папка автоматтык түрдө түзүлдү'); render();
  };
}

/* ---------- 12. ПАПКАЛАР ---------- */
function rFolders() {
  const grp = t => API.db.people.filter(p => p.type === t).map(p => {
    const ds = API.db.docs.filter(d => d.personId === p.id && !d.archived);
    return `<details><summary>📁 ${esc(p.name)} <code>${folderOf(p)}</code></summary>${ds.length ? ds.map(d => `<div class="file">📄 ${esc(d.type)} — ${esc(d.title)}</div>`).join('') : '<div class="file muted">Бул папкада азырынча документ жок</div>'}</details>`;
  }).join('');
  const arch = API.db.docs.filter(d => d.archived);
  $('#p-folders').innerHTML = `<div class="page-head"><h2>Папкалар</h2></div><div class="card">
    <details open><summary>📁 <b>Окуучулар</b> <code>/students/</code></summary>${grp('student')}</details>
    <details open><summary>📁 <b>Устаздар</b> <code>/teachers/</code></summary>${grp('teacher')}</details>
    <details><summary>📁 <b>Архив</b> <code>/archive/</code></summary>${arch.map(d => `<div class="file">📄 ${esc(d.title)}</div>`).join('') || '<div class="file muted">Бош</div>'}</details>
    <details><summary>📁 <b>Башка документтер</b> <code>/other/</code></summary>${API.db.docs.filter(d => d.category === 'other' && !d.archived).map(d => `<div class="file">📄 ${esc(d.title)}</div>`).join('') || '<div class="file muted">Бул папкада азырынча документ жок</div>'}</details></div>`;
}

/* ---------- 13. ДОКУМЕНТ КОШУУ / ӨЗГӨРТҮҮ ---------- */
function docForm(id, personId, blob) {
  if (!isAdmin()) return toast('Ката кетти: уруксат жок', true);
  const d = id ? API.doc(id) : null, pid = d?.personId || personId;
  const cat = d?.category || (pid ? API.person(pid).type : 'student');
  S.pending = blob || null;
  openModal(`<h3>${d ? '✏️ Документти өзгөртүү' : '＋ Документ кошуу'}</h3>
    <label>Адамдын категориясы<select id="fc">${opt([['student', 'Окуучу'], ['teacher', 'Устаз'], ['other', 'Башка']], cat)}</select></label>
    <label>Адамды тандоо<select id="fp"></select></label>
    <label>Документтин түрү<select id="ft">${opt(CONFIG.docTypes.map(t => [t, t]), d?.type)}</select></label>
    <label>Документтин аталышы<input id="fti" value="${esc(d?.title)}"></label>
    <label>Документтин номери<input id="fn" value="${esc(d?.number)}"></label>
    <label>Комментарий<textarea id="fcm" rows="2">${esc(d?.comment)}</textarea></label>
    ${d ? `<label>Статус<select id="fs">${opt(CONFIG.statuses.map(t => [t, t]), d.status)}</select></label>` : `<label>Файл (PDF, JPG, PNG)<input id="ff" type="file" accept=".pdf,.jpg,.jpeg,.png" ${blob ? 'hidden' : ''}></label>${blob ? '<p>📎 Сканерленген сүрөт тиркелди</p>' : ''}`}
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Жок</button><button class="btn primary" id="fOk">Сактоо</button></div>`);
  const fill = () => {
    const c = $('#fc').value, ppl = API.db.people.filter(p => p.type === c);
    $('#fp').disabled = c === 'other';
    $('#fp').innerHTML = c === 'other' ? '<option value="">—</option>' : opt(ppl.map(p => [p.id, p.name]), pid);
  };
  $('#fc').onchange = fill; fill();
  $('#fOk').onclick = () => saveDoc(d);
}
async function saveDoc(d) {
  try {
    const title = $('#fti').value.trim(), cat = $('#fc').value, personId = cat === 'other' ? null : $('#fp').value;
    if (!title) return toast('Ката кетти: аталышы керек', true);
    if (cat !== 'other' && !personId) return toast('Ката кетти: адамды тандаңыз', true);
    const f = {};
    Object.assign(f, { title, category: cat, personId, type: $('#ft').value, number: $('#fn').value, comment: $('#fcm').value });
    if (d) { Object.assign(d, f, { status: $('#fs').value, archived: $('#fs').value === 'Архивде' }); toast('Документ ийгиликтүү өзгөртүлдү'); }
    else {
      const file = S.pending || $('#ff').files[0];
      let fileKey = null, mime = '';
      if (file) {
        mime = file.type;
        if (!CONFIG.allowed.includes(mime)) return toast('Ката кетти: PDF, JPG, PNG гана', true);
        if (file.size > CONFIG.maxFileMB * 1048576) return toast('Ката кетти: файл өтө чоң', true);
        fileKey = uid(); await API.putFile(fileKey, file);
      }
      API.db.docs.push({ id: uid(), ...f, date: today(), status: 'Активдүү', archived: false, fileKey, mime });
      toast('Документ ийгиликтүү кошулду');
    }
    S.pending = null; API.save(); closeModal(); render();
  } catch (e) { console.error(e); toast('Ката кетти', true); }
}
const editDoc = id => isAdmin() && askCode(() => docForm(id));

/* ---------- 14. ӨЧҮРҮҮ → АРХИВ → КАЛЫБЫНА КЕЛТИРҮҮ / ТОЛУК ӨЧҮРҮҮ ---------- */
const deleteDoc = id => isAdmin() && askCode(() => confirmBox('Бул документти чындап өчүрүүнү каалайсызбы?', () => {
  const d = API.doc(id); d.archived = true; d.status = 'Архивде'; API.save(); toast('Документ архивге өткөрүлдү'); render();
}));
const restoreDoc = id => isAdmin() && askCode(() => { const d = API.doc(id); d.archived = false; d.status = 'Активдүү'; API.save(); toast('Документ калыбына келтирилди'); render(); });
const purgeDoc = id => isAdmin() && askCode(() => confirmBox('Документ биротоло өчүрүлөт. Улантасызбы?', async () => {
  const d = API.doc(id); if (d.fileKey) await API.delFile(d.fileKey);
  API.db.docs = API.db.docs.filter(x => x.id !== id); API.save(); toast('Документ толугу менен өчүрүлдү'); render();
}));
function rArchive() {
  $('#p-archive').innerHTML = `<div class="page-head"><h2>🗃 Архив</h2></div>${docTable(API.db.docs.filter(d => d.archived), 'archive')}`;
}

/* ---------- 15. КӨРҮҮ ЖАНА ЖҮКТӨӨ ---------- */
async function viewDoc(id) {
  const d = API.doc(id), blob = d.fileKey ? await API.getFile(d.fileKey) : null;
  let body;
  if (!blob) body = `<div class="empty"><div class="e">📄</div>Бул демо документте файл жок (файл жүктөлө элек)</div>`;
  else {
    const url = URL.createObjectURL(blob);
    body = d.mime === 'application/pdf' ? `<iframe class="preview" src="${url}"></iframe>` : `<img class="preview" src="${url}" alt="">`;
  }
  openModal(`<h3>${esc(d.title)}</h3>${body}<div class="meta">
    <div><span>Ээси</span>${esc(ownerName(d))}</div><div><span>Категориясы</span>${catName(d.category)}</div><div><span>Кошулган күнү</span>${d.date}</div>
    <div><span>Файлдын түрү</span>${esc(d.mime || '—')}</div><div><span>Статусу</span>${esc(d.status)}</div></div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Жабуу</button></div>`, true);
}
async function downloadDoc(id) {
  const d = API.doc(id), blob = d.fileKey ? await API.getFile(d.fileKey) : null;
  if (!blob) return toast('Ката кетти: файл жок (демо документ)', true);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = d.title + '.' + (d.mime.split('/')[1] === 'jpeg' ? 'jpg' : d.mime.split('/')[1]); a.click();
}

/* ---------- 16. СКАНЕР (камера API + файл fallback) ---------- */
function rScanner() {
  $('#p-scanner').innerHTML = `<div class="page-head"><h2>📷 Сканер</h2></div><div class="card scan" id="scanBox">
    <p class="muted">Документти камерага көрсөтүп, сүрөткө тартыңыз.</p>
    <button class="btn primary" id="camStart" style="font-size:18px;padding:14px 28px">📷 Документти сканерлөө</button>
    <div id="camArea"></div>
    <div class="drop">📎 Же сканерленген файлды жүктөңүз (PDF/JPG/PNG)<input id="scanFile" type="file" accept=".pdf,.jpg,.jpeg,.png"></div></div>`;
  $('#camStart').onclick = startCam;
  $('#scanFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (!CONFIG.allowed.includes(f.type)) return toast('Ката кетти: PDF, JPG, PNG гана', true);
    if (!isAdmin()) return toast('Ката кетти: сактоо үчүн администратор керек', true);
    docForm(null, null, f);
  };
}
async function startCam() {
  const area = $('#camArea');
  if (!navigator.mediaDevices?.getUserMedia) return camFail();
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    area.innerHTML = `<video id="cam" autoplay playsinline></video><button class="btn gold" id="snap">📸 Сүрөткө тартуу</button>`;
    $('#cam').srcObject = S.stream; $('#snap').onclick = snap;
  } catch (e) { camFail(); }
}
const camFail = () => $('#camArea').innerHTML = `<div class="card" style="margin-top:14px;border-color:var(--red)">⚠️ Камерага уруксат берилген жок. Файлды жүктөө аркылуу сканерленген документти кошсоңуз болот.</div>`;
function stopCam() { S.stream?.getTracks().forEach(t => t.stop()); S.stream = null; }
function snap() {
  const v = $('#cam'), c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  c.toBlob(b => {
    S.scanBlob = b; stopCam();
    $('#camArea').innerHTML = `<img class="pv" src="${URL.createObjectURL(b)}" alt="Preview">
      <button class="btn" id="retake">🔄 Кайра тартуу</button> <button class="btn primary" id="accept">✅ Кабыл алуу</button>`;
    $('#retake').onclick = startCam;
    $('#accept').onclick = () => {
      $('#camArea').insertAdjacentHTML('beforeend', `<p><button class="btn gold" id="saveScan">💾 Документти сактоо</button></p>`);
      $('#saveScan').onclick = () => isAdmin() ? docForm(null, null, new File([S.scanBlob], 'scan.jpg', { type: 'image/jpeg' })) : toast('Ката кетти: сактоо үчүн администратор керек', true);
    };
  }, 'image/jpeg', .92);
}

/* ---------- 17. ОРНОТУУЛАР ---------- */
function rSettings() {
  $('#p-settings').innerHTML = `<div class="page-head"><h2>⚙️ Орнотуулар</h2></div><div class="card">
    <p>Роль: <b>${isAdmin() ? 'Администратор' : 'Көрүүчү'}</b></p>
    <p class="muted">Маалымат браузердин localStorage (метамаалымат) жана IndexedDB (файлдар) ичинде сакталат.</p>
    ${isAdmin() ? `<button class="btn danger" id="reset">Демо маалыматты баштапкы абалга келтирүү</button>` : ''}</div>`;
  if (isAdmin()) $('#reset').onclick = () => askCode(() => confirmBox('Бардык маалымат өчүп, демо кайра жүктөлөт. Улантасызбы?', () => { localStorage.removeItem('medrese_db'); indexedDB.deleteDatabase('medrese_files'); location.reload(); }));
}

/* ---------- 18. ТЕМА / БИЛДИРҮҮ ТИЗМЕСИ ---------- */
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('medrese_theme', t); $('#theme').textContent = t === 'dark' ? '☀️' : '🌙'; }
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#bell').onclick = () => {
  S.unread = 0; renderBell();
  openModal(`<h3>🔔 Билдирүүлөр</h3>${API.db.notes.map(n => `<p style="color:${n.err ? 'var(--red)' : 'inherit'}">• ${esc(n.msg)} <span class="muted">${n.at}</span></p>`).join('') || '<p class="muted">Билдирүү жок</p>'}
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Жабуу</button></div>`);
};

/* ---------- 19. ИШКЕ КИРГИЗҮҮ ---------- */
(async () => {
  setTheme(localStorage.getItem('medrese_theme') || 'light');
  try { await API.init(); } catch (e) { return alert('Сактагыч иштебей жатат: ' + e); }
  const r = sessionStorage.getItem('medrese_role'); if (r) startApp(r);
})();
