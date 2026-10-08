/**
 * The four commercial models a partner can be on.
 *
 * Mirrors mprnt-backend/src/types/businessModels.ts, which in turn mirrors
 * MPrnt/main/src/lib/models.ts — the website's /for-businesses page is the
 * source of truth for the wording. Change all three together.
 *
 * Only the ids are stored. Everything else here is presentation.
 */

export const BUSINESS_MODEL_IDS = [
  'integration',
  'revenue-share',
  'own-station',
  'full-purchase',
] as const;

export type BusinessModelId = (typeof BUSINESS_MODEL_IDS)[number];

export interface BusinessModelInfo {
  id: BusinessModelId;
  /** As the website labels it: "Model 1", "Model 2 · Option A", … */
  label: string;
  /** For chips and dense tables, where the full label will not fit. */
  short: string;
  name: string;
  /** Whether the hardware is an MPrnt station or the partner's own printer. */
  family: 'Printer Integration' | 'MPRNT Station';
  /** One line explaining the commercial arrangement, for the picker. */
  hint: string;
}

export const BUSINESS_MODELS: BusinessModelInfo[] = [
  {
    id: 'integration',
    label: 'Model 1',
    short: 'Model 1',
    name: 'Printer Integration',
    family: 'Printer Integration',
    hint: 'Partner’s own printer. No station. They keep the printing revenue.',
  },
  {
    id: 'revenue-share',
    label: 'Model 2 · Option A',
    short: 'Model 2A',
    name: 'Station · Revenue Share',
    family: 'MPRNT Station',
    hint: 'MPrnt installs and runs the station. Revenue is shared.',
  },
  {
    id: 'own-station',
    label: 'Model 2 · Option B',
    short: 'Model 2B',
    name: 'Station · Purchase + Monthly Software',
    family: 'MPRNT Station',
    hint: 'Partner buys the station and pays monthly for software. MPrnt still helps operate it.',
  },
  {
    id: 'full-purchase',
    label: 'Model 3',
    short: 'Model 3',
    name: 'Station · Full Purchase & Support',
    family: 'MPRNT Station',
    hint: 'Partner buys the station outright and runs it independently.',
  },
];

const BY_ID = new Map(BUSINESS_MODELS.map((m) => [m.id, m]));

export function businessModel(id: string | null | undefined): BusinessModelInfo | null {
  return id ? BY_ID.get(id as BusinessModelId) ?? null : null;
}

/** Label for a partner whose model has not been recorded yet. */
export const NO_MODEL_LABEL = 'No model set';
