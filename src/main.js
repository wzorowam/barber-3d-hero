import './style.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-ext-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import { captureMode, detectMode, scrubValue, snapEnabled } from './hero/detect.js';
import { copyState } from './hero/copy.js';
import { showStills } from './hero/fallback.js';

const lines = {
  arrive: document.querySelector('[data-line="arrive"]'),
  precision: document.querySelector('[data-line="precision"]'),
  sharp: document.querySelector('[data-line="sharp"]'),
  cta: document.querySelector('[data-line="cta"]'),
  hint: document.querySelector('[data-line="hint"]'),
  bar: document.querySelector('.hero-progress span'),
};

let scroller = null;

function applyCopy(progress) {
  if (document.documentElement.classList.contains('is-stills')) return;
  const state = copyState(progress);
  for (const key of ['arrive', 'precision', 'sharp']) {
    const el = lines[key];
    el.style.opacity = String(state[key]);
    el.setAttribute('aria-hidden', state[key] > 0.25 ? 'false' : 'true');
  }
  lines.cta.style.opacity = String(state.cta);
  lines.cta.style.visibility = state.cta > 0.04 ? 'visible' : 'hidden';
  lines.cta.tabIndex = state.cta > 0.45 ? 0 : -1;
  if (lines.hint) lines.hint.style.opacity = String(state.hint);
  if (lines.bar) lines.bar.style.transform = `scaleX(${progress})`;
}

function closeMenu() {
  document.body.classList.remove('nav-open');
  const toggle = document.querySelector('.nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function scrollToTarget(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (scroller) scroller.scrollTo(el, { offset: -12 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      closeMenu();
      scrollToTarget(target);
    });
  });
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDay(iso) {
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${iso}T12:00:00`));
}

function initBooking() {
  const form = document.querySelector('#rezerwacja-form');
  const confirm = document.querySelector('#potwierdzenie');
  const errors = document.querySelector('#formularz-bledy');
  const time = form.elements.time;
  const date = form.elements.date;
  date.min = todayISO();

  function buildSlots(value) {
    const previous = time.value;
    time.replaceChildren();
    if (!value) {
      time.disabled = true;
      time.add(new Option('Najpierw wybierz dzień', ''));
      return;
    }
    const day = new Date(`${value}T12:00:00`).getDay();
    if (day === 0) {
      time.disabled = true;
      time.add(new Option('W niedzielę nieczynne', ''));
      return;
    }
    time.disabled = false;
    const start = day === 6 ? 9 * 60 : 10 * 60;
    const end = day === 6 ? 16 * 60 : 19 * 60;
    for (let minutes = start; minutes <= end; minutes += 30) {
      const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      time.add(new Option(label, label));
    }
    if ([...time.options].some((option) => option.value === previous)) time.value = previous;
  }

  date.addEventListener('change', () => buildSlots(date.value));
  buildSlots('');

  document.querySelectorAll('[data-voucher]').forEach((button) => {
    button.addEventListener('click', () => {
      form.elements.service.value = button.dataset.voucher;
      form.elements.notes.value = 'Bon podarunkowy — proszę o kontakt w sprawie odbioru.';
      scrollToTarget('#rezerwacja');
      form.elements.name.focus();
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const email = String(data.get('email') || '').trim();
    const service = String(data.get('service') || '');
    const day = String(data.get('date') || '');
    const hour = String(data.get('time') || '');
    const barber = form.elements.barber.selectedOptions[0]?.textContent?.trim() || 'pierwszy wolny';
    const problems = [];

    if (name.length < 2) problems.push('Podaj imię.');
    if (phone.replace(/\D/g, '').length < 9) problems.push('Podaj numer telefonu.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('Podaj adres e-mail.');
    if (!service) problems.push('Wybierz usługę.');
    if (!day) problems.push('Wybierz dzień.');
    else if (day < todayISO()) problems.push('Ten dzień już minął.');
    else if (new Date(`${day}T12:00:00`).getDay() === 0) problems.push('W niedzielę salon jest nieczynny. Wybierz inny dzień.');
    if (!hour) problems.push('Wybierz godzinę.');

    if (problems.length) {
      errors.hidden = false;
      errors.replaceChildren(...problems.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
      errors.focus();
      return;
    }

    errors.hidden = true;
    confirm.querySelector('h3').textContent = `${name.split(' ')[0]}, fotel jest zapisany na próbę.`;
    confirm.querySelector('p').textContent = `${formatDay(day)} o ${hour}, ${service.toLowerCase()}, przy fotelu: ${barber}. To wersja przykładowa — nic nie zostało wysłane i nikt nie oddzwoni pod ${phone}. W salonie potwierdzilibyśmy wizytę telefonicznie.`;
    form.hidden = true;
    confirm.hidden = false;
    confirm.querySelector('h3').focus();
  });

  document.querySelector('#confirm-reset').addEventListener('click', () => {
    form.reset();
    buildSlots('');
    form.hidden = false;
    confirm.hidden = true;
    form.elements.name.focus();
  });
}

function initChrome() {
  const toggle = document.querySelector('.nav-toggle');
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  const links = [...document.querySelectorAll('.nav-link')];
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of links) {
        const current = link.getAttribute('href') === `#${entry.target.id}`;
        link.classList.toggle('is-current', current);
        if (current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('main section[id]').forEach((section) => spy.observe(section));

  const bookBar = document.querySelector('.book-bar');
  const booking = document.querySelector('#rezerwacja');
  const bookingWatch = new IntersectionObserver(([entry]) => {
    bookBar.classList.toggle('is-hidden', entry.isIntersecting);
  }, { threshold: 0.35 });
  bookingWatch.observe(booking);

  const revealItems = document.querySelectorAll('.reveal');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach((item) => item.classList.add('is-in'));
  } else {
    const reveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        reveal.unobserve(entry.target);
      }
    }, { threshold: 0.16 });
    revealItems.forEach((item) => reveal.observe(item));
  }

  document.querySelector('.hero-poster')?.addEventListener('error', (event) => {
    event.currentTarget.hidden = true;
  });
}

function expose(api) {
  window.__atelier = api;
}

async function boot() {
  initChrome();
  initBooking();
  bindAnchors();

  const mode = detectMode();
  document.documentElement.dataset.mode = mode;
  const hero = document.querySelector('#gora');
  const poster = document.querySelector('.hero-poster');

  if (mode === 'stills') {
    showStills(hero);
    expose({ ready: true, mode: 'stills', scrollToRatio, getDrawCalls: () => 0 });
    return;
  }

  let sceneApi = null;
  let sequence = null;
  let activeMode = mode;

  if (mode === 'webgl') {
    try {
      const { createHeroScene } = await import('./hero/scene.js');
      const canvas = document.querySelector('#hero-webgl');
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      sceneApi = createHeroScene(canvas, { capture: captureMode(), mobile });
      document.querySelector('#hero-seq').hidden = true;
      const calls = sceneApi.getDrawCalls();
      if (calls > 25) console.warn(`Za dużo wywołań rysowania: ${calls}`);
    } catch (error) {
      console.error(error);
      sceneApi = null;
      activeMode = 'sequence';
    }
  }

  if (!sceneApi) {
    const { mountSequence } = await import('./hero/fallback.js');
    document.querySelector('#hero-webgl').hidden = true;
    const canvas = document.querySelector('#hero-seq');
    canvas.hidden = false;
    sequence = await mountSequence(canvas);
    if (!sequence) {
      showStills(hero);
      expose({ ready: true, mode: 'stills', scrollToRatio, getDrawCalls: () => 0 });
      return;
    }
    activeMode = 'sequence';
  }

  document.documentElement.dataset.mode = activeMode;

  const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('lenis'),
  ]);
  await import('lenis/dist/lenis.css');
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({
    lerp: captureMode() ? 1 : 0.09,
    smoothWheel: !captureMode(),
    syncTouch: false,
  });
  scroller = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  const onProgress = (progress) => {
    applyCopy(progress);
    if (sceneApi) sceneApi.applyProgress(progress);
    if (sequence) sequence.draw(progress);
  };

  const timeline = gsap.timeline({
    scrollTrigger: {
      id: 'hero-pin',
      trigger: '#gora',
      start: 'top top',
      end: '+=400%',
      pin: true,
      scrub: scrubValue(),
      snap: snapEnabled()
        ? {
          snapTo: 'labelsDirectional',
          duration: { min: 0.15, max: 0.35 },
          delay: 0.06,
          ease: 'power1.inOut',
        }
        : false,
      onUpdate: (self) => onProgress(self.progress),
    },
  });
  timeline.addLabel('descend', 0.1);
  timeline.addLabel('cut1', 0.25);
  timeline.addLabel('fade', 0.45);
  timeline.addLabel('spin', 0.6);
  timeline.addLabel('reveal', 0.75);
  timeline.addLabel('book', 0.9);
  timeline.to({}, { duration: 1 }, 0);

  ScrollTrigger.create({
    trigger: '#o-nas',
    start: 'top 80px',
    onToggle: (self) => document.querySelector('.nav').classList.toggle('is-solid', self.isActive),
  });

  onProgress(0);

  if (sceneApi) {
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !document.hidden) sceneApi.start();
      else sceneApi.stop();
    }, { threshold: 0.02 });
    watch.observe(hero);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sceneApi.stop();
      else if (hero.getBoundingClientRect().bottom > 0 && hero.getBoundingClientRect().top < window.innerHeight) {
        sceneApi.start();
      }
    });
  }

  if (captureMode()) poster.hidden = true;
  else requestAnimationFrame(() => poster.classList.add('is-hidden'));

  if (new URLSearchParams(window.location.search).has('debug')) {
    const note = document.createElement('p');
    note.className = 'debug-note';
    document.body.append(note);
    window.setInterval(() => {
      note.textContent = `${activeMode} · ${sceneApi ? sceneApi.getDrawCalls() : 0} draw`;
    }, 400);
  }

  expose({
    ready: true,
    mode: activeMode,
    getDrawCalls: () => (sceneApi ? sceneApi.getDrawCalls() : 0),
    scrollToRatio,
    setHeroProgress(progress) {
      const trigger = ScrollTrigger.getById('hero-pin');
      if (!trigger) return;
      const y = trigger.start + (trigger.end - trigger.start) * progress;
      lenis.scrollTo(y, { immediate: true });
      ScrollTrigger.update();
      onProgress(progress);
      if (sceneApi) sceneApi.render(0);
    },
  });
}

function scrollToRatio(ratio) {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = max * ratio;
  if (scroller) {
    scroller.scrollTo(y, { immediate: true });
    return;
  }
  window.scrollTo(0, y);
}

boot();
