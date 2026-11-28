import { useEffect } from 'react';

const REVEAL_SELECTOR = [
  '.dashboard-depth-main section',
  '.dashboard-depth-main article',
  '.admin-depth-shell main section',
  '.admin-depth-shell main article',
].join(',');

/** Light motion for the app: scroll progress bar and gentle reveals. Visual only. */
export function AppMotion() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    const onScroll = () => {
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty('--ky-progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('ky-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });

    const seen = new WeakSet<Element>();
    const scan = () => {
      if (reduced) return;
      let batch = 0;
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        // Blocks already on screen appear right away, so nothing flashes or hides content.
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) return;
        el.classList.add('ky-reveal');
        el.style.setProperty('--ky-delay', (batch++ % 3) * 60 + 'ms');
        observer.observe(el);
      });
    };
    scan();
    let pending = 0;
    const mutation = new MutationObserver(() => {
      if (pending) return;
      pending = window.requestAnimationFrame(() => { pending = 0; scan(); });
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
      mutation.disconnect();
      if (pending) cancelAnimationFrame(pending);
    };
  }, []);

  return <div className="ky-progress" aria-hidden="true" />;
}
