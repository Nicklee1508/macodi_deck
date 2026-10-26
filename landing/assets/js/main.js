/* moodeck 랜딩 — 주소 설정 + 화면 동작 */

// ===== 주소 설정: 운영 주소가 바뀌면 여기만 수정 =====
var CONFIG = {
  appUrl: 'https://deck.macodi.co.kr/editor', // '무료로 시작하기' 등 Deck 편집 화면으로 가는 버튼
  macodiUrl: 'https://macodi.co.kr/',   // 이용약관 · 개인정보처리방침 링크(운영사 문서)
};

(function () {
  // 버튼 주소 적용
  document.querySelectorAll('[data-app-link]').forEach(function (a) { a.href = CONFIG.appUrl; });
  document.querySelectorAll('[data-macodi-link]').forEach(function (a) { a.href = CONFIG.macodiUrl + (a.dataset.path || ''); });

  // 준비 중인 기능 버튼(data-soon) — 화면 아래에 잠깐 안내를 띄움
  var toast;
  var toastTimer;
  document.querySelectorAll('[data-soon]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
      }
      toast.textContent = b.dataset.soon;
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2400);
    });
  });

  // 헤더: 스크롤 시 하단선, 모바일 메뉴
  var hd = document.querySelector('.hd');
  var menuBtn = document.querySelector('.hd__menu');
  var onScroll = function () { hd.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  menuBtn.addEventListener('click', function () {
    var open = hd.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('.gnb a').forEach(function (a) {
    a.addEventListener('click', function () { hd.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', false); });
  });

  // 스크롤 등장
  var io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io ? io.observe(el) : el.classList.add('is-in'); });

  // 실제 마코디 등록 자재(2026-10-23 마코디 검색 API 조회 기준)
  var MATS = [
    { img: 'mat-1.jpg', brand: '아티잰(ARTISAN)', name: '8221-17', kind: '벽지/프리미엄 비닐벽지', size: '1370*27400' },
    { img: 'mat-ah6103.jpg', brand: '동신포리마', name: 'AH-6103', kind: '데코타일/LVT', size: '600*600' },
    { img: 'mat-5.jpg', brand: 'MAGICA', name: 'BASALTINA_GREY MATT', kind: '타일/스톤', size: '600*1200' },
    { img: 'mat-4.jpg', brand: 'Designtex', name: '3069-801 Mineral', kind: '패브릭/혼방직물', size: '1420' },
    { img: 'mat-2.jpg', brand: 'Designtex', name: '3021-802 Sterling', kind: '인조가죽/실리콘', size: '1370' },
    { img: 'mat-6.jpg', brand: 'Designtex', name: '3061-403 Oceania', kind: '인조가죽/비닐', size: '1370' },
  ];
  var LINK_SVG = '<svg viewBox="0 0 20 20"><path d="M15.5 9.2v6.6a1.9 1.9 0 0 1-1.9 1.9H4.2a1.9 1.9 0 0 1-1.9-1.9V6.4a1.9 1.9 0 0 1 1.9-1.9h6.6M17.7 2.3 8.9 11.1M17.7 2.3h-4.4M17.7 2.3v4.4"/></svg>';
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 마감재 패널 카드 / 슬라이드에 놓이는 스펙 모듈 — Deck 의 MacodiPanel · useInsertSpecCard 와 같은 구성
  function matCard(m, tag) {
    var b = document.createElement(tag);
    if (tag === 'button') b.type = 'button';
    b.className = 'mcard';
    b.innerHTML = '<img src="assets/img/' + m.img + '" alt=""><b>' + esc(m.name) + '</b><span>' + esc(m.kind.replace('/', ' / ')) + '</span><span>' + esc(m.size.replace('*', '×')) + '</span>';
    return b;
  }
  function specEl(m) {
    var el = document.createElement('div');
    el.className = 'spec';
    el.innerHTML =
      '<div class="spec__img"><img src="assets/img/' + m.img + '" alt=""><span class="spec__link">' + LINK_SVG + '</span></div>' +
      '<dl class="spec__rows">' +
      '<div><dt>브랜드</dt><dd>' + esc(m.brand) + '</dd></div>' +
      '<div><dt>제품명</dt><dd>' + esc(m.name) + '</dd></div>' +
      '<div><dt>구분/종류</dt><dd>' + esc(m.kind) + '</dd></div>' +
      '<div><dt>사이즈</dt><dd>' + esc(m.size) + '</dd></div>' +
      '</dl>';
    return el;
  }

  // 공간 장면용 자재(실제 마코디 등록 제품) — 바닥 / 소파(처음부터 배치) · 벽 / 천장(AI 영역 검색으로 배치)
  var SPACE_MATS = [
    { img: 'mat-ah6103.jpg', brand: '동신포리마', name: 'AH-6103', kind: '데코타일/LVT', size: '600*600' },
    { img: 'mat-parchment.jpg', brand: 'Designtex', name: '3069-102 Parchment', kind: '패브릭/혼방직물', size: '1420' },
    { img: 'mat-walnut.jpg', brand: '인목', name: 'INWT70 천연 월넛 슬립매치', kind: '무늬목/무늬목 판재', size: '1200*2400' },
    { img: 'mat-na155.jpg', brand: 'KCC', name: 'NA155', kind: '페인트/수성페인트', size: '해당없음' },
  ];

  // ===== 히어로: 편집 화면 재현 + 자동 재생 (장면 1 제품 보드 ↔ 장면 2 공간 + 마감재) =====
  (function hero() {
    // 히어로 시연 속도 — 1.5배 빠르게(대기 시간 ÷ 1.5). CSS 쪽 움직임 시간도 같이 줄임(style.css .app__cursor·.hsel.grow 등)
    var SPEED = 1.5;
    var hwait = function (ms) { return wait(ms / SPEED); };
    var fit = document.getElementById('appFit');
    var app = document.getElementById('app');
    var hgrid = document.getElementById('heroGrid');
    var status = document.getElementById('heroStatus');
    var cursor = document.getElementById('heroCursor');
    var pageNo = document.getElementById('heroPageNo');
    var scale = 1;
    var fitApp = function () {
      scale = fit.clientWidth / 1280;
      app.style.setProperty('--s', scale);
    };
    fitApp();
    window.addEventListener('resize', fitApp);

    // base = 처음부터 놓인 자재, add = 커서가 클릭해서 넣는 자재, panel = 오른쪽 패널 목록(add 가 위쪽에 보이게)
    var SCENES = [
      { mats: MATS, base: [0, 1], add: [2, 3], panel: [0, 1, 2, 3, 4, 5], page: 3 },
      { mats: SPACE_MATS, base: [0, 1], add: [2, 3], panel: [2, 3, 0, 1], extra: [MATS[3], MATS[0]], page: 4,
        // AI 영역 검색으로 넣는 자재: 사진 위 영역(%: 왼쪽, 위, 폭, 높이) + AI 추천 목록(첫 번째가 클릭할 자재)
        ai: {
          2: { rect: [1, 14, 10, 68], recs: [SPACE_MATS[2], // 벽 → 월넛 무늬목
            { img: 'mat-walnut2.jpg', brand: '인목', name: 'INWT70 천연 월넛', kind: '무늬목/엣지 및 래핑재', size: '19,22,25' },
            { img: 'mat-walnut3.jpg', brand: '인목', name: 'INSW70 천연 사틴 월넛', kind: '무늬목/엣지 및 래핑재', size: '19,22,25' }] },
          3: { rect: [58, 10, 32, 22], recs: [SPACE_MATS[3], // 천장 → 흰 도장
            { img: 'mat-ya43f.jpg', brand: 'KCC', name: 'YA43F', kind: '페인트/수성페인트', size: '해당없음' },
            { img: 'mat-travertino.jpg', brand: 'OIKOS', name: 'TRAVERTINO MONOLITICO (WHITE)', kind: '스페셜페인트/유럽미장', size: '해당없음' }] },
        } },
    ];
    var aiBtn = document.getElementById('heroAi');
    var aiSel = document.getElementById('heroSel');
    var aiTag = document.getElementById('heroAiTag');
    var photo = document.getElementById('heroPhoto');
    SCENES.forEach(function (sc, n) {
      sc.slide = app.querySelector('.aslide[data-scene="' + n + '"]');
      sc.slots = document.getElementById('heroSlots' + n);
      sc.thumb = document.getElementById('heroThumb' + n);
      sc.th = app.querySelector('.th[data-scene="' + n + '"]');
    });
    var cur = SCENES[0];
    var cardEls = [];

    var syncThumb = function (sc) {
      sc.thumb.innerHTML = '';
      sc.slots.querySelectorAll('.spec__img img').forEach(function (img) {
        var s = document.createElement('span');
        s.style.backgroundImage = 'url(' + img.getAttribute('src') + ')';
        sc.thumb.appendChild(s);
      });
    };
    var put = function (sc, i, sel) {
      sc.slots.querySelectorAll('.is-sel').forEach(function (n) { n.classList.remove('is-sel'); });
      var el = specEl(sc.mats[i]);
      if (sel) el.classList.add('is-sel');
      sc.slots.appendChild(el);
      syncThumb(sc);
      return el;
    };
    var say = function (t, ok) {
      status.textContent = t;
      status.classList.toggle('is-on', !!t);
      status.classList.toggle('is-ok', !!ok);
    };
    var reset = function (sc) {
      sc.slots.innerHTML = '';
      sc.base.forEach(function (i) { put(sc, i, false); });
    };
    // 장면 전환: 슬라이드 · 썸네일 · 패널 목록 · 하단 쪽수
    var show = function (sc) {
      cur = sc;
      SCENES.forEach(function (s) {
        s.slide.classList.toggle('is-on', s === sc);
        s.th.classList.toggle('is-on', s === sc);
      });
      renderPanel(sc);
      pageNo.textContent = '슬라이드 ' + sc.page + ' / 6';
      say('');
    };
    // 오른쪽 패널: 일반 목록
    function renderPanel(sc) {
      hgrid.innerHTML = '';
      cardEls = [];
      sc.panel.forEach(function (i) { var c = matCard(sc.mats[i], 'div'); hgrid.appendChild(c); cardEls[i] = c; });
      (sc.extra || []).forEach(function (m) { hgrid.appendChild(matCard(m, 'div')); });
    }
    SCENES.forEach(reset);
    var FIRST = 1; // 첫 장면 = AI 영역 검색(공간 + 마감재). 그다음 제품 보드 장면과 번갈아
    show(SCENES[FIRST]);
    if (reduceMotion) { SCENES.forEach(function (sc) { sc.add.forEach(function (i) { put(sc, i, false); }); }); return; }

    // 커서를 요소 가운데로(앱 기준 좌표 — 축소 배율을 되돌려 계산)
    var moveTo = function (el, fx, fy) {
      var r = el.getBoundingClientRect(), a = app.getBoundingClientRect();
      var x = (r.left - a.left + r.width * (fx == null ? .5 : fx)) / scale;
      var y = (r.top - a.top + r.height * (fy == null ? .45 : fy)) / scale;
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    };
    var visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.3 }).observe(fit);
    } else visible = true;
    var whenVisible = function () {
      return new Promise(function (r) { (function chk() { visible && !document.hidden ? r() : setTimeout(chk, 300); })(); });
    };

    var click = async function (el) {
      cursor.classList.add('is-click');
      el.classList.add('is-press');
      await hwait(220);
      el.classList.remove('is-press');
      await hwait(300);
      cursor.classList.remove('is-click');
    };
    // AI 영역 검색: AI 버튼 → 사진 위 영역 드래그 → 추천 목록 → 첫 번째 추천 클릭
    var aiPick = async function (sc, i) {
      var ai = sc.ai[i], r = ai.rect, name = sc.mats[i].name;
      moveTo(aiBtn, .55, .55);
      await hwait(1000);
      await click(aiBtn);
      aiBtn.classList.add('on');
      aiTag.classList.add('on');
      say('슬라이드 위에서 찾을 곳을 둘러 그려주세요');
      aiSel.className = 'hsel';
      aiSel.style.left = r[0] + '%';
      aiSel.style.top = r[1] + '%';
      aiSel.style.width = aiSel.style.height = '0';
      moveTo(photo, r[0] / 100, r[1] / 100);
      await hwait(1000);
      aiSel.classList.add('on');
      void aiSel.offsetWidth;
      aiSel.classList.add('grow');
      aiSel.style.width = r[2] + '%';
      aiSel.style.height = r[3] + '%';
      moveTo(photo, (r[0] + r[2]) / 100, (r[1] + r[3]) / 100);
      await hwait(1100);
      say('AI 추천 검색 중…');
      await hwait(800);
      hgrid.innerHTML = '';
      var target;
      ai.recs.forEach(function (m, k) { var c = matCard(m, 'div'); hgrid.appendChild(c); if (!k) target = c; });
      say('AI 추천 자재');
      await hwait(600);
      moveTo(target);
      await hwait(1000);
      target.classList.add('is-hover');
      await hwait(350);
      cursor.classList.add('is-click');
      target.classList.add('is-press');
      say('“' + name + '” 삽입 중…');
      await hwait(220);
      target.classList.remove('is-press');
      await hwait(250);
      put(sc, i, true);
      say('삽입 완료: ' + name, true);
      aiSel.classList.add('fade');
      await hwait(450);
      cursor.classList.remove('is-click');
      aiBtn.classList.remove('on');
      aiTag.classList.remove('on');
      await hwait(900);
      renderPanel(sc);
    };
    // 한 장면: 마감재 2개를 차례로 배치(장면 2는 AI 영역 검색) → 잠시 보여준 뒤 다음 장면을 위해 되돌림
    var play = async function (sc) {
      for (var k = 0; k < sc.add.length; k++) {
        if (sc.ai && sc.ai[sc.add[k]]) { await aiPick(sc, sc.add[k]); continue; }
        var i = sc.add[k], card = cardEls[i], name = sc.mats[i].name;
        moveTo(card);
        await hwait(1000);
        card.classList.add('is-hover');
        await hwait(350);
        cursor.classList.add('is-click');
        card.classList.add('is-press');
        say('“' + name + '” 삽입 중…');
        await hwait(220);
        card.classList.remove('is-press');
        await hwait(250);
        put(sc, i, true);
        say('삽입 완료: ' + name, true);
        await hwait(450);
        cursor.classList.remove('is-click');
        card.classList.remove('is-hover');
        await hwait(900);
      }
      moveTo(sc.slots.lastElementChild, .5, .5);
      await hwait(2600);
    };
    var undo = async function (sc) {
      [].slice.call(sc.slots.children, sc.base.length).forEach(function (n) { n.classList.add('is-out'); });
      await hwait(550);
      reset(sc);
    };

    (async function loop() {
      moveTo(SCENES[FIRST].slots, .5, .6);
      await hwait(400);
      cursor.style.opacity = 1;
      for (var n = FIRST; ; n = (n + 1) % SCENES.length) {
        await whenVisible();
        var sc = SCENES[n], next = SCENES[(n + 1) % SCENES.length];
        await play(sc);
        // 왼쪽 슬라이드 목록에서 다음 장면 클릭
        moveTo(next.th, .6, .5);
        await hwait(1000);
        await click(next.th);
        undo(sc);
        show(next);
        await hwait(700);
      }
    })();
  })();

  // ===== PowerPoint 호환: Deck 화면 ↔ PowerPoint 화면 자동 전환 =====
  (function swap() {
    var fit = document.getElementById('swapFit');
    var app = document.getElementById('swapApp');
    var tabs = document.querySelectorAll('.swap__tabs button');
    var fitApp = function () { app.style.setProperty('--s', fit.clientWidth / 960); };
    fitApp();
    window.addEventListener('resize', fitApp);

    var four = MATS.slice(0, 4);
    // 두 화면이 함께 쓰는 슬라이드(히어로 첫 장면과 같은 마감재 보드)
    var slide = document.createElement('div');
    slide.className = 'aslide';
    slide.innerHTML =
      '<div class="aslide__head"><div><span class="aslide__label">MATERIAL SPECIFICATION</span><span class="aslide__title">거실 마감재 제안</span></div>' +
      '<span class="aslide__meta">LIVING ROOM · 바닥 / 벽 / 가구</span></div><div class="aslide__grid"></div>' +
      '<div class="aslide__foot"><span>※ 위 자재는 국내 수급 가능 제품이며, 제품 링크에서 상세 정보를 확인할 수 있습니다.</span><span>스튜디오명 · 담당 디자이너</span></div>' +
      '<span class="aslide__page">03</span>';
    four.forEach(function (m) { slide.querySelector('.aslide__grid').appendChild(specEl(m)); });
    document.getElementById('swapSlide').appendChild(slide);
    four.forEach(function (m) { document.getElementById('swapCards').appendChild(matCard(m, 'div')); });
    // 슬라이드 목록(3번 = 현재 슬라이드, 마감재 썸네일 표시)
    document.querySelectorAll('.sw-thumbs').forEach(function (box) {
      for (var n = 1; n <= 5; n++) {
        var t = document.createElement('div');
        t.className = 't' + (n === 3 ? ' is-on' : '');
        t.dataset.n = n;
        if (n === 3) four.forEach(function (m, k) {
          var s = document.createElement('span');
          s.style.left = (10 + k * 20) + '%';
          s.style.backgroundImage = 'url(assets/img/' + m.img + ')';
          t.appendChild(s);
        });
        box.appendChild(t);
      }
    });

    var view = 'deck';
    var set = function (v) {
      if (v === view) return;
      view = v;
      app.dataset.v = v;
      tabs.forEach(function (b) { b.classList.toggle('is-on', b.dataset.v === v); });
    };
    // 직접 누르면 잠시 자동 전환을 멈춤
    var holdUntil = 0;
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { set(b.dataset.v); holdUntil = Date.now() + 8000; });
    });
    if (reduceMotion) return;
    var visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.3 }).observe(fit);
    } else visible = true;
    setInterval(function () {
      if (!visible || document.hidden || Date.now() < holdUntil) return;
      set(view === 'deck' ? 'ppt' : 'deck');
    }, 3500);
  })();

  // ===== 마감재 검색 · AI 영역 검색 탭: AI 버튼 → 바닥 영역 드래그 → 추천 =====
  // 추천 자재: 사진 속 회색 스톤 타일 바닥과 비슷한 실제 마코디 등록 제품
  var AI_MATS = [
    { img: 'mat-stargrey.jpg', name: '스타그레이', kind: '타일/포세린', size: '600*1200' },
    { img: 'mat-shellstone.jpg', name: '쉘스톤 그레이', kind: '타일/포세린', size: '600*1200' },
    { img: 'mat-5.jpg', name: 'BASALTINA_GREY MATT', kind: '타일/스톤', size: '600*1200' },
    { img: 'mat-parker.jpg', name: '파커 그레이', kind: '타일/포세린', size: '600*1200' },
  ];
  (function aiDemo() {
    var fit = document.getElementById('aiFit');
    var app = document.getElementById('aiApp');
    var btn = document.getElementById('aiBtn');
    var sel = document.getElementById('aiSel');
    var tag = document.getElementById('aiTag');
    var sec = document.getElementById('aiSec');
    var grid2 = document.getElementById('aiGrid');
    var cursor = document.getElementById('aiCursor');
    var slide = document.getElementById('aiSlide');
    var scale = 1;
    var fitApp = function () { scale = fit.clientWidth / 900 || 1; app.style.setProperty('--s', scale); };
    fitApp();
    window.addEventListener('resize', fitApp);
    // 탭이 숨겨졌다가 보이면 크기가 0 → 보일 때 다시 맞춤
    if ('ResizeObserver' in window) new ResizeObserver(fitApp).observe(fit);

    var showResults = function () {
      grid2.innerHTML = '';
      AI_MATS.forEach(function (m) { grid2.appendChild(matCard(m, 'div')); });
    };
    if (reduceMotion) {
      btn.classList.add('on'); tag.classList.add('on'); sel.classList.add('on', 'grow');
      sec.textContent = 'AI 추천 자재'; showResults();
      return;
    }
    // 앱 기준 좌표(축소 배율을 되돌려 계산). fx/fy = 요소 안 비율 위치
    var pointOf = function (el, fx, fy) {
      var r = el.getBoundingClientRect(), a = app.getBoundingClientRect();
      return { x: (r.left - a.left + r.width * fx) / scale, y: (r.top - a.top + r.height * fy) / scale };
    };
    var moveTo = function (p, ms) {
      cursor.style.transitionDuration = (ms || 900) + 'ms, 300ms';
      cursor.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
    };
    var tapCursor = async function () {
      cursor.classList.add('is-click');
      await wait(450);
      cursor.classList.remove('is-click');
    };
    var paneOn = function () { return !fit.closest('.pane').hidden && fit.clientWidth > 0; };
    var visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.3 }).observe(fit);
    } else visible = true;
    var ready = function () {
      return new Promise(function (r) { (function chk() { visible && paneOn() && !document.hidden ? r() : setTimeout(chk, 300); })(); });
    };
    var reset = function () {
      btn.classList.remove('on'); tag.classList.remove('on');
      sel.className = 'ai-sel';
      sec.textContent = '';
      grid2.innerHTML = '';
    };

    (async function loop() {
      for (;;) {
        await ready();
        fitApp();
        reset();
        moveTo(pointOf(slide, .5, .4), 10);
        await wait(80);
        cursor.style.opacity = 1;
        // 1) AI 버튼 클릭
        moveTo(pointOf(btn, .55, .55));
        await wait(1000);
        await tapCursor();
        btn.classList.add('on'); tag.classList.add('on');
        sec.textContent = '슬라이드 위에서 찾을 곳을 둘러 그려주세요';
        await wait(600);
        // 2) 바닥 영역 왼쪽 위로 이동 → 오른쪽 아래로 드래그
        moveTo(pointOf(sel, 0, 0));
        await wait(1000);
        sel.classList.add('on');
        sel.classList.add('grow');
        await wait(30);
        var r = slide.getBoundingClientRect(), a = app.getBoundingClientRect();
        moveTo({ x: (r.left - a.left) / scale + 580 * (.35 + .51), y: (r.top - a.top) / scale + 580 * 9 / 16 * (.775 + .175) }, 1200);
        await wait(1300);
        // 3) 추천
        sec.textContent = 'AI 추천 검색 중…';
        await wait(800);
        sec.textContent = 'AI 추천 자재';
        showResults();
        moveTo(pointOf(grid2, .5, .3));
        await wait(3600);
        sel.classList.add('fade');
        cursor.style.opacity = 0;
        await wait(600);
      }
    })();
  })();

  // ===== 스펙 모듈 체험 =====
  var MAX = 4;
  var grid = document.getElementById('demoGrid');
  var cards = document.getElementById('demoCards');
  var touched = false; // 사용자가 직접 한 번이라도 눌렀는지 — 누르면 안내 표시를 끔
  var demoBox = document.querySelector('.demo');

  MATS.forEach(function (m, i) {
    var b = matCard(m, 'button');
    b.dataset.i = i;
    b.addEventListener('click', function () {
      if (!touched) { touched = true; demoBox.classList.add('is-touched'); }
      place(i);
    });
    grid.appendChild(b);
  });

  // 남은 자리는 점선 빈칸으로, 아직 안 넣은 카드 하나에 깜빡임 안내
  function refresh() {
    cards.querySelectorAll('.slot').forEach(function (n) { n.remove(); });
    for (var k = cards.querySelectorAll('.spec').length; k < MAX; k++) {
      var s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = '<span>+</span><em>클릭해서 추가</em>';
      cards.appendChild(s);
    }
    grid.querySelectorAll('.is-hint').forEach(function (n) { n.classList.remove('is-hint'); });
    var next = !touched && grid.querySelector('.mcard:not(.is-used)');
    if (next) next.classList.add('is-hint');
  }
  function place(i) {
    var used = cards.querySelectorAll('.spec');
    if (used.length >= MAX) used[0].remove(); // 자리가 차면 가장 먼저 놓은 것부터 교체
    var firstSlot = cards.querySelector('.slot');
    cards.insertBefore(specEl(MATS[i]), firstSlot);
    grid.querySelector('[data-i="' + i + '"]').classList.add('is-used');
    refresh();
  }
  document.getElementById('demoReset').addEventListener('click', function () {
    cards.querySelectorAll('.spec').forEach(function (n) { n.remove(); });
    grid.querySelectorAll('.is-used').forEach(function (n) { n.classList.remove('is-used'); });
    refresh();
  });
  refresh();
  // 처음 화면에 보이면 2개를 자동으로 배치해 동작을 보여줌
  var demo = document.querySelector('.demo');
  if ('IntersectionObserver' in window) {
    var demoIo = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      demoIo.disconnect();
      if (cards.querySelector('.spec')) return;
      setTimeout(function () { place(1); }, 500);
      setTimeout(function () { place(2); }, 1100);
    }, { threshold: 0.4 });
    demoIo.observe(demo);
  }

  // ===== 검색 방식 탭 =====
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { var on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
      document.querySelectorAll('.pane').forEach(function (p) {
        var on = p.dataset.pane === t.dataset.tab;
        p.hidden = !on;
        p.classList.toggle('is-on', on);
      });
    });
  });

  // ===== 자유로운 편집: 글자 크기 → 색 → 이미지 크기 조절(링크 버튼 고정) → 링크 → 제품 상세·판매 페이지 =====
  (function editDemo() {
    var ewait = function (ms) { return wait(ms / 1.5); }; // 시연 1.5배 빠르게
    var card = document.getElementById('editCard');
    if (!card || reduceMotion) return;
    var sel = document.getElementById('editSel');
    var cursor = document.getElementById('editCursor');
    var page = document.getElementById('editPage');
    var link = sel.querySelector('.spec__link');
    var handle = document.getElementById('editHandle');
    var bSize = document.getElementById('editSize'), bGold = document.getElementById('editGold'), bGreen = document.getElementById('editGreen');
    var at = function (el, fx, fy) { // 카드 기준 좌표로 커서 이동
      var r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
      cursor.style.transform = 'translate(' + (r.left - c.left + r.width * (fx == null ? .5 : fx)) + 'px,' + (r.top - c.top + r.height * (fy == null ? .5 : fy)) + 'px)';
    };
    var press = async function (el) {
      cursor.classList.add('is-click');
      el.classList.add('is-press');
      await ewait(200);
      el.classList.remove('is-press');
      await ewait(250);
      cursor.classList.remove('is-click');
    };
    var visible = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.4 }).observe(card);
    else visible = true;
    var whenVisible = function () { return new Promise(function (r) { (function chk() { visible && !document.hidden ? r() : setTimeout(chk, 300); })(); }); };
    var reset = function () {
      card.classList.remove('is-big', 'is-gold', 'is-green');
      sel.style.width = '';
      page.classList.remove('is-on');
    };
    var MAXW = '66%'; // 가장 크게 키울 때(흰 박스 높이는 CSS 에서 고정)
    (async function loop() {
      at(sel, .5, 1.2);
      await ewait(300);
      cursor.style.opacity = 1;
      for (;;) {
        await whenVisible();
        // 1) 글자 크게
        at(bSize); await ewait(700); await press(bSize); card.classList.add('is-big'); await ewait(700);
        // 2) 글자 색 — 값은 머스터드, 항목명은 진초록
        at(bGold); await ewait(600); await press(bGold); card.classList.add('is-gold'); await ewait(600);
        at(bGreen); await ewait(500); await press(bGreen); card.classList.add('is-green'); await ewait(800);
        // 3) 모서리 끌어 이미지 크기 조절(커졌다 작아짐) — 링크 버튼 크기는 그대로
        at(handle); await ewait(700);
        cursor.classList.add('is-click');
        sel.style.width = MAXW; await ewait(80); at(handle); await ewait(900);
        sel.style.width = '42%'; await ewait(80); at(handle); await ewait(900);
        sel.style.width = '52%'; await ewait(80); at(handle); await ewait(700);
        cursor.classList.remove('is-click');
        await ewait(400);
        // 4) 링크 버튼 → 제품 상세·판매 페이지
        at(link); await ewait(700); await press(link);
        page.classList.add('is-on'); await ewait(600);
        at(page.querySelector('.pg__btn--buy')); await ewait(2600);
        page.classList.remove('is-on'); await ewait(600);
        // 처음 모습으로
        reset(); at(sel, .5, 1.2); await ewait(1600);
      }
    })();
  })();

  // ===== 이런 분들께 =====
  // [제목, 설명, 아이콘(24×24 선 아이콘 path)]
  var WHO = [
    ['인테리어 디자인 스튜디오', '프로젝트마다 반복되는 마감재 조사 시간을 줄이고, 팀원 누구나 같은 형식의 스펙 정리로 제안서 품질을 맞출 수 있습니다.',
      'M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11M3 13a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v4H3zM5 17v2M19 17v2'], // 소파
    ['프리랜서 디자이너', '비싼 소프트웨어 없이 웹에서 바로 제안서를 만들고, 국내에서 구할 수 있는 제품만 골라 클라이언트에게 자신 있게 제안하세요.',
      'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V15H4zM2 18h20M10 9.5l2 2 3.5-3.5'], // 노트북
    ['건축 설계사무소', '설계 단계의 마감 계획을 실제 제품 스펙과 함께 정리해, 발주처 보고와 협의 자료를 빠르게 준비할 수 있습니다.',
      'M4 20V4l16 16zM8 16v-3.5l3.5 3.5zM4 8h2M4 12h2'], // 삼각자
    ['시공 · 리모델링 업체', '고객 상담 자리에서 마감재를 바로 검색해 보여주고, 선택한 자재를 스펙과 함께 정리한 견적 제안서로 이어가세요.',
      'M10.5 6.5 14 3l7 7-3.5 3.5zM12.3 8.3 3.7 16.9a1.7 1.7 0 0 0 2.4 2.4l8.6-8.6'], // 망치
    ['공간 디자인 전공 학생', '과제와 포트폴리오에 실제 유통되는 마감재를 넣어, 현실감 있는 디자인 제안서를 무료로 완성할 수 있습니다.',
      'M2 9.5 12 5l10 4.5L12 14zM6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5M22 9.5V15'], // 학사모
  ];
  var whoCard = document.getElementById('whoCard');
  var whoBtns = document.querySelectorAll('[data-who]');
  whoBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      whoBtns.forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var w = WHO[b.dataset.who];
      whoCard.querySelector('h3').textContent = w[0];
      whoCard.querySelector('p').textContent = w[1];
      whoCard.querySelector('.who__ic path').setAttribute('d', w[2]);
      whoCard.classList.remove('is-swap');
      void whoCard.offsetWidth;
      whoCard.classList.add('is-swap');
    });
  });
})();
