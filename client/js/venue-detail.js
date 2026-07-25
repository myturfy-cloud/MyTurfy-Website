/* =============================================
   MYTURFY — venue-detail.js  (rebuilt)
   Key changes vs original:
   • Time slots generated DYNAMICALLY from venue.openHour/closeHour
   • Booked slots fetched from /api/bookings/slots when date changes
   • Past slots (today, already gone) auto-marked unavailable
   • Date picker restricted to today → today+14 days
   • Owner-closed dates shown as warning, slots disabled
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  function toast(msg, isError = false) {
    $$('.turfy-toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'turfy-toast';
    t.textContent = msg;
    if (isError) t.style.background = '#c62828';
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('visible')));
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
  }

  Auth.syncNavbar();

  /* ── READ VENUE ID FROM URL ── */
  const params = new URLSearchParams(location.search);
  const venueId = params.get('id');
  if (!venueId) { location.href = 'index.html'; return; }

  const nameEl = $('#vdName');
  if (nameEl) nameEl.textContent = 'Loading…';

  let venue;
  try {
    const res = await API.venues.get(venueId);
    venue = res.data;
  } catch (err) {
    toast(`❌ ${err.message}`, true);
    setTimeout(() => location.href = 'index.html', 2000);
    return;
  }

  document.title = `MyTurfy – ${venue.name}`;

  /* ── BREADCRUMB ── */
  const breadSport = $('#breadSport'), breadVenue = $('#breadVenue');
  if (breadSport) { breadSport.textContent = venue.sport; breadSport.href = `venues.html?sport=${encodeURIComponent(venue.sport)}`; }
  if (breadVenue) breadVenue.textContent = venue.name;

  /* ══════════════════════════════════════
     CAROUSEL
  ══════════════════════════════════════ */
  const track      = $('#carouselTrack');
  const dotsEl     = $('#carouselDots');
  const thumbsEl   = $('#carouselThumbs');
  const prevBtn    = $('#carouselPrev');
  const nextBtn    = $('#carouselNext');
  const progressBar = $('#carouselProgress');
  const images = venue.images || [];
  let current = 0, autoTimer = null;

  images.forEach((src, i) => {
    const slide = document.createElement('div'); slide.className = 'carousel-slide';
    const img = document.createElement('img'); img.src = src; img.alt = `${venue.name} photo ${i + 1}`; img.loading = i === 0 ? 'eager' : 'lazy';
    slide.appendChild(img); track.appendChild(slide);
  });
  images.forEach((_, i) => {
    const dot = document.createElement('button'); dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to photo ${i + 1}`); dot.addEventListener('click', () => goTo(i)); dotsEl.appendChild(dot);
  });
  images.forEach((src, i) => {
    const wrap = document.createElement('div'); wrap.className = 'carousel-thumb' + (i === 0 ? ' active' : '');
    const img = document.createElement('img'); img.src = src; img.alt = `Thumb ${i + 1}`; img.loading = 'lazy';
    wrap.appendChild(img); wrap.addEventListener('click', () => goTo(i)); thumbsEl.appendChild(wrap);
  });

  function goTo(idx) {
    current = ((idx % images.length) + images.length) % images.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    $$('.carousel-dot', dotsEl).forEach((d, i) => d.classList.toggle('active', i === current));
    $$('.carousel-thumb', thumbsEl).forEach((t, i) => {
      t.classList.toggle('active', i === current);
      if (i === current) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    restartAuto();
  }
  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));
  document.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') goTo(current - 1); if (e.key === 'ArrowRight') goTo(current + 1); });

  let touchX = 0;
  track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1)); }, { passive: true });

  const AUTOPLAY_MS = 10000;
  function startProgress() {
    if (progressBar) {
      progressBar.style.transition = 'none'; progressBar.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => progressBar.classList.add('animating')));
    }
  }
  function restartAuto() {
    clearTimeout(autoTimer); if (progressBar) progressBar.classList.remove('animating');
    startProgress(); autoTimer = setTimeout(() => goTo(current + 1), AUTOPLAY_MS);
  }
  restartAuto();
  const container = $('#carouselContainer');
  container?.addEventListener('mouseenter', () => { clearTimeout(autoTimer); progressBar?.classList.remove('animating'); });
  container?.addEventListener('mouseleave', () => restartAuto());

  /* ══════════════════════════════════════
     POPULATE VENUE INFO
  ══════════════════════════════════════ */
  const FACILITY_LABELS = { floodlights: 'Floodlights', parking: 'Parking', changing: 'Changing Rooms', cafeteria: 'Cafeteria', ac: 'Air Conditioned', shower: 'Shower', wifi: 'Wi-Fi' };
  const FACILITY_ICONS  = { floodlights: 'fa-lightbulb', parking: 'fa-car', changing: 'fa-door-open', cafeteria: 'fa-utensils', ac: 'fa-snowflake', shower: 'fa-shower', wifi: 'fa-wifi' };

  $('#vdName').textContent      = venue.name;
  $('#vdLocation').textContent  = venue.location;
  $('#vdPrice').textContent     = `₹${venue.price}`;
  $('#vdRatingVal').textContent = venue.rating;
  $('#vdReviews').textContent   = `(${venue.reviewsCount || 0} reviews)`;
  if ($('#vdDistance')) $('#vdDistance').textContent = venue.distance || '';

  function starsHtml(r) {
    let h = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(r)) h += '<i class="fas fa-star"></i>';
      else if (i - r < 1)     h += '<i class="fas fa-star-half-alt"></i>';
      else                    h += '<i class="far fa-star empty"></i>';
    }
    return h;
  }
  $('#vdStars').innerHTML = starsHtml(venue.rating);

  const tagsEl = $('#vdTags');
  (venue.tags || []).forEach(t => {
    tagsEl.innerHTML += `<span class="vtag"><i class="fas ${FACILITY_ICONS[t] || 'fa-check'}"></i>${FACILITY_LABELS[t] || t}</span>`;
  });

  const s = venue.specs || {};
  const specRows = [
    { icon: '📏', label: 'Length',       value: `${s.length || 0} m` },
    { icon: '📐', label: 'Breadth',      value: `${s.breadth || 0} m` },
    { icon: '📊', label: 'Height',       value: `${s.height || 0} m` },
    { icon: '🧮', label: 'Total Area',   value: `${(venue.area || 0).toLocaleString('en-IN')} m²` },
    { icon: '📦', label: 'Volume',       value: `${(venue.volume || 0).toLocaleString('en-IN')} m³` },
    { icon: '🏟️', label: 'No. of Turfs', value: s.turfs || 1 },
    { icon: '🌱', label: 'Court Condition', value: s.condition || '—', full: true },
    { icon: '🛠️', label: 'Tools Provided',  value: s.tools || '—', full: true },
  ];
  const grid = $('#vdSpecsGrid');
  specRows.forEach(row => {
    const el = document.createElement('div');
    el.className = 'spec-item' + (row.full ? ' full' : '');
    el.innerHTML = `<span class="spec-icon">${row.icon}</span><span class="spec-label">${row.label}</span><span class="spec-val">${row.value}</span>`;
    grid.appendChild(el);
  });

  /* ══════════════════════════════════════
     COURT PICKER ENGINE — BookMyShow Seat-Map Style
  ══════════════════════════════════════ */
  const turfsCount = venue.specs?.turfs || 1;
  let selectedCourt = 1;

  const SPORT_COURT_SVG = {
    Football: `<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:30px"><rect x="1" y="1" width="58" height="38" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="30" cy="20" r="8" stroke="currentColor" stroke-width="1.2"/><line x1="30" y1="1" x2="30" y2="39" stroke="currentColor" stroke-width="1"/><rect x="1" y="13" width="7" height="14" stroke="currentColor" stroke-width="1"/><rect x="52" y="13" width="7" height="14" stroke="currentColor" stroke-width="1"/></svg>`,
    Cricket:  `<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:30px"><ellipse cx="30" cy="20" rx="28" ry="18" stroke="currentColor" stroke-width="1.5"/><ellipse cx="30" cy="20" rx="10" ry="6" stroke="currentColor" stroke-width="1"/><line x1="30" y1="14" x2="30" y2="26" stroke="currentColor" stroke-width="1"/></svg>`,
    Basketball:`<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:30px"><rect x="1" y="1" width="58" height="38" rx="3" stroke="currentColor" stroke-width="1.5"/><line x1="30" y1="1" x2="30" y2="39" stroke="currentColor" stroke-width="1"/><circle cx="30" cy="20" r="8" stroke="currentColor" stroke-width="1"/><rect x="1" y="12" width="11" height="16" rx="1" stroke="currentColor" stroke-width="1"/><rect x="48" y="12" width="11" height="16" rx="1" stroke="currentColor" stroke-width="1"/></svg>`,
    Badminton:`<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:30px"><rect x="1" y="1" width="58" height="38" rx="3" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="20" x2="59" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="20" y1="1" x2="20" y2="39" stroke="currentColor" stroke-width="1"/><line x1="40" y1="1" x2="40" y2="39" stroke="currentColor" stroke-width="1"/></svg>`,
    Tennis:   `<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:30px"><rect x="1" y="1" width="58" height="38" rx="3" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="20" x2="59" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="15" y1="1" x2="15" y2="39" stroke="currentColor" stroke-width="1"/><line x1="45" y1="1" x2="45" y2="39" stroke="currentColor" stroke-width="1"/><rect x="15" y="8" width="30" height="24" stroke="currentColor" stroke-width="1"/></svg>`,
    default:  `<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:30px"><rect x="1" y="1" width="58" height="38" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="30" cy="20" r="8" stroke="currentColor" stroke-width="1.5"/><line x1="30" y1="1" x2="30" y2="39" stroke="currentColor" stroke-width="1"/></svg>`
  };

  function renderCourtGrid(containerId, onCourtSelect) {
    const container = $('#' + containerId);
    if (!container) return;
    if (turfsCount <= 1) {
      container.style.display = 'none';
      const prev = container.previousElementSibling;
      if (prev && prev.classList.contains('qb-label')) prev.style.display = 'none';
      const formRow = container.closest('.form-row');
      if (formRow) formRow.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    const icon = SPORT_COURT_SVG[venue.sport] || SPORT_COURT_SVG.default;
    container.innerHTML = Array.from({ length: turfsCount }, (_, i) => {
      const c = i + 1;
      const sel = c === selectedCourt;
      return `<div class="court-card${sel ? ' selected' : ''}" data-court="${c}" tabindex="0" role="button" aria-pressed="${sel}" aria-label="Court ${c}">
        <div class="court-card-icon">${icon}</div>
        <div class="court-card-label">Court ${c}</div>
        <div class="court-card-badge" id="courtBadge_${containerId}_${c}">Available</div>
      </div>`;
    }).join('');

    $$('.court-card', container).forEach(card => {
      const activate = () => {
        selectedCourt = +card.dataset.court;
        renderCourtGrid('qbCourtGrid', onCourtSelect);
        renderCourtGrid('mCourtGrid', onCourtSelect);
        onCourtSelect();
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });
  }

  renderCourtGrid('qbCourtGrid', () => {
    loadSlots(selDate, 'qbTimeSlots', t => { selTime = t; updateQBSummary(); }, 'qbDateNote');
  });
  renderCourtGrid('mCourtGrid', () => {
    loadSlots(selDateMob, 'mBookSlots', t => { selTimeMob = t; updateMSummary(); }, 'mDateNote');
  });

  /* ══════════════════════════════════════
     DYNAMIC TIME SLOT ENGINE
  ══════════════════════════════════════ */
  const openH  = venue.openHour  ?? 6;
  const closeH = venue.closeHour ?? 22;
  const closedDates = venue.closedDates || [];

  const getLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const todayStr = getLocalDateString(new Date());
  const maxDate  = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return getLocalDateString(d); })();

  function hourLabel(h) {
    if (h === 0)  return '12 AM';
    if (h < 12)   return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  function renderSlots(containerId, bookedHours, date, onSelect) {
    const container = $('#' + containerId);
    if (!container) return;

    const isToday  = date === todayStr;
    const nowHour  = new Date().getHours();
    const isClosed = closedDates.includes(date);

    if (isClosed) {
      container.innerHTML = `<p style="color:var(--red);font-size:13px;padding:8px 0"><i class="fas fa-ban"></i> This venue is closed on this date. Please pick another date.</p>`;
      return;
    }

    let html = '';
    for (let h = openH; h < closeH; h++) {
      const isPast   = isToday && h <= nowHour;
      const isBooked = bookedHours.includes(h);
      const blocked  = isPast || isBooked;
      const title    = isPast ? 'Past slot' : isBooked ? 'Already booked' : 'Available';
      html += `<button
        class="time-slot${blocked ? ' unavailable' : ''}"
        data-time="${String(h).padStart(2, '0')}:00"
        data-hour="${h}"
        title="${title}"
        ${blocked ? 'disabled' : ''}
      >${hourLabel(h)}</button>`;
    }

    if (!html) {
      container.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px 0">No slots configured for this venue.</p>`;
      return;
    }
    container.innerHTML = html;

    $$('.time-slot', container).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        $$('.time-slot', container).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelect(btn.dataset.time);
      });
    });
  }

  async function loadSlots(date, containerId, onSelect, noteElId) {
    const container = $('#' + containerId);
    if (!container) return;

    const noteEl = noteElId ? $('#' + noteElId) : null;
    if (closedDates.includes(date)) {
      if (noteEl) noteEl.textContent = '— Closed';
      renderSlots(containerId, [], date, onSelect);
      return;
    }
    if (noteEl) noteEl.textContent = '';

    container.innerHTML = `<p style="color:var(--muted);font-size:12px;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> Loading slots…</p>`;
    try {
      const res    = await API.bookings.getBookedSlots(venueId, date, selectedCourt);
      const booked = res.data || [];
      renderSlots(containerId, booked, date, onSelect);
    } catch (_) {
      renderSlots(containerId, [], date, onSelect);
    }
  }

  /* ══════════════════════════════════════
     BOOKING STATE & SPLIT BILL
  ══════════════════════════════════════ */
  let selDate = todayStr, selTime = '', selDur = 1;
  let selDateMob = todayStr, selTimeMob = '', selDurMob = 1;

  /* ══════════════════════════════════════
     SPLIT BILL LOGIC — Premium
  ══════════════════════════════════════ */
  let splitPlayers = 2;

  function updateSplitUI() {
    const total = venue.price * selDur;
    const perPerson = Math.round(total / splitPlayers);
    const countEl = $('#playerCount'), perEl = $('#perPersonCost'), noteEl = $('#splitNote'), avatarsEl = $('#splitAvatars');
    if (countEl) countEl.textContent = splitPlayers;
    if (perEl) perEl.textContent = `₹${perPerson.toLocaleString('en-IN')}`;
    if (noteEl) noteEl.textContent = `of ₹${total.toLocaleString('en-IN')} total`;
    if (avatarsEl) {
      const colors = ['#e53935','#1e88e5','#43a047','#fb8c00','#8e24aa','#00acc1'];
      avatarsEl.innerHTML = Array.from({ length: Math.min(splitPlayers, 6) }, (_, i) =>
        `<div class="split-avatar" style="background:${colors[i % colors.length]}">${i === 0 ? '<i class="fas fa-user" style="font-size:10px"></i>' : (i === Math.min(splitPlayers, 6) - 1 && splitPlayers > 6 ? `+${splitPlayers - 5}` : '<i class="fas fa-user" style="font-size:10px"></i>')}</div>`
      ).join('');
    }
  }

  $('#splitBillToggle')?.addEventListener('click', () => {
    const area = $('#splitExpandedArea'), arrow = $('#splitArrow');
    const open = area?.style.display !== 'none';
    if (area) area.style.display = open ? 'none' : 'block';
    if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    if (!open) updateSplitUI();
  });

  $('#stepDown')?.addEventListener('click', () => { if (splitPlayers > 2) { splitPlayers--; updateSplitUI(); } });
  $('#stepUp')?.addEventListener('click', () => { if (splitPlayers < 20) { splitPlayers++; updateSplitUI(); } });

  $('#shareSplitBtn')?.addEventListener('click', () => {
    const total = venue.price * (selDur || selDurMob || 1);
    const perPerson = Math.round(total / splitPlayers);
    const t = encodeURIComponent(`🏟️ Let's play at ${venue.name}!\n📅 ${selDate || 'Date TBD'} @ ${selTime || selTimeMob || 'TBD'}\n💰 Your share: ₹${perPerson} (split ${splitPlayers} ways)\n👉 Book: ${window.location.href}`);
    window.open(`https://wa.me/?text=${t}`, '_blank');
  });

  $('#copySplitBtn')?.addEventListener('click', async () => {
    const total = venue.price * (selDur || selDurMob || 1);
    const perPerson = Math.round(total / splitPlayers);
    const text = `🏟️ ${venue.name} | ${selDate || 'TBD'} @ ${selTime || selTimeMob || 'TBD'} | Your share: ₹${perPerson} | ${window.location.href}`;
    try { await navigator.clipboard.writeText(text); toast('✅ Link copied!'); }
    catch(_) { toast('Copy: ' + window.location.href); }
  });

  const qbDate = $('#qbDate');
  if (qbDate) {
    qbDate.min   = todayStr;
    qbDate.max   = maxDate;
    qbDate.value = todayStr;
    loadSlots(todayStr, 'qbTimeSlots', t => { selTime = t; updateQBSummary(); }, 'qbDateNote');

    qbDate.addEventListener('change', () => {
      selDate = qbDate.value;
      selTime = '';
      loadSlots(selDate, 'qbTimeSlots', t => { selTime = t; updateQBSummary(); }, 'qbDateNote');
    });
  }

  function updateQBSummary() {
    const rateEl  = $('#qbRate');
    const durEl   = $('#qbDur');
    const totalEl = $('#qbTotal');
    if (rateEl)  rateEl.textContent  = `₹${venue.price}/hr`;
    if (durEl)   durEl.textContent   = `${selDur} hour${selDur > 1 ? 's' : ''}`;
    if (totalEl) totalEl.textContent = `₹${(venue.price * selDur).toLocaleString('en-IN')}`;
  }
  updateQBSummary();

  $$('#qbDuration .dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#qbDuration .dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selDur = +btn.dataset.hours;
      updateQBSummary();
    });
  });

  $('#qbConfirm')?.addEventListener('click', () => initiatePayment(selDate, selTime, selDur));

  /* ── Mobile booking modal ── */
  const bookingModal = $('#bookingModal'), bookingClose = $('#bookingClose');

  function openBooking() {
    const d = $('#mBookDate');
    if (d) {
      d.min   = todayStr;
      d.max   = maxDate;
      d.value = todayStr;
    }
    selDateMob = todayStr;
    selTimeMob = '';
    loadSlots(todayStr, 'mBookSlots', t => { selTimeMob = t; updateMSummary(); }, 'mDateNote');
    updateMSummary();
    bookingModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeBooking() { bookingModal.classList.remove('active'); document.body.style.overflow = ''; }

  $('#bookDetailBtn')?.addEventListener('click', () => {
    if (window.innerWidth < 900) openBooking();
    else $('.quick-book-card')?.scrollIntoView({ behavior: 'smooth' });
  });
  $('#mobileBookBtn')?.addEventListener('click', openBooking);
  bookingClose?.addEventListener('click', closeBooking);
  bookingModal?.addEventListener('click', e => { if (e.target === bookingModal) closeBooking(); });

  if ($('#modalVenueName')) $('#modalVenueName').textContent = venue.name;
  if ($('#modalVenueLoc')) $('#modalVenueLoc').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${venue.location}`;

  function updateMSummary() {
    if ($('#mSummaryRate'))  $('#mSummaryRate').textContent  = `₹${venue.price}/hr`;
    if ($('#mSummaryDur'))   $('#mSummaryDur').textContent   = `${selDurMob} hour${selDurMob > 1 ? 's' : ''}`;
    if ($('#mSummaryTotal')) $('#mSummaryTotal').textContent = `₹${(venue.price * selDurMob).toLocaleString('en-IN')}`;
  }

  $('#mBookDate')?.addEventListener('change', () => {
    selDateMob = $('#mBookDate').value;
    selTimeMob = '';
    loadSlots(selDateMob, 'mBookSlots', t => { selTimeMob = t; updateMSummary(); }, 'mDateNote');
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('#bookingModal .dur-btn');
    if (btn) {
      $$('#bookingModal .dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selDurMob = +btn.dataset.hours;
      updateMSummary();
    }
  });

  $('#mConfirmBook')?.addEventListener('click', () => {
    const d = $('#mBookDate')?.value || selDateMob;
    if (!d)          { toast('❌ Select a date', true);      return; }
    if (!selTimeMob) { toast('❌ Select a time slot', true); return; }
    initiatePayment(d, selTimeMob, selDurMob);
  });

  /* ── 5-MINUTE COUNTDOWN TIMER — Premium (color-coded) ── */
  let holdInterval = null;
  const HOLD_TOTAL_SECS = 5 * 60;

  function startHoldCountdown(expiresAt) {
    const timerEls  = [$('#checkoutTimer'), $('#mCheckoutTimer')].filter(Boolean);
    const bannerEls = [$('#checkoutHoldBanner'), $('#mCheckoutHoldBanner')].filter(Boolean);
    const fillEls   = [$('#holdProgressFill'), $('#mHoldProgressFill')].filter(Boolean);

    bannerEls.forEach(b => b.classList.add('hold-active'));
    clearInterval(holdInterval);

    holdInterval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      const mins = String(Math.floor(diff / 60)).padStart(2, '0');
      const secs = String(diff % 60).padStart(2, '0');
      const pct  = (diff / HOLD_TOTAL_SECS) * 100;

      timerEls.forEach(t => {
        t.textContent = `${mins}:${secs}`;
        t.style.color = diff > 120 ? '#00c853' : diff > 60 ? '#ffb300' : '#ef5350';
      });
      fillEls.forEach(f => {
        f.style.width = `${pct}%`;
        f.style.background = diff > 120
          ? 'linear-gradient(90deg,#00c853,#80f0a0)'
          : diff > 60
          ? 'linear-gradient(90deg,#ffb300,#ffd54f)'
          : 'linear-gradient(90deg,#ef5350,#ff7043)';
      });
      bannerEls.forEach(b => b.classList.toggle('hold-urgent', diff <= 60));

      if (diff <= 0) {
        clearInterval(holdInterval);
        bannerEls.forEach(b => b.classList.remove('hold-active', 'hold-urgent'));
        toast('⚠️ Slot hold expired. Please re-select your slot.', true);
      }
    }, 1000);
  }

  /* ── PAYMENT FLOW ── */
  async function initiatePayment(date, time, durationHours) {
    if (!date) { toast('❌ Select a date', true);      return; }
    if (!time) { toast('❌ Select a time slot', true); return; }

    if (!Auth.isLoggedIn()) {
      toast('❌ Please sign in to book a venue', true);
      document.getElementById('signinModal')?.classList.add('active');
      document.body.style.overflow = 'hidden';
      return;
    }

    const confirmBtns = [$$('#qbConfirm'), $$('#mConfirmBook')].flat().filter(Boolean);
    confirmBtns.forEach(b => { if (b) { b.textContent = 'Holding Slot…'; b.disabled = true; } });

    try {
      // Step 1: Hold slot for 5 minutes (BookMyShow Style)
      const holdRes = await API.bookings.holdSlot(venue._id, date, time, durationHours, selectedCourt);
      startHoldCountdown(holdRes.data.holdExpiresAt);
      toast('⏱️ Slot held for 5 minutes!');

      confirmBtns.forEach(b => { if (b) { b.textContent = 'Processing Payment…'; } });

      // Step 2: Create Razorpay Order
      const orderRes = await API.payments.createOrder(venue._id, date, time, durationHours, selectedCourt, holdRes.data.bookingId);

      if (orderRes.testMode) {
        closeBooking();
        clearInterval(holdInterval);
        toast(`🎉 Booked! Court ${selectedCourt} at ${venue.name} — ${time} · ${durationHours}hr — ₹${venue.price * durationHours}`);
        return;
      }

      const rzp = new Razorpay({
        key:        orderRes.keyId,
        amount:     orderRes.amount,
        currency:   orderRes.currency,
        order_id:   orderRes.orderId,
        name:       'MyTurfy',
        description: `Booking: Court ${selectedCourt} at ${venue.name}`,
        handler: async (response) => {
          try {
            await API.payments.verify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              venueId: venue._id, date, time, durationHours, courtNumber: selectedCourt, bookingId: holdRes.data.bookingId,
            });
            closeBooking();
            clearInterval(holdInterval);
            toast(`🎉 Payment confirmed! Court ${selectedCourt} at ${venue.name} booked for ${date} at ${time}`);
          } catch (err) {
            toast(`❌ Payment verification failed: ${err.message}`, true);
          }
        },
        theme: { color: '#00c853' },
      });
      rzp.open();
    } catch (err) {
      toast(`❌ ${err.message}`, true);
    } finally {
      confirmBtns.forEach(b => { if (b) { b.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Booking'; b.disabled = false; } });
    }
  }

  /* ══════════════════════════════════════
     RATE US MODAL
  ══════════════════════════════════════ */
  const rateModal = $('#rateModal'), rateClose = $('#rateClose'), starPicker = $('#starPicker'), starLabel = $('#starLabel');
  let selectedRating = 0;
  let editingReviewId = null;
  const starTexts = ['', 'Terrible 😞', 'Poor 😕', 'Okay 😐', 'Good 😊', 'Excellent 🤩'];
  if ($('#rateVenueName')) $('#rateVenueName').textContent = venue.name;

  function openRateModal(editId = null, editRating = 0, editText = '') {
    if (!Auth.isLoggedIn()) {
      toast('❌ Please sign in to leave a review', true);
      Auth.openSignin();
      return;
    }
    editingReviewId = editId;
    if (editId) {
      selectedRating = editRating;
      updateStars(editRating);
      if (reviewTextEl) reviewTextEl.value = editText;
      const title = $('#rateModal h2');
      if (title) title.textContent = 'Edit Your Review';
    } else {
      selectedRating = 0;
      updateStars(0);
      if (reviewTextEl) reviewTextEl.value = '';
      const title = $('#rateModal h2');
      if (title) title.textContent = 'Rate & Review Venue';
    }
    rateModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeRateModal() {
    rateModal.classList.remove('active');
    document.body.style.overflow = '';
    selectedRating = 0;
    editingReviewId = null;
    updateStars(0);
    if (reviewTextEl) reviewTextEl.value = '';
  }
  $('#rateBtn')?.addEventListener('click', () => openRateModal());
  $('#rateBtnBottom')?.addEventListener('click', () => openRateModal());
  rateClose?.addEventListener('click', closeRateModal);
  rateModal?.addEventListener('click', e => { if (e.target === rateModal) closeRateModal(); });

  function updateStars(val, isHover = false) {
    $$('i[data-val]', starPicker).forEach(s => {
      s.className = +s.dataset.val <= val ? 'fas fa-star' : 'far fa-star';
      s.classList.toggle('hovered', isHover && +s.dataset.val <= val);
      s.classList.toggle('selected', !isHover && +s.dataset.val <= selectedRating);
    });
    if (val > 0) starLabel.textContent = starTexts[val] || '';
    else if (!isHover) starLabel.textContent = selectedRating > 0 ? starTexts[selectedRating] : 'Tap to rate';
  }
  $$('i[data-val]', starPicker).forEach(star => {
    star.addEventListener('mouseover',  () => updateStars(+star.dataset.val, true));
    star.addEventListener('mouseleave', () => updateStars(selectedRating, false));
    star.addEventListener('click',      () => { selectedRating = +star.dataset.val; updateStars(selectedRating, false); });
  });

  /* Use the textarea already in HTML (#reviewText) */
  const reviewTextEl = $('#reviewText');

  $('#submitRate')?.addEventListener('click', async () => {
    if (!Auth.isLoggedIn()) {
      toast('❌ Please sign in to leave a review', true);
      closeRateModal();
      Auth.openSignin();
      return;
    }
    if (!selectedRating) { toast('❌ Please select a rating', true); return; }
    const submitBtn = $('#submitRate');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    try {
      const text = (reviewTextEl?.value?.trim()) || `Rated ${selectedRating}/5`;
      if (editingReviewId) {
        await API.reviews.update(editingReviewId, selectedRating, text);
        toast(`⭐ Review updated successfully!`);
      } else {
        await API.reviews.create(venue._id, selectedRating, text, null);
        toast(`⭐ Thank you! You rated ${venue.name} ${selectedRating}/5`);
      }
      closeRateModal();
      // Reload reviews section
      loadReviews(activeStarFilter);
    } catch (err) {
      toast(`❌ ${err.message}`, true);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Rating';
    }
  });

  /* ══════════════════════════════════════
     REVIEWS SECTION — with star filter & Edit/Delete
  ══════════════════════════════════════ */
  let allReviews = [];
  let activeStarFilter = 0; // 0 = show all

  async function loadReviews(filterStar = 0) {
    activeStarFilter = filterStar;
    const reviewsContainer = $('#reviewsList');
    const reviewsSummary   = $('#reviewsSummary');
    const filterBtns = $$('.star-filter-btn');
    filterBtns.forEach(b => b.classList.toggle('active', +b.dataset.star === filterStar));

    if (!reviewsContainer) return;
    reviewsContainer.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> Loading reviews…</p>';
    try {
      const res = await API.reviews.forVenue(venueId);
      allReviews = res.data || [];

      // Build star breakdown
      const counts = [0,0,0,0,0,0]; // index 1-5
      allReviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating]++; });
      if (reviewsSummary) {
        reviewsSummary.innerHTML = '';
        for (let s = 5; s >= 1; s--) {
          const pct = allReviews.length ? Math.round((counts[s] / allReviews.length) * 100) : 0;
          reviewsSummary.innerHTML += `
            <button class="star-filter-btn${activeStarFilter === s ? ' active' : ''}" data-star="${s}" title="Show ${s}-star reviews">
              <span class="sfb-stars">${'★'.repeat(s)}${'☆'.repeat(5-s)}</span>
              <span class="sfb-bar"><span class="sfb-fill" style="width:${pct}%"></span></span>
              <span class="sfb-count">${counts[s]}</span>
            </button>`;
        }
        // All button
        reviewsSummary.innerHTML += `<button class="star-filter-btn${activeStarFilter === 0 ? ' active' : ''}" data-star="0">All (${allReviews.length})</button>`;
        $$('.star-filter-btn', reviewsSummary).forEach(btn => {
          btn.addEventListener('click', () => loadReviews(+btn.dataset.star));
        });
      }

      const currentUser = Auth.getUser();
      const currentUserId = currentUser?._id || currentUser?.id;

      const filtered = activeStarFilter === 0 ? allReviews : allReviews.filter(r => r.rating === activeStarFilter);
      if (!filtered.length) {
        reviewsContainer.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No reviews yet for this filter. Be the first to rate!</p>';
        return;
      }
      reviewsContainer.innerHTML = filtered.map(r => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const ago   = timeAgo(new Date(r.createdAt));
        const customerId = r.customer?._id || r.customer;
        const isMyReview = currentUserId && String(customerId) === String(currentUserId);
        const safeText = (r.text || '').replace(/"/g, '&quot;');

        return `
          <div class="review-card" data-id="${r._id}">
            <div class="review-header">
              <span class="review-avatar">${(r.customer?.name?.[0] || '?').toUpperCase()}</span>
              <div class="review-meta">
                <strong>${r.customer?.name || 'Anonymous'}</strong>
                <span class="review-stars">${stars}</span>
              </div>
              <span class="review-ago">${ago}</span>
            </div>
            <p class="review-text">${r.text || ''}</p>
            ${r.reply ? `<div class="review-reply"><i class="fas fa-reply"></i> <strong>Owner replied:</strong> ${r.reply}</div>` : ''}
            ${isMyReview ? `
              <div class="review-actions-user" style="margin-top: 10px; display: flex; gap: 14px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
                <button class="btn-edit-review" data-id="${r._id}" data-rating="${r.rating}" data-text="${safeText}" style="background: none; border: none; color: var(--green); cursor: pointer; font-size: 12px; font-weight: 600; padding: 0;"><i class="fas fa-edit"></i> Edit Review</button>
                <button class="btn-delete-review" data-id="${r._id}" style="background: none; border: none; color: var(--red); cursor: pointer; font-size: 12px; font-weight: 600; padding: 0;"><i class="fas fa-trash-alt"></i> Delete</button>
              </div>
            ` : ''}
          </div>`;
      }).join('');

      // Wire Edit and Delete buttons
      $$('.btn-edit-review', reviewsContainer).forEach(btn => {
        btn.addEventListener('click', () => {
          openRateModal(btn.dataset.id, parseInt(btn.dataset.rating, 10), btn.dataset.text);
        });
      });

      $$('.btn-delete-review', reviewsContainer).forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Are you sure you want to delete your review?')) {
            try {
              await API.reviews.delete(btn.dataset.id);
              toast('✅ Review deleted');
              loadReviews(activeStarFilter);
            } catch (err) {
              toast(`❌ ${err.message}`, true);
            }
          }
        });
      });
    } catch (err) {
      reviewsContainer.innerHTML = `<p style="color:var(--red);font-size:13px">${err.message}</p>`;
    }
  }

  function timeAgo(date) {
    const secs = Math.floor((Date.now() - date) / 1000);
    if (secs < 60)   return 'just now';
    if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
    return `${Math.floor(secs/86400)}d ago`;
  }

  loadReviews(0);

  /* ══════════════════════════════════════
     GET DIRECTIONS
  ══════════════════════════════════════ */
  const directionsBtn = $('#getDirectionsBtn');
  if (directionsBtn) {
    const destination = (venue.lat != null && venue.lng != null)
      ? `${venue.lat},${venue.lng}`
      : encodeURIComponent(`${venue.name}, ${venue.location}`);
    directionsBtn.href   = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    directionsBtn.target = '_blank';
    directionsBtn.rel    = 'noopener noreferrer';
  }

  /* ══════════════════════════════════════
     WISHLIST
  ══════════════════════════════════════ */
  const wishBtn = $('#wishBtn');
  if (Auth.isLoggedIn()) {
    API.auth.getWishlist()
      .then(res => {
        const wishlist = res.data || [];
        const isWishlisted = wishlist.some(v => (v._id || v) === venueId);
        if (isWishlisted && wishBtn) {
          wishBtn.classList.add('active');
          wishBtn.innerHTML = '<i class="fas fa-heart"></i> Wishlisted';
        }
      })
      .catch(() => {});
  }

  wishBtn?.addEventListener('click', async () => {
    if (!Auth.isLoggedIn()) { toast('❌ Please sign in to save to wishlist', true); openSignin(); return; }
    try {
      const res = await API.auth.toggleWishlist(venueId);
      if (res.wishlisted) {
        wishBtn.classList.add('active');
        wishBtn.innerHTML = '<i class="fas fa-heart"></i> Wishlisted';
        toast('❤️ Added to wishlist');
      } else {
        wishBtn.classList.remove('active');
        wishBtn.innerHTML = '<i class="far fa-heart"></i> Wishlist';
        toast('🤍 Removed from wishlist');
      }
    } catch (err) { toast(`❌ ${err.message}`, true); }
  });

  /* ══════════════════════════════════════
     NAVBAR
  ══════════════════════════════════════ */
  const cityBtn = $('#cityBtn'), cityMenu = $('#cityMenu'), menuBtn = $('#menuBtn'), profileMenu = $('#profileMenu');
  function toggleDrop(menu) { const open = menu.classList.contains('open'); $$('.dropdown-menu.open').forEach(m => m.classList.remove('open')); if (!open) menu.classList.add('open'); }
  cityBtn?.addEventListener('click', e => { e.stopPropagation(); toggleDrop(cityMenu); });
  menuBtn?.addEventListener('click', e => { e.stopPropagation(); toggleDrop(profileMenu); });
  document.addEventListener('click', () => $$('.dropdown-menu.open').forEach(m => m.classList.remove('open')));
  $$('.city-menu a[data-city]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> <span class="city-label">${link.dataset.city}</span> <i class="fas fa-chevron-down chevron"></i>`; cityMenu.classList.remove('open'); });
  });

  function doSearch(q) { if (q.trim()) window.location.href = `venues.html?sport=all&q=${encodeURIComponent(q.trim())}`; }
  $('#navSearch')?.addEventListener('keydown',       e => { if (e.key === 'Enter') doSearch(e.target.value); });
  $('#mobileNavSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(e.target.value); });

  const mSearchBar = $('#mobileSearchBar');
  $('#mobileSearchToggle')?.addEventListener('click', () => { mSearchBar.classList.add('open'); $('#mobileNavSearch')?.focus(); });
  $('#mobileSearchClose')?.addEventListener('click',  () => mSearchBar.classList.remove('open'));

  /* ─── SIGN IN MODAL (Centralized) ─── */
  Auth.initAuthModal(toast);

  window.addEventListener('scroll', () => {
    document.querySelector('.navbar').style.boxShadow = window.scrollY > 20 ? '0 4px 28px rgba(0,0,0,.7)' : '0 2px 16px rgba(0,0,0,.4)';
  }, { passive: true });

  console.log(`🏟️ Venue detail loaded: ${venue.name} | Open: ${openH}:00–${closeH}:00`);

  /* ── COMING SOON handler for data-soon links ── */
  const csOverlay = document.getElementById('comingSoonOverlay');
  const csTitleEl = document.getElementById('comingSoonTitle');
  const csMsgEl   = document.getElementById('comingSoonMsg');
  if (csOverlay) {
    document.querySelectorAll('[data-soon]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const name = el.dataset.soon || 'This feature';
        if (csTitleEl) csTitleEl.textContent = `${name} — Coming Soon!`;
        if (csMsgEl)   csMsgEl.textContent   = `We're working hard on ${name}. Stay tuned!`;
        csOverlay.style.display = 'flex';
      });
    });
    csOverlay.addEventListener('click', e => { if (e.target === csOverlay) csOverlay.style.display = 'none'; });
  }
});
