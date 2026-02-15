/**
 * HackerFeed — script.js
 * Modular vanilla JS · Hacker News Algolia API
 */

'use strict';

/* ═══════════════════════════════════════════════════
   ① CONFIGURATION
   ═══════════════════════════════════════════════════ */
const CONFIG = {
  API_BASE: 'https://hn.algolia.com/api/v1',
  HN_ITEM_URL: 'https://news.ycombinator.com/item?id=',
  PER_PAGE: 12,
  DEBOUNCE_MS: 320,
  TOAST_DURATION: 4000,
  TABS: {
    top:  { label: 'Top Stories',   subtitle: 'Front page picks from Hacker News',       endpoint: '/search?tags=front_page',   icon: 'fa-fire' },
    new:  { label: 'New Stories',   subtitle: 'Latest submissions from the community',    endpoint: '/search_by_date?tags=story', icon: 'fa-bolt' },
    ask:  { label: 'Ask HN',        subtitle: 'Questions and discussions from the community', endpoint: '/search?tags=ask_hn',   icon: 'fa-circle-question' },
    show: { label: 'Show HN',       subtitle: 'Projects and creations shared by hackers', endpoint: '/search?tags=show_hn',    icon: 'fa-eye' },
    jobs: { label: 'Jobs',          subtitle: 'Job listings from HN companies',           endpoint: '/search?tags=job',         icon: 'fa-briefcase' },
  },
  CARD_GRADIENTS: [
    ['#ff6600', '#ff9500'],
    ['#3b82f6', '#06b6d4'],
    ['#8b5cf6', '#ec4899'],
    ['#10b981', '#14b8a6'],
    ['#f59e0b', '#ef4444'],
    ['#6366f1', '#8b5cf6'],
    ['#14b8a6', '#3b82f6'],
    ['#f97316', '#eab308'],
    ['#06b6d4', '#3b82f6'],
    ['#a855f7', '#ec4899'],
    ['#22c55e', '#16a34a'],
    ['#e879f9', '#a855f7'],
  ],
  DOMAIN_ICONS: {
    'github.com': 'fa-brands fa-github',
    'youtube.com': 'fa-brands fa-youtube',
    'twitter.com': 'fa-brands fa-twitter',
    'x.com': 'fa-brands fa-x-twitter',
    'reddit.com': 'fa-brands fa-reddit',
    'medium.com': 'fa-brands fa-medium',
    'arxiv.org': 'fa-file-lines',
    'nytimes.com': 'fa-newspaper',
    'wsj.com': 'fa-newspaper',
    'wired.com': 'fa-bolt',
    'techcrunch.com': 'fa-microchip',
    'arstechnica.com': 'fa-computer',
    'theatlantic.com': 'fa-feather',
    'bloomberg.com': 'fa-chart-line',
    'wikipedia.org': 'fa-book',
  },
};

/* ═══════════════════════════════════════════════════
   ② APP STATE
   ═══════════════════════════════════════════════════ */
const STATE = {
  currentTab:   'top',
  currentPage:  1,
  currentQuery: '',
  isSearchMode: false,
  allStories:   [],
  filteredStories: [],
  bookmarks:    new Map(),
  theme:        'dark',
  viewMode:     'grid',
  isLoading:    false,
  sortBy:       'default',
  lastUpdated:  null,
};

/* ═══════════════════════════════════════════════════
   ③ DOM CACHE
   ═══════════════════════════════════════════════════ */
const DOM = {
  cardsGrid:       () => document.getElementById('cards-grid'),
  pagination:      () => document.getElementById('pagination'),
  prevBtn:         () => document.getElementById('prev-btn'),
  nextBtn:         () => document.getElementById('next-btn'),
  pageNumbers:     () => document.getElementById('page-numbers'),
  noResults:       () => document.getElementById('no-results'),
  noResultsMsg:    () => document.getElementById('no-results-msg'),
  noResultsReset:  () => document.getElementById('no-results-reset'),
  errorState:      () => document.getElementById('error-state'),
  errorMessage:    () => document.getElementById('error-message'),
  errorRetry:      () => document.getElementById('error-retry'),
  searchInput:     () => document.getElementById('search-input'),
  searchClear:     () => document.getElementById('search-clear'),
  themeToggle:     () => document.getElementById('theme-toggle'),
  themeIcon:       () => document.getElementById('theme-icon'),
  tabBtns:         () => document.querySelectorAll('.tab-btn'),
  pageTitle:       () => document.getElementById('page-title'),
  pageSubtitle:    () => document.getElementById('page-subtitle'),
  resultsCount:    () => document.getElementById('results-count'),
  lastUpdated:     () => document.getElementById('last-updated'),
  statsBar:        () => document.getElementById('stats-bar'),
  scrollTopBtn:    () => document.getElementById('scroll-top-btn'),
  toastContainer:  () => document.getElementById('toast-container'),
  bookmarkToggle:  () => document.getElementById('bookmark-toggle'),
  bookmarkCount:   () => document.getElementById('bookmark-count'),
  bookmarksPanel:  () => document.getElementById('bookmarks-panel'),
  bookmarksList:   () => document.getElementById('bookmarks-list'),
  bookmarksClear:  () => document.getElementById('bookmarks-clear'),
  bookmarksClose:  () => document.getElementById('bookmarks-close'),
  viewGrid:        () => document.getElementById('view-grid'),
  viewList:        () => document.getElementById('view-list'),
  sortSelect:      () => document.getElementById('sort-select'),
  navbar:          () => document.getElementById('navbar'),
  mainContent:     () => document.querySelector('.main-content'),
};

/* ═══════════════════════════════════════════════════
   ④ API MODULE
   ═══════════════════════════════════════════════════ */
const API = {
  async fetch(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  },

  buildUrl(tab, page = 0, hitsPerPage = 50) {
    const { endpoint } = CONFIG.TABS[tab];
    const base = CONFIG.API_BASE + endpoint;
    const sep  = base.includes('?') ? '&' : '?';
    return `${base}${sep}page=${page}&hitsPerPage=${hitsPerPage}`;
  },

  buildSearchUrl(query, page = 0, hitsPerPage = 50) {
    const q = encodeURIComponent(query.trim());
    return `${CONFIG.API_BASE}/search?query=${q}&tags=story&page=${page}&hitsPerPage=${hitsPerPage}`;
  },

  normalizeHit(hit) {
    return {
      id:         hit.objectID || '',
      title:      hit.title || hit.story_title || 'Untitled',
      author:     hit.author || hit.username || 'unknown',
      points:     hit.points || 0,
      comments:   hit.num_comments || 0,
      url:        hit.url || `${CONFIG.HN_ITEM_URL}${hit.objectID}`,
      createdAt:  hit.created_at || hit.created_at_i
                    ? new Date(hit.created_at || hit.created_at_i * 1000)
                    : new Date(),
      discussionUrl: `${CONFIG.HN_ITEM_URL}${hit.objectID}`,
    };
  },

  async getStories(tab) {
    const data = await this.fetch(this.buildUrl(tab));
    return (data.hits || []).map(this.normalizeHit);
  },

  async searchStories(query) {
    const data = await this.fetch(this.buildSearchUrl(query));
    return (data.hits || []).map(this.normalizeHit);
  },
};

/* ═══════════════════════════════════════════════════
   ⑤ UTILITIES
   ═══════════════════════════════════════════════════ */
const Utils = {
  timeAgo(date) {
    const now    = Date.now();
    const then   = date instanceof Date ? date.getTime() : new Date(date).getTime();
    const diff   = Math.floor((now - then) / 1000);
    if (diff < 60)          return `${diff}s ago`;
    if (diff < 3600)        return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400)       return `${Math.floor(diff/3600)}h ago`;
    if (diff < 2592000)     return `${Math.floor(diff/86400)}d ago`;
    if (diff < 31536000)    return `${Math.floor(diff/2592000)}mo ago`;
    return `${Math.floor(diff/31536000)}y ago`;
  },

  getDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch { return ''; }
  },

  getGradient(id) {
    const idx = parseInt(id, 10);
    const i   = isNaN(idx) ? 0 : Math.abs(idx) % CONFIG.CARD_GRADIENTS.length;
    return CONFIG.CARD_GRADIENTS[i];
  },

  getDomainIcon(url) {
    const domain = this.getDomain(url);
    for (const [key, icon] of Object.entries(CONFIG.DOMAIN_ICONS)) {
      if (domain.includes(key)) return icon;
    }
    return 'fa-globe';
  },

  formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0','') + 'k';
    return String(n);
  },

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  escapeHtml(str) {
    const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  },

  pluralize(n, word) {
    return `${this.formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
  },

  nowFormatted() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  sortStories(stories, sortBy) {
    const cloned = [...stories];
    switch (sortBy) {
      case 'points':   return cloned.sort((a, b) => b.points   - a.points);
      case 'comments': return cloned.sort((a, b) => b.comments - a.comments);
      case 'time':     return cloned.sort((a, b) => b.createdAt - a.createdAt);
      default:         return cloned;
    }
  },
};

/* ═══════════════════════════════════════════════════
   ⑥ TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════ */
const Toast = {
  ICONS: {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info',
    warning: 'fa-triangle-exclamation',
  },

  show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const container = DOM.toastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <div class="toast-icon">
        <i class="fa-solid ${this.ICONS[type] || this.ICONS.info}"></i>
      </div>
      <span class="toast-msg">${Utils.escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Dismiss notification">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="toast-progress" style="animation-duration: ${duration}ms; color: var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'accent-2'})"></div>
    `;

    const close = () => {
      el.classList.add('hiding');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };

    el.querySelector('.toast-close').addEventListener('click', close);
    container.appendChild(el);
    setTimeout(close, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error', 6000),
  info:    (msg) => Toast.show(msg, 'info'),
  warning: (msg) => Toast.show(msg, 'warning'),
};

/* ═══════════════════════════════════════════════════
   ⑦ BOOKMARK MODULE
   ═══════════════════════════════════════════════════ */
const Bookmarks = {
  STORAGE_KEY: 'hf_bookmarks_v2',

  load() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        STATE.bookmarks = new Map(data);
      }
    } catch { STATE.bookmarks = new Map(); }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...STATE.bookmarks]));
    } catch { Toast.error('Could not save bookmark.'); }
  },

  toggle(story) {
    if (STATE.bookmarks.has(story.id)) {
      STATE.bookmarks.delete(story.id);
      Toast.info(`Removed "${story.title.slice(0, 40)}..." from bookmarks`);
    } else {
      STATE.bookmarks.set(story.id, {
        id:         story.id,
        title:      story.title,
        url:        story.url,
        author:     story.author,
        points:     story.points,
        comments:   story.comments,
        createdAt:  story.createdAt,
        discussionUrl: story.discussionUrl,
        savedAt:    new Date().toISOString(),
      });
      Toast.success('Bookmarked! ✓');
    }
    this.save();
    this.updateCount();
    this.renderPanel();
    UI.updateBookmarkButtons();
  },

  isBookmarked: (id) => STATE.bookmarks.has(id),

  updateCount() {
    const count = STATE.bookmarks.size;
    const el    = DOM.bookmarkCount();
    el.textContent = count;
    if (count > 0) { el.removeAttribute('hidden'); }
    else           { el.setAttribute('hidden', ''); }
  },

  renderPanel() {
    const list = DOM.bookmarksList();
    if (STATE.bookmarks.size === 0) {
      list.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--text-tertiary)">
          <i class="fa-regular fa-bookmark" style="font-size:32px;display:block;margin-bottom:12px"></i>
          <p style="font-size:14px;margin-bottom:6px">No bookmarks yet</p>
          <span style="font-size:12px">Click the bookmark icon on any story</span>
        </div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const [, bm] of [...STATE.bookmarks].reverse()) {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.dataset.id = bm.id;
      item.innerHTML = `
        <div class="bookmark-title">${Utils.escapeHtml(bm.title)}</div>
        <div class="bookmark-meta">
          <span><i class="fa-solid fa-arrow-up" style="color:var(--accent)"></i> ${bm.points}</span>
          <span><i class="fa-regular fa-comment" style="color:var(--accent-2)"></i> ${bm.comments}</span>
          <span>${Utils.timeAgo(bm.createdAt)}</span>
          <button class="bookmark-remove" data-id="${bm.id}" aria-label="Remove bookmark" title="Remove">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>`;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-remove')) return;
        window.open(bm.url, '_blank', 'noopener,noreferrer');
      });
      frag.appendChild(item);
    }
    list.innerHTML = '';
    list.appendChild(frag);

    list.querySelectorAll('.bookmark-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const bm = STATE.bookmarks.get(id);
        if (bm) {
          STATE.bookmarks.delete(id);
          this.save();
          this.updateCount();
          this.renderPanel();
          UI.updateBookmarkButtons();
          Toast.info('Bookmark removed');
        }
      });
    });
  },

  clearAll() {
    if (STATE.bookmarks.size === 0) return;
    STATE.bookmarks.clear();
    this.save();
    this.updateCount();
    this.renderPanel();
    UI.updateBookmarkButtons();
    Toast.info('All bookmarks cleared');
  },
};

/* ═══════════════════════════════════════════════════
   ⑧ THEME MODULE
   ═══════════════════════════════════════════════════ */
const Theme = {
  STORAGE_KEY: 'hf_theme',

  load() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    STATE.theme  = saved === 'light' ? 'light' : 'dark';
    this.apply();
  },

  toggle() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.STORAGE_KEY, STATE.theme);
    this.apply();
  },

  apply() {
    document.documentElement.setAttribute('data-theme', STATE.theme);
    const icon = DOM.themeIcon();
    if (STATE.theme === 'dark') {
      icon.className = 'fa-solid fa-moon';
    } else {
      icon.className = 'fa-solid fa-sun';
    }
  },
};

/* ═══════════════════════════════════════════════════
   ⑨ UI RENDERER
   ═══════════════════════════════════════════════════ */
const UI = {
  /* ── Skeleton ────────────────────────────────────── */
  renderSkeletons(count = CONFIG.PER_PAGE) {
    const grid = DOM.cardsGrid();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'skeleton-card';
      card.innerHTML = `
        <div class="skeleton-banner"></div>
        <div class="skeleton-body">
          <div class="skeleton-line w-30"></div>
          <div class="skeleton-line w-90"></div>
          <div class="skeleton-line w-80"></div>
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-40" style="margin-top:14px"></div>
        </div>
        <div class="skeleton-footer"></div>`;
      frag.appendChild(card);
    }
    grid.innerHTML = '';
    grid.appendChild(frag);
    DOM.pagination().setAttribute('hidden', '');
    DOM.noResults().setAttribute('hidden', '');
    DOM.errorState().setAttribute('hidden', '');
  },

  /* ── Single Card ─────────────────────────────────── */
  buildCard(story, rank) {
    const [c1, c2]    = Utils.getGradient(story.id);
    const domain      = Utils.getDomain(story.url);
    const domainIcon  = Utils.getDomainIcon(story.url);
    const timeStr     = Utils.timeAgo(story.createdAt);
    const isBookmarked = Bookmarks.isBookmarked(story.id);
    const bmClass     = isBookmarked ? 'bookmarked' : '';
    const bmIcon      = isBookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

    const card = document.createElement('article');
    card.className = 'story-card';
    card.dataset.id = story.id;
    card.style.setProperty('--card-accent', c1);

    card.innerHTML = `
      <div class="card-accent-strip"></div>
      <div class="card-body">
        ${domain ? `
          <div class="card-domain">
            <i class="${domainIcon}"></i>
            ${Utils.escapeHtml(domain)}
          </div>` : ''}
        <a href="${Utils.escapeHtml(story.url)}"
           class="card-title"
           target="_blank"
           rel="noopener noreferrer"
           title="${Utils.escapeHtml(story.title)}"
        >${Utils.escapeHtml(story.title)}</a>
        <div class="card-meta">
          <div class="card-meta-item meta-points">
            <i class="fa-solid fa-arrow-up"></i>
            <span>${Utils.formatNumber(story.points)}</span>
          </div>
          <div class="card-meta-item meta-comments">
            <i class="fa-regular fa-comment"></i>
            <span>${Utils.formatNumber(story.comments)}</span>
          </div>
          <div class="card-meta-item meta-time">
            <i class="fa-regular fa-clock"></i>
            <span>${timeStr}</span>
          </div>
          <div class="card-meta-item meta-author">
            <i class="fa-regular fa-user"></i>
            <span>${Utils.escapeHtml(story.author)}</span>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <div class="card-actions">
          <a href="${Utils.escapeHtml(story.discussionUrl)}"
             class="btn-discussion"
             target="_blank"
             rel="noopener noreferrer"
             aria-label="View discussion on Hacker News"
          >
            <i class="fa-brands fa-hacker-news"></i>
            View Discussion
          </a>
          <button class="btn-bookmark ${bmClass}"
                  data-id="${story.id}"
                  aria-label="${isBookmarked ? 'Remove bookmark' : 'Add bookmark'}"
                  title="${isBookmarked ? 'Remove bookmark' : 'Bookmark this story'}"
          >
            <i class="${bmIcon}"></i>
          </button>
        </div>
        <span class="card-rank">#${rank}</span>
      </div>`;

    return card;
  },

  /* ── Cards Grid ──────────────────────────────────── */
  renderCards(stories) {
    const grid = DOM.cardsGrid();
    const frag = document.createDocumentFragment();
    const sorted = Utils.sortStories(stories, STATE.sortBy);
    const start  = (STATE.currentPage - 1) * CONFIG.PER_PAGE;
    const end    = start + CONFIG.PER_PAGE;
    const page   = sorted.slice(start, end);

    if (page.length === 0) {
      this.showNoResults();
      return;
    }

    page.forEach((story, i) => {
      frag.appendChild(this.buildCard(story, start + i + 1));
    });

    grid.innerHTML = '';
    grid.appendChild(frag);
    DOM.noResults().setAttribute('hidden', '');
    DOM.errorState().setAttribute('hidden', '');

    // Apply view mode classes
    if (STATE.viewMode === 'list') {
      grid.classList.add('list-view');
    } else {
      grid.classList.remove('list-view');
    }

    this.renderPagination(Math.ceil(sorted.length / CONFIG.PER_PAGE));
    this.updateStats(sorted.length);
  },

  /* ── Pagination ──────────────────────────────────── */
  renderPagination(totalPages) {
    const paginationEl = DOM.pagination();
    const numbersEl    = DOM.pageNumbers();
    const prevBtn      = DOM.prevBtn();
    const nextBtn      = DOM.nextBtn();

    if (totalPages <= 1) {
      paginationEl.setAttribute('hidden', '');
      return;
    }
    paginationEl.removeAttribute('hidden');

    prevBtn.disabled = STATE.currentPage <= 1;
    nextBtn.disabled = STATE.currentPage >= totalPages;

    // Build page numbers with ellipsis
    const pages = this.buildPageRange(STATE.currentPage, totalPages);
    const frag  = document.createDocumentFragment();

    pages.forEach(p => {
      if (p === '...') {
        const el = document.createElement('span');
        el.className = 'page-ellipsis';
        el.textContent = '···';
        frag.appendChild(el);
      } else {
        const btn = document.createElement('button');
        btn.className = `page-num${p === STATE.currentPage ? ' active' : ''}`;
        btn.textContent = p;
        btn.dataset.page = p;
        btn.setAttribute('aria-label', `Page ${p}`);
        if (p === STATE.currentPage) btn.setAttribute('aria-current', 'page');
        btn.addEventListener('click', () => App.goToPage(p));
        frag.appendChild(btn);
      }
    });

    numbersEl.innerHTML = '';
    numbersEl.appendChild(frag);
  },

  buildPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current]);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.add(i);
    }
    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  },

  /* ── Stats Bar ───────────────────────────────────── */
  updateStats(total) {
    const countEl   = DOM.resultsCount();
    const updatedEl = DOM.lastUpdated();
    const dividers  = DOM.statsBar().querySelectorAll('.stats-divider');

    countEl.textContent   = `${Utils.pluralize(total, 'story')} loaded`;
    updatedEl.textContent = `Updated ${Utils.nowFormatted()}`;
    dividers.forEach(d => d.removeAttribute('hidden'));
    STATE.lastUpdated = new Date();
  },

  /* ── No Results ──────────────────────────────────── */
  showNoResults() {
    DOM.cardsGrid().innerHTML  = '';
    DOM.pagination().setAttribute('hidden', '');
    DOM.noResults().removeAttribute('hidden');
    DOM.errorState().setAttribute('hidden', '');

    if (STATE.isSearchMode && STATE.currentQuery) {
      DOM.noResultsMsg().textContent = `No stories found for "${STATE.currentQuery}". Try a different search term.`;
    } else {
      DOM.noResultsMsg().textContent = 'No stories found in this category.';
    }
  },

  /* ── Error State ─────────────────────────────────── */
  showError(message) {
    DOM.cardsGrid().innerHTML = '';
    DOM.pagination().setAttribute('hidden', '');
    DOM.noResults().setAttribute('hidden', '');
    DOM.errorState().removeAttribute('hidden');
    DOM.errorMessage().textContent = message || 'Failed to load stories. Please check your connection.';
  },

  /* ── Tab UI ──────────────────────────────────────── */
  setActiveTab(tab) {
    DOM.tabBtns().forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    const config = CONFIG.TABS[tab];
    DOM.pageTitle().textContent    = config.label;
    DOM.pageSubtitle().textContent = config.subtitle;
  },

  /* ── Search UI ───────────────────────────────────── */
  setSearchMode(query) {
    if (query) {
      DOM.searchClear().removeAttribute('hidden');
      DOM.searchClear().removeAttribute('hidden');
      DOM.pageTitle().textContent    = `Search: "${query}"`;
      DOM.pageSubtitle().textContent = 'Results from Hacker News';
    } else {
      DOM.searchClear().setAttribute('hidden', '');
    }
  },

  /* ── View Mode ───────────────────────────────────── */
  setViewMode(mode) {
    STATE.viewMode = mode;
    const grid = DOM.cardsGrid();
    DOM.viewGrid().classList.toggle('active', mode === 'grid');
    DOM.viewList().classList.toggle('active', mode === 'list');
    grid.classList.toggle('list-view', mode === 'list');
    localStorage.setItem('hf_viewmode', mode);
  },

  /* ── Bookmark Buttons ────────────────────────────── */
  updateBookmarkButtons() {
    document.querySelectorAll('.btn-bookmark').forEach(btn => {
      const id  = btn.dataset.id;
      const bm  = Bookmarks.isBookmarked(id);
      btn.classList.toggle('bookmarked', bm);
      btn.querySelector('i').className = bm ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
      btn.title     = bm ? 'Remove bookmark' : 'Bookmark this story';
      btn.setAttribute('aria-label', bm ? 'Remove bookmark' : 'Add bookmark');
    });
  },
};

/* ═══════════════════════════════════════════════════
   ⑩ MAIN APP
   ═══════════════════════════════════════════════════ */
const App = {
  /* Load stories for current tab */
  async loadStories(tab = STATE.currentTab) {
    if (STATE.isLoading) return;
    STATE.isLoading   = true;
    STATE.isSearchMode = false;
    STATE.currentPage  = 1;
    STATE.currentTab   = tab;
    STATE.currentQuery = '';
    DOM.searchInput().value = '';
    DOM.searchClear().setAttribute('hidden', '');

    UI.setActiveTab(tab);
    UI.renderSkeletons();

    try {
      const stories       = await API.getStories(tab);
      STATE.allStories    = stories;
      STATE.filteredStories = stories;

      if (stories.length === 0) {
        UI.showNoResults();
      } else {
        UI.renderCards(stories);
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
      const msg = err.name === 'TimeoutError'
        ? 'Request timed out. Please try again.'
        : `Failed to load stories: ${err.message}`;
      UI.showError(msg);
      Toast.error(msg);
    } finally {
      STATE.isLoading = false;
    }
  },

  /* Search */
  async handleSearch(query) {
    query = query.trim();
    STATE.currentQuery = query;

    if (!query) {
      this.loadStories(STATE.currentTab);
      return;
    }

    if (STATE.isLoading) return;
    STATE.isLoading   = true;
    STATE.isSearchMode = true;
    STATE.currentPage  = 1;

    UI.setSearchMode(query);
    UI.renderSkeletons();

    try {
      const stories       = await API.searchStories(query);
      STATE.allStories    = stories;
      STATE.filteredStories = stories;

      if (stories.length === 0) {
        UI.showNoResults();
        Toast.warning(`No results for "${query}"`);
      } else {
        UI.renderCards(stories);
        Toast.success(`Found ${Utils.pluralize(stories.length, 'story')} for "${query}"`);
      }
    } catch (err) {
      const msg = `Search failed: ${err.message}`;
      UI.showError(msg);
      Toast.error(msg);
    } finally {
      STATE.isLoading = false;
    }
  },

  /* Navigate to page */
  goToPage(page) {
    const sorted     = Utils.sortStories(STATE.filteredStories, STATE.sortBy);
    const totalPages = Math.ceil(sorted.length / CONFIG.PER_PAGE);
    if (page < 1 || page > totalPages) return;
    STATE.currentPage = page;
    UI.renderCards(STATE.filteredStories);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /* Apply sort */
  applySort(sortBy) {
    STATE.sortBy = sortBy;
    STATE.currentPage = 1;
    if (STATE.filteredStories.length > 0) {
      UI.renderCards(STATE.filteredStories);
    }
  },

  /* Keyboard shortcut: focus search on ⌘K or / */
  handleKeyboard(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      DOM.searchInput().focus();
      DOM.searchInput().select();
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      DOM.searchInput().focus();
    }
    if (e.key === 'Escape') {
      DOM.searchInput().blur();
      if (STATE.currentQuery) this.clearSearch();
    }
  },

  clearSearch() {
    DOM.searchInput().value = '';
    DOM.searchClear().setAttribute('hidden', '');
    STATE.currentQuery = '';
    this.loadStories(STATE.currentTab);
  },
};

/* ═══════════════════════════════════════════════════
   ⑪ EVENT LISTENERS
   ═══════════════════════════════════════════════════ */
function initEventListeners() {
  /* --- Tabs ---------------------------------------- */
  DOM.tabBtns().forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab !== STATE.currentTab || STATE.isSearchMode) {
        App.loadStories(btn.dataset.tab);
      }
    });
  });

  /* --- Search ---------------------------------------- */
  const debouncedSearch = Utils.debounce((q) => App.handleSearch(q), CONFIG.DEBOUNCE_MS);
  DOM.searchInput().addEventListener('input', (e) => {
    const q = e.target.value;
    DOM.searchClear()[q ? 'removeAttribute' : 'setAttribute']('hidden', '');
    debouncedSearch(q);
  });
  DOM.searchClear().addEventListener('click', () => App.clearSearch());

  /* --- Pagination ------------------------------------- */
  DOM.prevBtn().addEventListener('click', () => App.goToPage(STATE.currentPage - 1));
  DOM.nextBtn().addEventListener('click', () => App.goToPage(STATE.currentPage + 1));

  /* --- Theme ------------------------------------------ */
  DOM.themeToggle().addEventListener('click', () => Theme.toggle());

  /* --- View Mode ------------------------------------- */
  DOM.viewGrid().addEventListener('click', () => {
    UI.setViewMode('grid');
    if (STATE.filteredStories.length) UI.renderCards(STATE.filteredStories);
  });
  DOM.viewList().addEventListener('click', () => {
    UI.setViewMode('list');
    if (STATE.filteredStories.length) UI.renderCards(STATE.filteredStories);
  });

  /* --- Sort ------------------------------------------- */
  DOM.sortSelect().addEventListener('change', (e) => App.applySort(e.target.value));

  /* --- Bookmark Toggle (panel) ---------------------- */
  DOM.bookmarkToggle().addEventListener('click', () => {
    const panel = DOM.bookmarksPanel();
    const main  = DOM.mainContent();
    const isOpen = !panel.hasAttribute('hidden');
    if (isOpen) {
      panel.setAttribute('hidden', '');
      main.classList.remove('panel-open');
      DOM.bookmarkToggle().querySelector('i').className = 'fa-regular fa-bookmark';
    } else {
      panel.removeAttribute('hidden');
      main.classList.add('panel-open');
      DOM.bookmarkToggle().querySelector('i').className = 'fa-solid fa-bookmark';
      Bookmarks.renderPanel();
    }
  });

  DOM.bookmarksClose().addEventListener('click', () => {
    DOM.bookmarksPanel().setAttribute('hidden', '');
    DOM.mainContent().classList.remove('panel-open');
    DOM.bookmarkToggle().querySelector('i').className = 'fa-regular fa-bookmark';
  });

  DOM.bookmarksClear().addEventListener('click', () => Bookmarks.clearAll());

  /* --- Bookmark button click (event delegation) ----- */
  DOM.cardsGrid().addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-bookmark');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id    = btn.dataset.id;
    const story = STATE.filteredStories.find(s => s.id === id)
                || [...STATE.bookmarks.values()].find(b => b.id === id);
    if (story) Bookmarks.toggle(story);
  });

  /* --- Error Retry ------------------------------------ */
  DOM.errorRetry().addEventListener('click', () => {
    if (STATE.isSearchMode && STATE.currentQuery) {
      App.handleSearch(STATE.currentQuery);
    } else {
      App.loadStories(STATE.currentTab);
    }
  });

  /* --- No Results Reset ----------------------------- */
  DOM.noResultsReset().addEventListener('click', () => App.loadStories('top'));

  /* --- Scroll behaviors ------------------------------ */
  const scrollTopBtn = DOM.scrollTopBtn();
  const navbar       = DOM.navbar();

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    // Scroll-to-top visibility
    scrollTopBtn.classList.toggle('visible', scrollY > 400);
    // Navbar shadow on scroll
    navbar.classList.toggle('scrolled', scrollY > 10);
  }, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* --- Keyboard shortcuts ----------------------------- */
  document.addEventListener('keydown', (e) => App.handleKeyboard(e));
}

/* ═══════════════════════════════════════════════════
   ⑫ INIT
   ═══════════════════════════════════════════════════ */
function init() {
  // Load persisted state
  Theme.load();
  Bookmarks.load();
  Bookmarks.updateCount();

  // Load view mode
  const savedView = localStorage.getItem('hf_viewmode');
  if (savedView) UI.setViewMode(savedView);

  // Wire up events
  initEventListeners();

  // Load initial stories
  App.loadStories('top');

  // Console welcome message
  console.log(
    '%c HackerFeed %c Built with ♥ using Vanilla JS ',
    'background:#ff6600;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;font-family:monospace',
    'background:#1e293b;color:#94a3b8;padding:4px 8px;border-radius:0 4px 4px 0;font-family:monospace'
  );
}

// Start the app when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
