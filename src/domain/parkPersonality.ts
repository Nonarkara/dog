/**
 * HOW EACH DOG SPENDS AN AFTERNOON IN THE PARK.
 *
 * Every dog picks its next activity from its own weights, drawn from its
 * record (src/data/defaultDogs.ts) and play profile (dogPlay.ts):
 *
 *   Expo     "Observant & Calm Sovereign", "Selective Socializer",
 *            "Monitors the perimeter from high ground". Walks to a lookout
 *            and sits watching; rarely starts a chase; visits his sister.
 *   Mali     "Food-motivated", "Energetic", "Affectionate", Expo's sister.
 *            Keeps checking the water bowl; visits friends; favours Expo.
 *   Oreo     "Again! Again!", the fastest and bounciest, idles with a play
 *            bow. Starts most chases.
 *   Paolo    The slowest pace, "Worth waking up for". Naps often and long.
 *   Hachiku  Named for Hachikō, the Akita who waited. Calm and independent:
 *            walks to the bench and sits waiting; mostly keeps to himself.
 */

export type Activity = 'wander' | 'visit' | 'chase' | 'rest' | 'lookout' | 'bowl' | 'nap' | 'wait';

export interface ParkPersonality {
  weights: Record<Activity, number>;
  /** The dog this one goes to first, when it is there. */
  favourite?: string;
  /** Multiplies how long it stays down, sitting or napping. */
  linger: number;
  /** How far it wanders from its spot, in park units. */
  roam: number;
}

const none: Record<Activity, number> = { wander: 0, visit: 0, chase: 0, rest: 0, lookout: 0, bowl: 0, nap: 0, wait: 0 };

export const PARK_PERSONALITIES: Record<string, ParkPersonality> = {
  'expo-2021': { weights: { ...none, wander: 3, visit: 2, chase: 0.5, rest: 1, lookout: 4 }, favourite: 'mali-2022', linger: 1.2, roam: 420 },
  'mali-2022': { weights: { ...none, wander: 2, visit: 4, chase: 1.5, rest: 1, bowl: 3 }, favourite: 'expo-2021', linger: 0.9, roam: 380 },
  'oreo-frenchie': { weights: { ...none, wander: 2, visit: 2, chase: 5, rest: 0.5 }, linger: 0.6, roam: 520 },
  'paolo-pug': { weights: { ...none, wander: 1.5, visit: 1.5, chase: 0.7, rest: 2, nap: 4 }, linger: 1.8, roam: 220 },
  'shiba-chai': { weights: { ...none, wander: 3, visit: 0.7, chase: 0.5, rest: 1, wait: 4 }, linger: 1.5, roam: 460 },
};

const GENERIC: ParkPersonality = { weights: { ...none, wander: 4, visit: 2, chase: 2, rest: 1.5 }, linger: 1, roam: 400 };

export const personalityOf = (artId: string): ParkPersonality => PARK_PERSONALITIES[artId] ?? GENERIC;

/**
 * The next activity for a dog, from a random number in [0, 1). Activities
 * that need a friend are skipped when no friend is free to play.
 */
export function chooseActivity(artId: string, random: number, friendsFree: boolean): Activity {
  const w = personalityOf(artId).weights;
  const options = (Object.keys(w) as Activity[]).filter((a) => w[a] > 0 && (friendsFree || (a !== 'visit' && a !== 'chase')));
  const total = options.reduce((sum, a) => sum + w[a], 0);
  let r = random * total;
  for (const a of options) {
    r -= w[a];
    if (r < 0) return a;
  }
  return options[options.length - 1] ?? 'wander';
}
