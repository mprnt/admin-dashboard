/**
 * MPrnt's own contact details, shown to shop staff so they can reach the
 * platform directly (refunds, pricing, anything a shop cannot do itself).
 *
 * Mirrors SITE in MPrnt/main/src/lib/site.ts, the official details from the
 * Terms & Privacy Policy. Change both together. Env vars override for staging.
 */
export const SUPPORT = {
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'mprntindore@gmail.com',
  phone: {
    display: process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY || '+91 89894 94417',
    tel: process.env.NEXT_PUBLIC_SUPPORT_PHONE_TEL || '+918989494417',
  },
} as const;

/** mailto: link with the subject (and optionally body) already filled in. */
export function supportMailto(subject: string, body?: string): string {
  const q = new URLSearchParams({ subject });
  if (body) q.set('body', body);
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${SUPPORT.email}?${q.toString().replace(/\+/g, '%20')}`;
}

export const supportTel = `tel:${SUPPORT.phone.tel}`;
