/**
 * On desktop the page fills the window: the title, filters and notes stay where
 * they are, and only the list scrolls, with its page numbers always in view. On
 * phones the page scrolls as usual, because a short scroll box inside a phone
 * screen is harder to use than the page itself.
 */
export const LIST_PAGE = 'space-y-6 lg:flex lg:h-[calc(100dvh-7.5rem)] lg:flex-col lg:gap-6 lg:space-y-0';
export const LIST_CARD = 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col';
export const LIST_BODY = 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto';

/** After a page change, bring the top of the list into view. */
export function scrollListToTop(el: HTMLElement | null) {
  if (!el) return;
  if (window.matchMedia('(min-width: 1024px)').matches) {
    el.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
