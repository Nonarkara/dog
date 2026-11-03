/**
 * THE MATHEMATICS OF THE CONDITIONED DOG.
 *
 * Three published models, one memory:
 *
 *   RESCORLA–WAGNER (1972) — acquisition and extinction. On every pairing,
 *     ΔV = α·β·(λ − V)
 *   where V is the associative strength of the cue, λ the outcome's maximum,
 *   α the cue's salience, β the outcome's efficacy. Learning is fast while V
 *   is far from λ and slows as it approaches — the acquisition curve real
 *   dogs show. When the cue arrives and the outcome does NOT, (λ − V) flips
 *   sign and the same equation extinguishes the association.
 *
 *   PEARCE–HALL (1978) — adaptive attention. α is not fixed: it stays high
 *   while the cue's outcome is still surprising and falls once the outcome
 *   is fully predicted. α_next = floor + (1−floor)·|λ − V_next|. An omitted
 *   outcome is itself surprising, so omission RAISES attention back.
 *
 *   SPONTANEOUS RECOVERY — extinction is not erasure. The cue remembers its
 *   peak (V_peak). After a rest, an extinguished cue partially returns:
 *     V += (V_peak − V)·(1 − e^(−rest/τ))·r
 *   partial (r < 1), never past the remembered peak. This is why a dog who
 *   once knew "dinner" re-answers it after months better than a naive dog.
 *
 * Persistence is structural: V, peak, α and the timestamps live in the
 * dog's saved state (browser, then cloud), so the memory survives sessions,
 * devices and weeks.
 *
 * Blocking (Kamin, 1968) falls out of the compound form for free: when
 * several cues are present, each learns from the SHARED prediction error
 * (λ − ΣV), so a cue paired alongside an already-strong cue learns little.
 */

/** One cue's saved memory: what the dog believes and how fast he'll learn. */
export interface CueMemory {
  /** The strongest V ever reached — what spontaneous recovery returns toward. */
  peak: number;
  /** Adaptive attention, ALPHA_FLOOR..1 (Pearce–Hall). */
  alpha: number;
  /** Last reinforced pairing. */
  lastPairAt: number;
  /** Last time the cue was presented at all (said), for rest intervals. */
  lastSeenAt: number;
  /** Reinforced pairings so far. */
  pairings: number;
}

export const LAMBDA = 1; // a care outcome fully delivered supports full strength
export const ALPHA_FLOOR = 0.15;
export const BETA_EXTINCTION = 0.55;
/** Recovery: partial, τ = 6 h — a night's rest returns about a third. */
export const RECOVERY_TAU_HOURS = 6;
export const RECOVERY_FRACTION = 0.35;
/** Rest needed before spontaneous recovery may act. */
export const RECOVERY_REST_MINUTES = 45;

/** Outcome efficacy β: food is the strongest unconditioned stimulus there is. */
export const BETA_BY_ACTION: Record<string, number> = {
  feed: 1,
  rewardCalm: 0.9,
  pet: 0.7,
  play: 0.6,
  walk: 0.5,
  groom: 0.4,
  medicine: 0.3,
  clean: 0.25,
  settle: 0.2,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** RW trial for one cue. Mutates nothing; returns the new V and next α. */
export function rescorlaWagner(
  v: number,
  alpha: number,
  beta: number,
  lambda = LAMBDA
): { v: number; deltaV: number; alphaNext: number } {
  const deltaV = alpha * beta * (lambda - v);
  const vNext = clamp01(v + deltaV);
  // PEARCE-HALL: attention for the NEXT trial follows this trial's surprise.
  const alphaNext = clamp01(ALPHA_FLOOR + (1 - ALPHA_FLOOR) * Math.abs(lambda - vNext));
  return { v: vNext, deltaV, alphaNext };
}

/** A compound trial: several cues share one prediction error (Kamin's blocking). */
export function rescorlaWagnerCompound(
  strengths: number[],
  alphas: number[],
  beta: number,
  lambda = LAMBDA
): { vs: number[]; alphaNexts: number[]; sharedError: number } {
  const sharedError = lambda - strengths.reduce((s, v) => s + v, 0);
  const vs = strengths.map((v, i) => clamp01(v + alphas[i] * beta * sharedError));
  const alphaNexts = vs.map((v) => clamp01(ALPHA_FLOOR + (1 - ALPHA_FLOOR) * Math.abs(lambda - v)));
  return { vs, alphaNexts, sharedError };
}

/**
 * The dog's whole cue book: acquire, extinguish, recover.
 * `memory` maps cue → state; `strengths` maps cue → V (kept in
 * state.associations so older saves keep working).
 */
export interface CueBook {
  strengths: Record<string, number>;
  memory: Record<string, CueMemory>;
}

/** Cue presented (said). Updates salience timestamps only — no learning yet. */
export function presentCue(book: CueBook, cue: string, now: number): void {
  const key = cue.trim().toLowerCase();
  if (!key) return;
  const m = book.memory[key];
  book.memory[key] = {
    peak: m?.peak ?? book.strengths[key] ?? 0,
    alpha: m?.alpha ?? clamp01(ALPHA_FLOOR + 0.45),
    lastPairAt: m?.lastPairAt ?? 0,
    lastSeenAt: now,
    pairings: m?.pairings ?? 0,
  };
}

/** Pairing trial: the cue was followed by the outcome inside the window. */
export function reinforceCue(book: CueBook, cue: string, beta: number, now: number): number {
  const key = cue.trim().toLowerCase();
  if (!key) return 0;
  const m = book.memory[key] ?? {
    peak: book.strengths[key] ?? 0,
    alpha: 0.6,
    lastPairAt: 0,
    lastSeenAt: now,
    pairings: 0,
  };
  const v = book.strengths[key] ?? 0;
  const { v: vNext, alphaNext } = rescorlaWagner(v, m.alpha, beta);
  book.strengths[key] = vNext;
  book.memory[key] = {
    peak: Math.max(m.peak, vNext),
    alpha: alphaNext,
    lastPairAt: now,
    lastSeenAt: now,
    pairings: m.pairings + 1,
  };
  return vNext - v;
}

/** Omission trial: the cue was presented, the window closed, nothing came. */
export function extinguishCue(book: CueBook, cue: string, now: number): number {
  const key = cue.trim().toLowerCase();
  if (!key) return 0;
  const m = book.memory[key];
  const v = book.strengths[key] ?? 0;
  if (!m || v <= 0) return 0;
  const deltaV = -m.alpha * BETA_EXTINCTION * v;
  const vNext = Math.max(0, v + deltaV);
  book.strengths[key] = vNext;
  // An omitted outcome is surprising: attention rises (Pearce–Hall).
  book.memory[key] = {
    ...m,
    alpha: clamp01(m.alpha + 0.25),
    lastSeenAt: now,
  };
  return deltaV;
}

/**
 * Spontaneous recovery: run once per decayed hour. Cues resting below their
 * remembered peak creep back toward a fraction of it. A cue seen recently
 * (paired or extinguished) does not recover — rest is the condition.
 */
export function spontaneousRecovery(book: CueBook, hours: number, now: number): void {
  if (hours <= 0) return;
  for (const key of Object.keys(book.memory)) {
    const m = book.memory[key];
    const v = book.strengths[key] ?? 0;
    if (v >= m.peak) continue;
    const sinceSeen = (now - m.lastSeenAt) / 60_000;
    if (sinceSeen < RECOVERY_REST_MINUTES) continue;
    const r = (1 - Math.exp(-hours / RECOVERY_TAU_HOURS)) * RECOVERY_FRACTION;
    book.strengths[key] = Math.min(m.peak, v + (m.peak - v) * r);
  }
}

/** Build the cue book from a dog state's two stores, synthesizing gaps. */
export function cueBook(
  strengths: Record<string, number>,
  memory: Record<string, CueMemory> | undefined
): CueBook {
  const strengthsCopy = { ...strengths };
  const memoryCopy: Record<string, CueMemory> = { ...(memory ?? {}) };
  // Every strength needs a memory entry; every memory entry needs a strength.
  for (const [key, v] of Object.entries(strengthsCopy)) {
    if (!memoryCopy[key]) {
      memoryCopy[key] = {
        peak: v,
        alpha: 0.6,
        lastPairAt: 0,
        lastSeenAt: 0,
        pairings: v > 0 ? 1 : 0,
      };
    }
  }
  for (const key of Object.keys(memoryCopy)) {
    if (strengthsCopy[key] === undefined) strengthsCopy[key] = 0;
  }
  return { strengths: strengthsCopy, memory: memoryCopy };
}
