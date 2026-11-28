import type { CustomerData, ProductData, VoiceParseItem, VoiceParseResult } from '@/lib/api';

type Language = 'hi' | 'en';

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

const NUMBER_WORDS: Record<string, string> = {
  ek: '1', ik: '1', एक: '1',
  do: '2', दो: '2',
  teen: '3', tin: '3', तीन: '3',
  char: '4', chaar: '4', चार: '4',
  paanch: '5', panch: '5', पांच: '5', पाँच: '5',
  chhe: '6', che: '6', छह: '6', छे: '6',
  saat: '7', सात: '7',
  aath: '8', आठ: '8',
  nau: '9', नौ: '9',
  das: '10', दस: '10',
  bees: '20', बीस: '20',
  dedh: '1.5', डेढ़: '1.5',
  dhai: '2.5', ढाई: '2.5',
  aadha: '0.5', adha: '0.5', आधा: '0.5',
  sau: '100', सौ: '100',
};

const UNIT_MAP: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', किलो: 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', ग्राम: 'g',
  l: 'l', ltr: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l', लीटर: 'l',
  ml: 'ml', एमएल: 'ml',
  packet: 'packet', packets: 'packet', pack: 'packet', packs: 'packet', पैकेट: 'packet',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', nag: 'piece', नग: 'piece',
  dozen: 'dozen', darjan: 'dozen', दर्जन: 'dozen',
  bottle: 'bottle', bottles: 'bottle', बोतल: 'bottle',
  box: 'box', boxes: 'box', डिब्बा: 'box',
};

const ALIASES: Record<string, string[]> = {
  atta: ['aata', 'flour', 'आटा'],
  chawal: ['rice', 'चावल'],
  dal: ['daal', 'दाल'],
  doodh: ['milk', 'दूध'],
  tel: ['oil', 'तेल'],
  cheeni: ['chini', 'sugar', 'चीनी'],
  chai: ['tea', 'चाय'],
  parantha: ['paratha', 'parata', 'prantha', 'पराठा', 'परांठा'],
  namak: ['salt', 'नमक'],
  sabun: ['soap', 'साबुन'],
  masala: ['मसाला'],
  biscuit: ['biskut', 'बिस्किट'],
  maggi: ['मैगी'],
  bread: ['ब्रेड'],
  ghee: ['घी'],
  paneer: ['पनीर'],
  anda: ['egg', 'eggs', 'अंडा', 'अंडे'],
  pyaz: ['onion', 'प्याज'],
  aloo: ['potato', 'आलू'],
  tamatar: ['tomato', 'टमाटर'],
  dahi: ['curd', 'दही'],
  mungfali: ['peanut', 'मूंगफली'],
  besan: ['बेसन'],
  sooji: ['suji', 'रवा', 'सूजी'],
  bhujia: ['भुजिया'],
  papad: ['पापड़'],
  agarbatti: ['अगरबत्ती'],
  matchbox: ['machis', 'माचिस'],
  shampoo: ['शैम्पू'],
  surf: ['detergent', 'सर्फ'],
};

const STOPWORDS = new Set([
  'aur', 'and', 'or', 'ya', 'yaa', 'plus', 'with', 'ke', 'ka', 'ki', 'ko', 'se', 'me', 'mein', 'par',
  'hai', 'hain', 'he', 'na', 'bhai', 'ji', 'sahab', 'sahib', 'please', 'plz',
  'bill', 'banao', 'bana', 'banaao', 'banaa', 'naya', 'new', 'aaj', 'today',
  'bhej', 'bhejo', 'bhejdo', 'dena', 'dedo', 'chahiye', 'de', 'deejiye',
  'rupaye', 'rupees', 'rupee', 'rs', 'discount', 'chhoot', 'chhut', 'off', 'kam',
  'percent', 'pratishat', 'udhaar', 'udhar', 'udhaari', 'credit', 'cash', 'upi',
  'card', 'baaki', 'baki', 'customer', 'naam', 'ग्राहक', 'और', 'या', 'के', 'का', 'की',
  'को', 'से', 'में', 'है', 'हैं', 'ना', 'भाई', 'जी', 'साहब', 'बिल', 'बनाओ',
  'बना', 'नया', 'आज', 'देना', 'देदो', 'चाहिए', 'रुपये', 'रुपए', 'डिस्काउंट',
  'छूट', 'कम', 'उधार', 'उधारी', 'क्रेडिट', 'नकद', 'बाकी', 'नाम',
  'gst', 'जीएसटी', 'isme', 'ismein', 'इसमें', 'sath', 'saath', 'साथ', 'k',
  'lagao', 'laga', 'lagado', 'lagade', 'lagana', 'apply', 'add', 'kardo', 'karo',
  'karna', 'sab', 'sabhi', 'सब', 'सभी', 'प्रतिशत', 'फीसदी', 'फ़ीसदी',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, d => DEVANAGARI_DIGITS[d] ?? d)
    .replace(/[^a-z0-9\u0900-\u097F\s.%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function replaceNumberWords(text: string): string {
  return text.split(' ').map(word => NUMBER_WORDS[word] ?? word).join(' ');
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

function canonicalTokens(tokens: string[]): string[] {
  const found = new Set<string>();
  for (const token of tokens) {
    for (const [canonical, variants] of Object.entries(ALIASES)) {
      if (token === canonical || variants.includes(token)) {
        found.add(canonical);
        for (const variant of variants) found.add(variant);
      }
    }
  }
  return Array.from(found);
}

function matchProduct(segmentTokens: string[], canonical: string[], products: ProductData[]): { product: ProductData; score: number } | null {
  let best: { product: ProductData; score: number } | null = null;
  for (const product of products) {
    const name = normalize(product.name);
    let score = 0;
    for (const token of segmentTokens) {
      if (token.length >= 3 && !STOPWORDS.has(token) && name.includes(token)) score += 2;
    }
    for (const token of canonical) {
      if (name === token) score += 6;
      else if (name.split(' ').includes(token) || name.includes(token)) score += 3;
    }
    if (score > 0 && (!best || score > best.score)) best = { product, score };
  }
  return best;
}

function matchCustomer(transcript: string, customers: CustomerData[]): CustomerData | null {
  const text = ` ${normalize(transcript)} `;
  let best: CustomerData | null = null;
  let bestLen = 0;
  for (const customer of customers) {
    const name = normalize(customer.name);
    if (!name) continue;
    if (text.includes(` ${name} `) && name.length > bestLen) {
      best = customer;
      bestLen = name.length;
      continue;
    }
    const first = name.split(' ')[0];
    if (first.length >= 3 && text.includes(` ${first} `) && first.length > bestLen) {
      best = customer;
      bestLen = first.length;
    }
  }
  return best;
}

function detectPayment(transcript: string): VoiceParseResult['payment_method'] {
  const text = normalize(transcript);
  if (/(udhaar|udhar|udhaari|baaki|baki|credit|उधार|बाकी)/.test(text)) return 'credit';
  if (/(\bupi\b|gpay|phonepe|paytm|online|ऑनलाइन)/.test(text)) return 'upi';
  if (/(\bcard\b|कार्ड)/.test(text)) return 'card';
  return 'cash';
}

function detectDiscount(transcript: string): VoiceParseResult['discount'] {
  const text = normalize(transcript);
  const percent = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|pratishat|प्रतिशत|फीसदी)/);
  if (percent) {
    const value = Number(percent[1]);
    if (value > 0) return { type: 'percentage', value: Math.min(100, value) };
  }
  const fixed = text.match(/(?:discount|chhoot|छूट|kam)\s*(?:of|ka|ki|₹|rs|rupees?|rupaye)?\s*(\d+(?:\.\d+)?)/)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(?:rupaye|rupees?|rs|₹|रुपये|रुपए)\s*(?:ka|ki)?\s*(?:discount|chhoot|off|kam|छूट|कम)/);
  if (fixed) {
    const value = Number(fixed[1]);
    if (value > 0) return { type: 'fixed', value: Math.min(999999, value) };
  }
  return null;
}

function extractQuantity(segment: string): { quantity: number; unit: string | null; clean: string } {
  let text = replaceNumberWords(normalize(segment));
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:rupaye|rupees?|rs|₹|रुपये|रुपए)\b/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  const unitPattern = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length).join('|');
  const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?`, 'i'));
  if (!match) return { quantity: 1, unit: null, clean: text };

  const quantity = Math.min(999999, Math.max(0.01, Number(match[1])));
  const rawUnit = (match[2] ?? '').toLowerCase();
  return {
    quantity,
    unit: rawUnit ? UNIT_MAP[rawUnit] ?? null : null,
    clean: text.replace(match[0], ' ').replace(/\s+/g, ' ').trim(),
  };
}

function displayName(segment: string, fallback: string): string {
  const cleaned = segment
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .split(' ')
    .filter(word => word && !STOPWORDS.has(word))
    .join(' ')
    .trim();
  const name = cleaned || fallback;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const QUANTITY_UPDATE_PATTERNS = [
  // Hindi: "X ko Y kardo/karo/karna/banao"
  /(\S.+?)\s+ko\s+(\S+?)\s+(kardo|karo|karna|karnaa|karnaa hai|banao|banana|bananaa)\b/gi,
  // Hindi: "X Y kardo/karo" (without ko)
  /(\S.+?)\s+(\S+?)\s+(kardo|karo|karna|banao)\b/gi,
  // English: "make X Y", "set X to Y", "change X to Y", "X to Y"
  /\b(make|set|change)\s+(\S.+?)\s+(to\s+)?(\S+)\b/gi,
  /\b(\S.+?)\s+to\s+(\S+)\b/gi,
];

const DELETE_PATTERNS = [
  // Hindi: "X remove kardo", "X delete kardo", "X hatao", "X hata do", "X remove karo"
  /(\S.+?)\s+(remove|delete|hatao|hata\s*do|hata\s*do)\s*(kardo|karo|karna)?\b/gi,
  // Hindi: "X ko remove kardo", "X ko delete kardo"
  /(\S.+?)\s+ko\s+(remove|delete|hatao|hata\s*do)\s*(kardo|karo|karna)?\b/gi,
  // English: "remove X", "delete X", "remove X from bill"
  /\b(remove|delete)\s+(\S.+?)\b/gi,
];

const NUMBER_WORDS_REV: Record<string, string> = {
  'ek': '1', 'ik': '1', 'एक': '1',
  'do': '2', 'दो': '2',
  'teen': '3', 'tin': '3', 'तीन': '3',
  'char': '4', 'chaar': '4', 'चार': '4',
  'paanch': '5', 'panch': '5', 'पांच': '5', 'पाँच': '5',
  'chhe': '6', 'che': '6', 'छह': '6', 'छे': '6',
  'saat': '7', 'सात': '7',
  'aath': '8', 'आठ': '8',
  'nau': '9', 'नौ': '9',
  'das': '10', 'दस': '10',
};

function wordToNumber(word: string): string | null {
  const normalized = word.toLowerCase().trim();
  if (/^\d+$/.test(normalized)) return normalized;
  return NUMBER_WORDS_REV[normalized] ?? null;
}

export function preprocessQuantityUpdates(transcript: string): string {
  let processed = transcript;
  
  for (const pattern of QUANTITY_UPDATE_PATTERNS) {
    processed = processed.replace(pattern, (match, ...groups) => {
      let itemName = '';
      let quantityWord = '';
      
      if (pattern.source.includes('ko\\s+')) {
        // Hindi "X ko Y kardo" pattern: groups = [itemName, quantityWord, actionWord]
        itemName = groups[0]?.trim() || '';
        quantityWord = groups[1]?.trim() || '';
      } else if (pattern.source.includes('make|set|change')) {
        // English "make/set/change X Y" or "make/set/change X to Y"
        // groups = [actionWord, itemName, 'to', quantityWord] or [actionWord, itemName, quantityWord]
        itemName = groups[1]?.trim() || '';
        quantityWord = groups[3]?.trim() || groups[2]?.trim() || '';
      } else if (pattern.source.includes('to')) {
        // "X to Y"
        itemName = groups[0]?.trim() || '';
        quantityWord = groups[1]?.trim() || '';
      }
      
      const quantity = wordToNumber(quantityWord);
      if (quantity && itemName) {
        // Convert to "quantity itemName" format that the parser understands
        return `${quantity} ${itemName}`;
      }
      return match;
    });
  }
  
  return processed;
}

export function preprocessDeleteCommands(transcript: string): string {
  let processed = transcript;
  
  for (const pattern of DELETE_PATTERNS) {
    processed = processed.replace(pattern, (match, ...groups) => {
      let itemName = '';
      
      if (pattern.source.includes('remove|delete.*\\+')) {
        // English "remove X", "delete X" - groups = [actionWord, itemName]
        itemName = groups[1]?.trim() || '';
      } else if (pattern.source.includes('ko\\s+')) {
        // Hindi "X ko remove kardo" - groups = [itemName, actionWord, actionVerb?]
        itemName = groups[0]?.trim() || '';
      } else {
        // Hindi "X remove kardo" - groups = [itemName, actionWord, actionVerb?]
        itemName = groups[0]?.trim() || '';
      }
      
      if (itemName) {
        // Mark for deletion with special prefix
        return `__DELETE__ ${itemName}`;
      }
      return match;
    });
  }
  
  return processed;
}

export interface GstUpdate {
  itemName: string;
  gstRate: number;
}

export interface GstExtraction {
  text: string;
  updates: GstUpdate[];
}

const GST_RATE_PATTERN = String.raw`(\d+(?:\.\d+)?)\s*(?:%|percent|pratishat|प्रतिशत|फीसदी|फ़ीसदी)?`;
const GST_WORD_PATTERN = String.raw`(?:gst|जीएसटी)`;
const GST_ACTION_WORD = String.raw`(?:add|apply|set|lagado|lagade|lagana|lagao|laga|kardo|karna|karo|kar|banao|dena|de|लगादो|लगाना|लगाओ|लगा|करदो|करो|कर|बनाओ|देना|दे|क\s+साथ|साथ|के\s+साथ)`;
const GST_ACTION_PATTERN = String.raw`(?:(?:(?:${GST_ACTION_WORD})\s*)+(?:\d+(?:\.\d+)?\s*)?)?`;

function clampGst(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function cleanGstItemName(value: string): string {
  return value
    .replace(/^\s*\d+(?:\.\d+)?\s+/, '')
    .replace(/^(?:aur|and|or|ya|plus|with|और|या)\s+/i, '')
    .replace(/\s+(?:aur|and|or|ya|plus|with|और|या)$/i, '')
    .trim();
}

function splitGstItemNames(value: string): string[] {
  return value
    .split(/\s+(?:aur|and|or|ya|plus|with|और|या)\s+/i)
    .map(part => cleanGstItemName(part))
    .filter(Boolean);
}

const BILL_WIDE_WORDS = new Set([
  'bill', 'बिल', 'is', 'इस', 'isme', 'ismein', 'इसमें',
  'sab', 'sabhi', 'सब', 'सभी', 'all', 'poora', 'pure', 'pura', 'puri', 'पूरा', 'पूरे', 'पूरी',
  'item', 'items', 'samaan', 'saman', 'सामान',
]);

function isBillWideName(value: string): boolean {
  const words = normalize(value).split(' ').filter(Boolean);
  return words.length > 0 && words.every(word => BILL_WIDE_WORDS.has(word));
}

/**
 * Pull spoken GST commands out of a transcript.
 *
 * Returns the transcript with the GST phrases removed plus the per-item and
 * bill-wide GST updates that were spoken. An update with an empty itemName
 * applies to the whole bill.
 */
export function extractGstCommands(transcript: string): GstExtraction {
  let text = replaceNumberWords(normalize(transcript));
  const updates: GstUpdate[] = [];

  const itemPatterns: Array<{ pattern: RegExp; itemGroup: number; rateGroup: number }> = [
    {
      // "chai me/mein/ko/par/pe 5% gst add kardo"
      pattern: new RegExp(String.raw`([a-z\u0900-\u097F][a-z0-9\u0900-\u097F\s]*?)\s+(?:me|mein|ko|par|pe|में|को|पर|पे)\s+${GST_RATE_PATTERN}\s*(?:ka|ki|ke|k|का|की|के)?\s*${GST_WORD_PATTERN}\s*${GST_ACTION_PATTERN}`, 'gi'),
      itemGroup: 1,
      rateGroup: 2,
    },
    {
      // "chai ka/ki gst 5% kardo"
      pattern: new RegExp(String.raw`([a-z\u0900-\u097F][a-z0-9\u0900-\u097F\s]*?)\s+(?:ka|ki|ke|का|की|के)\s+${GST_WORD_PATTERN}\s*${GST_RATE_PATTERN}\s*${GST_ACTION_PATTERN}`, 'gi'),
      itemGroup: 1,
      rateGroup: 2,
    },
    {
      // "add/set/apply 5% gst to/on/for chai"
      pattern: new RegExp(String.raw`(?:add|apply|set)\s+${GST_RATE_PATTERN}\s*${GST_WORD_PATTERN}\s+(?:to|on|for)\s+([a-z\u0900-\u097F][a-z0-9\u0900-\u097F\s]*)`, 'gi'),
      itemGroup: 2,
      rateGroup: 1,
    },
    {
      // "chai gst 5%"
      pattern: new RegExp(String.raw`([a-z\u0900-\u097F][a-z0-9\u0900-\u097F\s]*?)\s+${GST_WORD_PATTERN}\s*${GST_RATE_PATTERN}\s*${GST_ACTION_PATTERN}`, 'gi'),
      itemGroup: 1,
      rateGroup: 2,
    },
{
      // "item 5% gst k sath" or "item 5% gst saath" - per-item GST with item name
      pattern: new RegExp(String.raw`([a-z\u0900-\u097F][a-z0-9\u0900-\u097F\s]*?)\s+(\d+(?:\.\d+)?)\s*(?:%|pratishat|फीसदी|फ़ीसदी)?\s*(?:gst|जीएसटी)\s*(?:k\s+saath|saath|के\s+साथ|साथ)`, 'gi'),
      itemGroup: 1,
      rateGroup: 2,
    },
    {
      // "5% gst k sath" or "5% gst saath" - bill-wide GST without explicit item name
      pattern: new RegExp(String.raw`${GST_RATE_PATTERN}\s*${GST_WORD_PATTERN}\s*(?:k\s+saath|saath|के\s+साथ|साथ)`, 'gi'),
      itemGroup: -1,
      rateGroup: 1,
    },
  ];

  for (const { pattern, itemGroup, rateGroup } of itemPatterns) {
    text = text.replace(pattern, (_match, ...groups) => {
      let itemValue = '';
      if (itemGroup > 0 && itemGroup < groups.length) {
        itemValue = cleanGstItemName(String(groups[itemGroup - 1] ?? ''));
      }
      const rateValue = Number(groups[rateGroup - 1]);
      if (Number.isFinite(rateValue)) {
        if (itemGroup <= 0 || itemValue === '') {
          updates.push({ itemName: '', gstRate: clampGst(rateValue) });
        } else if (isBillWideName(itemValue)) {
          updates.push({ itemName: '', gstRate: clampGst(rateValue) });
        } else {
          for (const itemName of splitGstItemNames(itemValue)) {
            updates.push({ itemName, gstRate: clampGst(rateValue) });
          }
        }
      }
      return ' ';
    });
  }

  const billPatterns = [
    // "isme / bill me / sab par 5% gst add kardo"
    new RegExp(String.raw`(?:isme|ismein|इसमें|इस\s*बिल|is\s*bill|bill\s*(?:me|mein|par)|बिल\s*(?:में|पर)|sab\s*(?:me|mein|par)|sabhi\s*(?:me|mein|par)|sab\s*par)?\s*${GST_RATE_PATTERN}\s*(?:ka|ki|ke|k|का|की|के)?\s*${GST_WORD_PATTERN}\s*${GST_ACTION_PATTERN}`, 'gi'),
    // "gst 5%"
    new RegExp(String.raw`${GST_WORD_PATTERN}\s*(?:ka|ki|ke|k)?\s*${GST_RATE_PATTERN}\s*${GST_ACTION_PATTERN}`, 'gi'),
    // "5 gst" (percent word dropped by speech recognition)
    new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${GST_WORD_PATTERN}`, 'gi'),
  ];

  for (const pattern of billPatterns) {
    text = text.replace(pattern, (_match, ...groups) => {
      const rateValue = Number(groups[0]);
      if (Number.isFinite(rateValue)) {
        updates.push({ itemName: '', gstRate: clampGst(rateValue) });
      }
      return ' ';
    });
  }

  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:aur|and|or|ya|plus|with|और|या)(?:\s+|$)/i, '')
    .trim();

  return {
    text: isBillWideName(cleanedText) ? '' : cleanedText,
    updates,
  };
}

function aliasSet(text: string): Set<string> {
  const tokens = normalize(text).split(' ').filter(Boolean);
  const found = new Set<string>(tokens);
  for (const token of tokens) {
    for (const [canonical, variants] of Object.entries(ALIASES)) {
      if (token === canonical || variants.includes(token)) {
        found.add(canonical);
        for (const variant of variants) found.add(variant);
      }
    }
  }
  return found;
}

/**
 * Match a spoken item name against an existing bill line, including the
 * Hindi/Hinglish aliases used by the local parser (e.g. chai ~ Tea).
 */
export function itemNameMatches(existingName: string, spokenName: string): boolean {
  const existing = normalize(existingName);
  const spoken = normalize(spokenName);
  if (!existing || !spoken) return false;
  if (existing === spoken || existing.includes(spoken) || spoken.includes(existing)) return true;

  const existingSet = aliasSet(existingName);
  const spokenSet = aliasSet(spokenName);
  for (const token of spokenSet) {
    if (token.length >= 3 && existingSet.has(token)) return true;
  }

  return false;
}

export function parseBillLocally(
  transcript: string,
  language: Language,
  products: ProductData[],
  customers: CustomerData[],
): VoiceParseResult {
  // Pull GST commands out first so they never become items or discounts.
  const gst = extractGstCommands(transcript);

  // Preprocess quantity update commands like "chai ko chaar kardo" -> "4 chai"
  let processedTranscript = preprocessQuantityUpdates(gst.text);
  // Preprocess delete commands like "alu paratha remove kardo" -> "delete alu paratha"
  processedTranscript = preprocessDeleteCommands(processedTranscript);

  const paymentMethod = detectPayment(gst.text);
  const discount = detectDiscount(gst.text);
  const customer = matchCustomer(gst.text, customers);
  const segments = normalize(processedTranscript)
    .split(/[,+&]|\baur\b|\band\b|\bor\b|\bya\b|\bke saath\b|\bwith\b|और|या/)
    .map(part => part.trim())
    .filter(Boolean);

  const items: VoiceParseItem[] = [];
  const byProduct = new Map<string, number>();
  const deleteItems: string[] = [];
  const billWideGst = [...gst.updates].reverse().find(update => !update.itemName)?.gstRate;

  const gstRateFor = (productName: string): number => {
    const itemUpdate = [...gst.updates].reverse().find(
      update => update.itemName && itemNameMatches(productName, update.itemName),
    );
    if (itemUpdate) return itemUpdate.gstRate;
    return billWideGst ?? 0;
  };

  for (const segment of segments) {
    // Check if this is a delete command (starts with "delete" after normalization)
    if (segment.toLowerCase().startsWith('delete')) {
      const itemName = segment.replace(/^delete\s+/i, '').trim();
      if (itemName) {
        deleteItems.push(itemName.toLowerCase());
      }
      continue;
    }

    const tokens = tokenize(segment);
    if (!tokens.length) continue;
    const canonical = canonicalTokens(tokens);
    const { quantity, unit, clean } = extractQuantity(segment);
    const match = matchProduct(tokens, canonical, products);

    if (match) {
      const key = match.product.id;
      const existing = byProduct.get(key);
      if (existing !== undefined) {
        byProduct.set(key, Math.min(999999, existing + quantity));
        continue;
      }
      byProduct.set(key, quantity);
      items.push({
        product_uuid: match.product.id,
        name: match.product.name,
        price: Number(match.product.price) || 0,
        quantity,
        unit: unit ?? match.product.unit ?? 'piece',
        gst_rate: gstRateFor(match.product.name),
        confidence: 0.6,
        resolved: true,
        spoken_name: clean || match.product.name,
      });
      continue;
    }

    const meaningful = tokens.filter(word => !STOPWORDS.has(word) && !/\d/.test(word) && !UNIT_MAP[word]);
    if (!meaningful.length) continue;

    items.push({
      product_uuid: null,
      name: displayName(clean || segment, language === 'hi' ? 'अज्ञात सामान' : 'Unknown item'),
      price: 0,
      quantity,
      unit: unit ?? 'piece',
      gst_rate: billWideGst ?? 0,
      confidence: 0.2,
      resolved: false,
      spoken_name: clean || segment,
    });
  }

  return {
    items,
    deleteItems,
    gstUpdates: gst.updates,
    customer: customer
      ? { uuid: customer.id, name: customer.name, phone: customer.phone }
      : null,
    customer_name: customer?.name ?? '',
    payment_method: paymentMethod,
    discount,
    notes: '',
    assistant_reply: language === 'hi'
      ? 'ऑफ़लाइन समझ से ड्राफ्ट बना है। कृपया जांच कर लें।'
      : 'Draft built with local parsing. Please review before saving.',
    source: 'local',
  };
}
