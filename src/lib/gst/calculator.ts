/**
 * Auto Audit GST & Financial Calculation Engine
 * Indian Goods & Services Tax (GST) compliant rules and utilities.
 */

export interface IndianState {
  code: string;
  name: string;
  tin: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: 'AN', name: 'Andaman and Nicobar Islands', tin: '35' },
  { code: 'AP', name: 'Andhra Pradesh', tin: '37' },
  { code: 'AR', name: 'Arunachal Pradesh', tin: '12' },
  { code: 'AS', name: 'Assam', tin: '18' },
  { code: 'BR', name: 'Bihar', tin: '10' },
  { code: 'CH', name: 'Chandigarh', tin: '04' },
  { code: 'CT', name: 'Chhattisgarh', tin: '22' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu', tin: '26' },
  { code: 'DL', name: 'Delhi', tin: '07' },
  { code: 'GA', name: 'Goa', tin: '30' },
  { code: 'GJ', name: 'Gujarat', tin: '24' },
  { code: 'HR', name: 'Haryana', tin: '06' },
  { code: 'HP', name: 'Himachal Pradesh', tin: '02' },
  { code: 'JK', name: 'Jammu and Kashmir', tin: '01' },
  { code: 'JH', name: 'Jharkhand', tin: '20' },
  { code: 'KA', name: 'Karnataka', tin: '29' },
  { code: 'KL', name: 'Kerala', tin: '32' },
  { code: 'LA', name: 'Ladakh', tin: '38' },
  { code: 'LD', name: 'Lakshadweep', tin: '31' },
  { code: 'MP', name: 'Madhya Pradesh', tin: '23' },
  { code: 'MH', name: 'Maharashtra', tin: '27' },
  { code: 'MN', name: 'Manipur', tin: '14' },
  { code: 'ML', name: 'Meghalaya', tin: '17' },
  { code: 'MZ', name: 'Mizoram', tin: '15' },
  { code: 'NL', name: 'Nagaland', tin: '13' },
  { code: 'OD', name: 'Odisha', tin: '21' },
  { code: 'PY', name: 'Puducherry', tin: '34' },
  { code: 'PB', name: 'Punjab', tin: '03' },
  { code: 'RJ', name: 'Rajasthan', tin: '08' },
  { code: 'SK', name: 'Sikkim', tin: '11' },
  { code: 'TN', name: 'Tamil Nadu', tin: '33' },
  { code: 'TS', name: 'Telangana', tin: '36' },
  { code: 'TR', name: 'Tripura', tin: '16' },
  { code: 'UP', name: 'Uttar Pradesh', tin: '09' },
  { code: 'UK', name: 'Uttarakhand', tin: '05' },
  { code: 'WB', name: 'West Bengal', tin: '19' },
];

export const STANDARD_GST_RATES = [0, 5, 12, 18, 28] as const;

export interface ItemCalculationInput {
  quantity: number;
  unitPrice: number;
  discountPercentage?: number | undefined;
  discountAmount?: number | undefined;
  gstRate: number; // e.g. 18 for 18%
  taxInclusive?: boolean | undefined;
}

export interface ItemCalculationResult {
  grossAmount: number;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
}

export function isInterState(businessState: string, placeOfSupply: string): boolean {
  if (!businessState || !placeOfSupply) return false;
  return businessState.trim().toLowerCase() !== placeOfSupply.trim().toLowerCase();
}

/**
 * Calculates line-item GST, tax breakdowns, and final amounts.
 */
export function calculateLineItem(
  item: ItemCalculationInput,
  businessState: string,
  placeOfSupply: string
): ItemCalculationResult {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.unitPrice) || 0);
  const rate = Math.max(0, Number(item.gstRate) || 0);
  const gross = qty * price;

  let disc = 0;
  if (item.discountAmount !== undefined && item.discountAmount > 0) {
    disc = Math.min(gross, Number(item.discountAmount) || 0);
  } else if (item.discountPercentage !== undefined && item.discountPercentage > 0) {
    const pct = Math.min(100, Math.max(0, Number(item.discountPercentage) || 0));
    disc = (gross * pct) / 100;
  }

  const postDiscount = Math.max(0, gross - disc);
  let taxable = 0;
  let tax = 0;
  let total = 0;

  if (item.taxInclusive) {
    total = postDiscount;
    taxable = round2(total / (1 + rate / 100));
    tax = round2(total - taxable);
  } else {
    taxable = round2(postDiscount);
    tax = round2((taxable * rate) / 100);
    total = round2(taxable + tax);
  }

  const inter = isInterState(businessState, placeOfSupply);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (inter) {
    igst = tax;
  } else {
    cgst = round2(tax / 2);
    sgst = round2(tax - cgst); // prevents rounding drift
  }

  return {
    grossAmount: round2(gross),
    discountAmount: round2(disc),
    taxableValue: taxable,
    gstRate: rate,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    totalTax: tax,
    totalAmount: total,
  };
}

export interface DocumentSummaryInput {
  items: Array<ItemCalculationInput>;
  businessState: string;
  placeOfSupply: string;
  documentDiscountType?: 'percentage' | 'amount' | undefined;
  documentDiscountValue?: number | undefined;
}

export interface DocumentSummaryResult {
  subtotal: number;
  itemsDiscountTotal: number;
  documentDiscountAmount: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  rawTotal: number;
  roundOff: number;
  grandTotal: number;
  items: ItemCalculationResult[];
}

export function calculateDocumentSummary(input: DocumentSummaryInput): DocumentSummaryResult {
  const lineResults = input.items.map((it) =>
    calculateLineItem(it, input.businessState, input.placeOfSupply)
  );

  let subtotal = 0;
  let itemsDiscount = 0;
  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let totalTax = 0;

  for (const r of lineResults) {
    subtotal += r.grossAmount;
    itemsDiscount += r.discountAmount;
    taxable += r.taxableValue;
    cgst += r.cgstAmount;
    sgst += r.sgstAmount;
    igst += r.igstAmount;
    totalTax += r.totalTax;
  }

  let docDiscount = 0;
  const docVal = Number(input.documentDiscountValue) || 0;
  if (docVal > 0) {
    if (input.documentDiscountType === 'percentage') {
      docDiscount = round2((taxable * Math.min(100, docVal)) / 100);
    } else {
      docDiscount = round2(Math.min(taxable, docVal));
    }
    // Adjust taxable and proportional taxes if document-level discount applied
    if (taxable > 0 && docDiscount > 0) {
      const reductionRatio = (taxable - docDiscount) / taxable;
      taxable = round2(taxable - docDiscount);
      cgst = round2(cgst * reductionRatio);
      sgst = round2(sgst * reductionRatio);
      igst = round2(igst * reductionRatio);
      totalTax = round2(cgst + sgst + igst);
    }
  }

  const rawTotal = round2(taxable + totalTax);
  const rounded = Math.round(rawTotal);
  const roundOff = round2(rounded - rawTotal);

  return {
    subtotal: round2(subtotal),
    itemsDiscountTotal: round2(itemsDiscount),
    documentDiscountAmount: docDiscount,
    totalDiscount: round2(itemsDiscount + docDiscount),
    taxableAmount: round2(taxable),
    cgstAmount: round2(cgst),
    sgstAmount: round2(sgst),
    igstAmount: round2(igst),
    totalTax: round2(totalTax),
    rawTotal,
    roundOff,
    grandTotal: rounded,
    items: lineResults,
  };
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Converts a numeric amount to Indian Rupee Words
 * e.g. 15420.50 -> "Rupees Fifteen Thousand Four Hundred Twenty and Fifty Paise Only"
 */
export function numberToIndianWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 10) return singleDigits[n]!;
    if (n < 20) return twoDigits[n - 10]!;
    const t = tens[Math.floor(n / 10)]!;
    const u = singleDigits[n % 10]!;
    return u ? `${t} ${u}` : t;
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hStr = h > 0 ? `${singleDigits[h]} Hundred` : '';
    const rStr = convertTwoDigits(r);
    if (hStr && rStr) return `${hStr} and ${rStr}`;
    return hStr || rStr;
  }

  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let remaining = rupees;
  const parts: string[] = [];

  const crores = Math.floor(remaining / 10000000);
  if (crores > 0) {
    parts.push(`${convertThreeDigits(crores)} Crore`);
    remaining %= 10000000;
  }

  const lakhs = Math.floor(remaining / 100000);
  if (lakhs > 0) {
    parts.push(`${convertTwoDigits(lakhs)} Lakh`);
    remaining %= 100000;
  }

  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    parts.push(`${convertTwoDigits(thousands)} Thousand`);
    remaining %= 1000;
  }

  if (remaining > 0) {
    parts.push(convertThreeDigits(remaining));
  }

  let result = `Rupees ${parts.join(' ').trim()}`;
  if (paise > 0) {
    result += ` and ${convertTwoDigits(paise)} Paise`;
  }
  return `${result} Only`;
}
