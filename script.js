// ----- Telegram WebApp -----
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.MainButton.hide();
  tg.enableClosingConfirmation();
}

// Замените на URL вашего API (VPS IP или домен)
const API_URL = 'http://your-vps-ip:3000';

const CATEGORIES = ["Ассеты", "Плагины", "Шрифты", "Premiere Pro", "Photoshop"];
const generateSubcats = (cat) => Array.from({ length: 8 }, (_, i) => `${cat} • ${i + 1}`);
const generateItems = (cat, sub) => {
  return Array.from({ length: 12 }, (_, i) => {
    const id = `${cat}|${sub}|item${i + 1}`;
    const seed = encodeURIComponent(id);
    const type = (i % 3 === 0) ? "video" : (i % 3 === 1 ? "photo" : "document");
    const fileUrl = type === "video"
      ? `https://filesamples.com/samples/video/mp4/sample_640x360.mp4`
      : `https://picsum.photos/seed/${seed}/800/600`;

    return {
      id, type, fileUrl,
      title: `${sub} — ${i + 1}`,
      seconds: 2 + (i % 7),
      size: 500 + (i * 100),
      category: cat,
      subcategory: sub,
      preview: `https://picsum.photos/seed/${seed}-thumb/600/380`
    };
  });
};

// ----- DOM -----
const $cats = document.getElementById('categories');
const $subs = document.getElementById('subcategories');
const $grid = document.getElementById('grid');
const $search = document.getElementById('searchInput');
const $sort = document.getElementById('sortSelect');
const $close = document.getElementById('tgClose');

const $sendBar = document.createElement('div');
$sendBar.className = 'send-bar hidden';
$sendBar.innerHTML = `<button id="sendBtn">Отправить ассеты 0/0</button>`;
document.body.appendChild($sendBar);
const $sendBtn = document.getElementById('sendBtn');

// ----- Состояние -----
let state = {
  currentCat: CATEGORIES[0],
  currentSub: generateSubcats(CATEGORIES[0])[0],
  items: [],
  selected: new Map(),
  dailyUsed: 0,
  dailyLimit: 3,
  bulkLimit: 3,
  hasSubscription: false,
  statusLoaded: false
};

/**
 * Загрузка статуса пользователя через API
 */
async function loadUserStatus() {
  try {
    const initData = tg?.initData || '';
    
    if (!initData) {
      console.warn('⚠️ initData недоступна, используем заглушку');
      loadFakeStatus(false);
      return;
    }

    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    const user = userJson ? JSON.parse(userJson) : null;
    const userId = user?.id;

    if (!userId) {
      console.warn('⚠️ userId не найден, используем заглушку');
      loadFakeStatus(false);
      return;
    }

    // Запрос к API
    const response = await fetch(`${API_URL}/api/status/${userId}`);
    
    if (!response.ok) {
      throw new Error('API request failed');
    }

    const result = await response.json();
    
    if (result.success) {
      const data = result.data;
      state.hasSubscription = data.hasSubscription;
      state.dailyUsed = data.dailyUsed;
      state.dailyLimit = data.dailyLimit;
      state.bulkLimit = data.bulkLimit;
      state.statusLoaded = true;
      
      console.log('✅ Статус загружен:', data);
      updateSendBar();
    } else {
      throw new Error('Invalid API response');
    }

  } catch (err) {
    console.error('❌ Ошибка загрузки статуса:', err);
    loadFakeStatus(false);
  }
}

/**
 * Заглушка (для локальной разработки без API)
 */
function loadFakeStatus(hasSubscription = false) {
  state.hasSubscription = hasSubscription;
  state.dailyUsed = 0;
  if (hasSubscription) {
    state.dailyLimit = 100;
    state.bulkLimit = 20;
  } else {
    state.dailyLimit = 3;
    state.bulkLimit = 3;
  }
  state.statusLoaded = true;
  console.log('⚠️ Используется заглушка статуса');
  updateSendBar();
}

// ----- Рендер -----
function renderCategories() {
  $cats.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = cat;
    if (cat === state.currentCat) btn.style.background = '#1877f2';
    if (cat === state.currentCat) btn.style.color = '#fff';
    btn.addEventListener('click', () => {
      state.currentCat = cat;
      state.currentSub = generateSubcats(cat)[0];
      renderCategories();
      renderSubcats();
      renderGrid();
    });
    $cats.appendChild(btn);
  });
}

function renderSubcats() {
  $subs.innerHTML = '';
  const subcats = generateSubcats(state.currentCat);
  subcats.forEach(sub => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = sub;
    if (sub === state.currentSub) btn.style.background = '#385898';
    if (sub === state.currentSub) btn.style.color = '#fff';
    btn.addEventListener('click', () => {
      state.currentSub = sub;
      renderSubcats();
      renderGrid();
    });
    $subs.appendChild(btn);
  });
}

function renderGrid() {
  state.items = generateItems(state.currentCat, state.currentSub);

  const query = $search.value.toLowerCase();
  let filtered = state.items.filter(item => item.title.toLowerCase().includes(query));

  const sortValue = $sort.value;
  if (sortValue === 'time-asc') filtered.sort((a, b) => a.seconds - b.seconds);
  if (sortValue === 'time-desc') filtered.sort((a, b) => b.seconds - a.seconds);
  if (sortValue === 'size-asc') filtered.sort((a, b) => a.size - b.size);
  if (sortValue === 'size-desc') filtered.sort((a, b) => b.size - a.size);

  $grid.innerHTML = '';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    if (state.selected.has(item.id)) card.classList.add('selected');

    const isVideo = item.type === 'video';
    const badge = isVideo ? `<span class="badge">${item.seconds}s</span>` : '';

    card.innerHTML = `
      <img class="thumb" src="${item.preview}" alt="${item.title}">
      <div class="select-overlay"></div>
      <div class="meta">
        <div class="title">${item.title}${badge}</div>
        <div class="sub">${item.type} · ${item.size} KB</div>
      </div>
    `;

    card.addEventListener('click', () => toggleSelect(item, card));
    $grid.appendChild(card);
  });
}

function toggleSelect(item, card) {
  if (state.selected.has(item.id)) {
    state.selected.delete(item.id);
    card.classList.remove('selected');
  } else {
    if (state.selected.size >= state.bulkLimit) {
      tg?.showAlert?.(`Можно выбрать максимум ${state.bulkLimit} файлов за раз`);
      return;
    }
    state.selected.set(item.id, item);
    card.classList.add('selected');
  }
  updateSendBar();
}

function updateSendBar() {
  const count = state.selected.size;
  if (count > 0) {
    $sendBar.classList.remove('hidden');
    $sendBtn.textContent = `Отправить ассеты ${count}/${state.bulkLimit}`;
  } else {
    $sendBar.classList.add('hidden');
  }
}

// ----- Отправка -----
$sendBtn.addEventListener('click', () => {
  const toSend = state.selected.size;
  if (!toSend) return;

  if (toSend > state.bulkLimit) {
    tg?.showAlert?.(`Можно отправить не больше ${state.bulkLimit} за раз`);
    return;
  }

  if (state.dailyUsed + toSend > state.dailyLimit) {
    tg?.showAlert?.(`Лимит на сегодня исчерпан (${state.dailyUsed}/${state.dailyLimit})`);
    return;
  }

  const payload = {
    action: 'send_assets_bulk',
    items: Array.from(state.selected.values())
  };

  if (tg) {
    tg.HapticFeedback?.impactOccurred('light');
    console.log("📤 Отправляем данные в Telegram:", payload);
    tg.sendData(JSON.stringify(payload));
    tg.close();
  } else {
    console.log("📤 Данные для отправки:", payload);
    alert('WebApp запущен вне Telegram');
  }

  state.dailyUsed += toSend;
  state.selected.clear();
  updateSendBar();
  renderGrid();
});

// ----- События -----
$search.addEventListener('input', renderGrid);
$sort.addEventListener('change', renderGrid);
$close.addEventListener('click', () => tg?.close?.() || window.close());

// ----- Старт -----
renderCategories();
renderSubcats();
renderGrid();
loadUserStatus();