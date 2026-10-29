'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export interface Highlight {
  key: string;
  eyebrow: string;
  figure: string;
  line: string;
  href: string;
  action: string;
  featured?: boolean;
}

/**
 * The few numbers that matter, one per card, swiped or stepped through like the
 * stories in a reel. Each card has one link, so the next step is never a guess.
 */
export function HighlightStrip({ items }: { items: Highlight[] }) {
  const track = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);

  const slides = (): HTMLElement[] => Array.from(track.current?.children ?? []) as HTMLElement[];

  // The card nearest the left edge is the one showing.
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    let best = 0;
    slides().forEach((slide, i) => {
      if (Math.abs(slide.offsetLeft - el.scrollLeft) < Math.abs(slides()[best].offsetLeft - el.scrollLeft)) best = i;
    });
    setIndex(best);
  };

  const go = (i: number) => {
    const el = track.current;
    const target = slides()[i];
    if (!el || !target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section aria-label="At a glance" className="rise" style={{ ['--i' as string]: 0 }}>
      <div
        ref={track}
        onScroll={onScroll}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
      >
        {items.map((it) => (
          <article
            key={it.key}
            className={`flex min-h-[188px] shrink-0 snap-start basis-[88%] flex-col justify-between rounded-3xl p-5 sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.67rem)] ${
              it.featured ? 'bg-primary text-white' : 'border border-border/70 bg-surface shadow-card'
            }`}
          >
            <p className={`text-sm font-medium ${it.featured ? 'text-white/80' : 'text-text-muted'}`}>{it.eyebrow}</p>
            <p className="text-[2.5rem] font-semibold leading-none tracking-tight tabular">{it.figure}</p>
            <div className="flex items-end justify-between gap-3">
              <p className={`text-sm ${it.featured ? 'text-white/85' : 'text-text-muted'}`}>{it.line}</p>
              <Link
                href={it.href}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium ${
                  it.featured ? 'text-white underline-offset-4 hover:underline' : 'text-accent hover:underline'
                }`}
              >
                {it.action} <Icon name="chevronRight" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Only needed when the cards run off the edge. On a wide screen they all fit. */}
      <div className="mt-3 flex items-center justify-between lg:hidden">
        <div className="flex">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${it.eyebrow}`}
              aria-current={i === index}
              className="flex h-11 w-6 items-center justify-center"
            >
              <span className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-primary' : 'w-2 bg-border'}`} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-surface text-text transition-colors hover:bg-surface-secondary disabled:opacity-40"
          >
            <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index >= items.length - 1}
            aria-label="Next"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-surface text-text transition-colors hover:bg-surface-secondary disabled:opacity-40"
          >
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
