/**
 * Email Parser Service
 * Parses transaction-notification emails from Indian banks.
 * Returns structured data — raw email text is NEVER stored or sent.
 */

export interface ParsedTransaction {
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  merchant: string;
  date?: Date;
  reference?: string;
  bank: string;
}

type BankParser = {
  name: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray, body: string) => ParsedTransaction | null;
};

// ── Amount helper ──────────────────────────────────────────────────────────────
function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, '').replace(/Rs\.?\s*/i, '').trim());
}

// ── Date parser ────────────────────────────────────────────────────────────────
function parseDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Bank parsers ───────────────────────────────────────────────────────────────
const PARSERS: BankParser[] = [
  // HDFC: "Rs. 1,234.00 debited from A/c XX1234 on 01-04-2026"
  {
    name: 'HDFC',
    pattern: /Rs\.?\s*([\d,]+\.?\d*)\s+(debited from|credited to)\s+A\/c\s+\w+\s+on\s+([\d-]+)/i,
    extract: (match) => ({
      amount: parseAmount(match[1]),
      type: /debit/i.test(match[2]) ? 'DEBIT' : 'CREDIT',
      merchant: 'HDFC Bank',
      date: parseDate(match[3]),
      bank: 'HDFC',
    }),
  },

  // ICICI: "INR 1,234.00 debited from your account XXXX1234 on 01-Apr-26"
  {
    name: 'ICICI',
    pattern: /INR\s*([\d,]+\.?\d*)\s+(debited|credited)\s+from\s+your\s+account.*?on\s+([\d\w-]+)/i,
    extract: (match) => ({
      amount: parseAmount(match[1]),
      type: /debit/i.test(match[2]) ? 'DEBIT' : 'CREDIT',
      merchant: 'ICICI Bank',
      date: parseDate(match[3]),
      bank: 'ICICI',
    }),
  },

  // SBI: "Rs 1234.00 debited from your A/c no. XXXX on 01.04.2026"
  {
    name: 'SBI',
    pattern: /Rs\.?\s*([\d,]+\.?\d*)\s+(debited|credited)\s+from\s+your\s+A\/c.*?on\s+([\d.]+)/i,
    extract: (match) => ({
      amount: parseAmount(match[1]),
      type: /debit/i.test(match[2]) ? 'DEBIT' : 'CREDIT',
      merchant: 'SBI',
      date: parseDate(match[3]),
      bank: 'SBI',
    }),
  },

  // Axis: "INR 1,234.00 has been debited from your Axis Bank Account XXXX on 01-04-2026"
  {
    name: 'Axis',
    pattern: /INR\s*([\d,]+\.?\d*)\s+has been\s+(debited|credited).*?on\s+([\d-]+)/i,
    extract: (match) => ({
      amount: parseAmount(match[1]),
      type: /debit/i.test(match[2]) ? 'DEBIT' : 'CREDIT',
      merchant: 'Axis Bank',
      date: parseDate(match[3]),
      bank: 'Axis',
    }),
  },

  // Kotak: "Rs. 1,234.00 debited from Kotak A/c no. XXXX1234 on 01-04-2026 at MERCHANT NAME"
  {
    name: 'Kotak',
    pattern: /Rs\.?\s*([\d,]+\.?\d*)\s+(debited|credited).*?on\s+([\d-]+)\s+at\s+([^\n.]+)/i,
    extract: (match) => ({
      amount: parseAmount(match[1]),
      type: /debit/i.test(match[2]) ? 'DEBIT' : 'CREDIT',
      merchant: match[4]?.trim() || 'Kotak Bank',
      date: parseDate(match[3]),
      bank: 'Kotak',
    }),
  },

  // Generic UPI: "Rs. 1,234 debited via UPI. VPA: merchant@paytm. Ref: 123456"
  {
    name: 'UPI',
    pattern: /Rs\.?\s*([\d,]+\.?\d*)\s+(debited|credited).*?(?:VPA|UPI ID):\s*([^\s.]+)/i,
    extract: (match) => {
      const vpa = match[3] || '';
      const merchantName = vpa.split('@')[0] || vpa;
      return {
        amount: parseAmount(match[1]),
        type: /debit/i.test(match[2]) ? 'DEBIT' : 'CREDIT',
        merchant: merchantName,
        bank: 'UPI',
      };
    },
  },

  // Generic UPI v2: "debited Rs 1,234.00 to VPA merchant@bank"
  {
    name: 'UPI_v2',
    pattern: /(debited|credited)\s+Rs\.?\s*([\d,]+\.?\d*)\s+(?:to|from)\s+VPA\s+([^\s.]+)/i,
    extract: (match) => {
      const vpa = match[3] || '';
      const merchantName = vpa.split('@')[0] || vpa;
      return {
        amount: parseAmount(match[2]),
        type: /debit/i.test(match[1]) ? 'DEBIT' : 'CREDIT',
        merchant: merchantName,
        bank: 'UPI',
      };
    },
  },
];

// ── Public API ─────────────────────────────────────────────────────────────────
export const emailParserService = {
  parse(emailBody: string): ParsedTransaction | null {
    const normalised = emailBody.replace(/\s+/g, ' ').trim();

    for (const parser of PARSERS) {
      const match = normalised.match(parser.pattern);
      if (match) {
        const result = parser.extract(match, normalised);
        if (result && result.amount > 0) return result;
      }
    }

    return null;
  },

  parseBulk(emails: string[]): (ParsedTransaction | null)[] {
    return emails.map(e => emailParserService.parse(e));
  },
};
