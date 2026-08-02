/**
 * Small rule-based parsers for the Gujarati voice order assistant. There's no
 * LLM behind this bot — every "understood" answer here is a keyword/pattern
 * match against what the speech recognizer transcribes, so it only covers the
 * phrasings a shop owner is realistically going to use for each question.
 */

const YES_WORDS = ['હા', 'હ', 'ha', 'haa', 'han', 'yes', 'ok', 'okay', 'બરાબર'];
const NO_WORDS = ['ના', 'નહિ', 'નહીં', 'na', 'nahi', 'nahin', 'no', 'નકો'];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function containsAny(text: string, words: string[]): boolean {
  const n = normalize(text);
  return words.some((w) => n.includes(w.toLowerCase()));
}

export function parseYesNo(text: string): boolean | null {
  if (containsAny(text, NO_WORDS)) return false;
  if (containsAny(text, YES_WORDS)) return true;
  return null;
}

export type ClientType = 'new' | 'existing' | 'unknown';

const NEW_CLIENT_WORDS = ['નવો', 'નવો ગ્રાહક', 'navo', 'new'];
const EXISTING_CLIENT_WORDS = ['જૂનો', 'જુનો', 'juno', 'old', 'existing'];
const UNKNOWN_CLIENT_WORDS = ['ખબર નથી', 'khabar nathi', 'nathi khabar', "don't know", 'khabar nathi'];

export function parseClientType(text: string): ClientType | null {
  if (containsAny(text, UNKNOWN_CLIENT_WORDS)) return 'unknown';
  if (containsAny(text, NEW_CLIENT_WORDS)) return 'new';
  if (containsAny(text, EXISTING_CLIENT_WORDS)) return 'existing';
  return null;
}

export type GarmentChoice = 'Shirt' | 'Pant' | 'Shirt+Pant';

const SHIRT_WORDS = ['શર્ટ', 'shirt', 'khamis'];
const PANT_WORDS = ['પેન્ટ', 'pant', 'trouser'];

export function parseGarmentChoice(text: string): GarmentChoice | null {
  const hasShirt = containsAny(text, SHIRT_WORDS);
  const hasPant = containsAny(text, PANT_WORDS);
  if (hasShirt && hasPant) return 'Shirt+Pant';
  if (hasShirt) return 'Shirt';
  if (hasPant) return 'Pant';
  return null;
}

/** A small Gujarati number-word fallback for when the recognizer transcribes
 * spoken digits as words instead of numerals (most recognizers give numerals,
 * so this only needs to cover common small numbers). */
const GUJARATI_NUMBER_WORDS: Record<string, number> = {
  એક: 1,
  બે: 2,
  ત્રણ: 3,
  ચાર: 4,
  પાંચ: 5,
  છ: 6,
  સાત: 7,
  આઠ: 8,
  નવ: 9,
  દસ: 10,
};

/** First number found in free-form speech — digits first, then Gujarati number words. */
export function extractFirstNumber(text: string): number | null {
  const digitMatch = text.match(/\d+(\.\d+)?/);
  if (digitMatch) return Number(digitMatch[0]);

  const n = normalize(text);
  for (const [word, value] of Object.entries(GUJARATI_NUMBER_WORDS)) {
    if (n.includes(word)) return value;
  }
  return null;
}

/** A 10-digit Indian mobile number anywhere in the utterance. */
export function extractPhoneNumber(text: string): string | null {
  const digitsOnly = text.replace(/\D/g, '');
  const match = digitsOnly.match(/\d{10}/);
  return match ? match[0] : null;
}

/** Strips a phone number and filler words out of "name + phone" speech, leaving just the name. */
export function extractNameAroundPhone(text: string, phone: string | null): string {
  let cleaned = phone ? text.replace(phone, ' ') : text;
  cleaned = cleaned.replace(/\d+/g, ' ');
  const fillers = ['naam', 'name', 'નામ', 'mobile', 'number', 'નંબર', 'મોબાઈલ', 'છે', 'ane', 'અને'];
  for (const f of fillers) {
    cleaned = cleaned.replace(new RegExp(f, 'gi'), ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

export type ClothOrderSummary = { shirtCount: number; pantCount: number };

const PAIR_WORDS = ['જોડ', 'jod', 'pair'];

/**
 * Parses free-form speech about how many pieces of clothing, e.g. "બે જોડ
 * કપડાં અને એક વધારે શર્ટ" (two pairs of clothes and one extra shirt) into
 * shirt/pant counts. A "pair" counts as one shirt + one pant.
 */
export function parseClothCounts(text: string): ClothOrderSummary {
  const n = normalize(text);
  let shirtCount = 0;
  let pantCount = 0;

  const pairMatch = PAIR_WORDS.map((w) => {
    const idx = n.indexOf(w);
    if (idx === -1) return null;
    const before = n.slice(0, idx);
    const num = extractFirstNumber(before) ?? 1;
    return num;
  }).find((v) => v !== null);
  if (pairMatch) {
    shirtCount += pairMatch;
    pantCount += pairMatch;
  }

  const shirtIdx = SHIRT_WORDS.map((w) => n.indexOf(w)).find((i) => i !== -1);
  if (shirtIdx !== undefined && shirtIdx !== -1) {
    const before = n.slice(0, shirtIdx);
    shirtCount += extractFirstNumber(before) ?? 1;
  }

  const pantIdx = PANT_WORDS.map((w) => n.indexOf(w)).find((i) => i !== -1);
  if (pantIdx !== undefined && pantIdx !== -1) {
    const before = n.slice(0, pantIdx);
    pantCount += extractFirstNumber(before) ?? 1;
  }

  // Nothing recognizable — fall back to treating the first spoken number as a
  // plain piece count of one shirt-equivalent item.
  if (shirtCount === 0 && pantCount === 0) {
    const fallback = extractFirstNumber(text) ?? 1;
    shirtCount = fallback;
  }

  return { shirtCount, pantCount };
}
