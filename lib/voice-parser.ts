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

export function parseBillLocally(
  transcript: string,
  language: Language,
  products: ProductData[],
  customers: CustomerData[],
): VoiceParseResult {
  const paymentMethod = detectPayment(transcript);
  const discount = detectDiscount(transcript);
  const customer = matchCustomer(transcript, customers);
  const segments = normalize(transcript)
    .split(/[,+&]|\baur\b|\band\b|\bor\b|\bya\b|\bke saath\b|\bwith\b|और|या/)
    .map(part => part.trim())
    .filter(Boolean);

  const items: VoiceParseItem[] = [];
  const byProduct = new Map<string, number>();

  for (const segment of segments) {
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
        gst_rate: 0,
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
      gst_rate: 0,
      confidence: 0.2,
      resolved: false,
      spoken_name: clean || segment,
    });
  }

  return {
    items,
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
