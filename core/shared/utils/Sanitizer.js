/**
 * Sanitizer Utility
 * Responsibility: Clean and validate user inputs to ensure system stability and UI integrity
 */
export class Sanitizer {
  /**
   * Clean text to allow only alphanumeric, dots, dashes, and underscores
   * Useful for Game IDs / User IDs
   * @param {string} text 
   * @param {number} maxLength 
   * @returns {string|null} Cleaned text or null if invalid
   */
  static cleanAlphanumeric(text, maxLength = 50) {
    if (!text || typeof text !== 'string') return null;

    // 1. Basic trim
    let cleaned = text.trim();

    // 2. Length check
    if (cleaned.length === 0 || cleaned.length > maxLength) return null;

    // 3. Character validation (White-list: Alphanumeric, ., -, _, space)
    // We allow parentheses for server IDs like (1234)
    const validRegex = /^[a-zA-Z0-9.\-_ \(\)]+$/;
    if (!validRegex.test(cleaned)) return null;

    return cleaned;
  }

  /**
   * Sanitize merchant reference strings from callback data
   * Strict whitelist: only alphanumeric + dash allowed
   * @param {string} ref - Raw merchant reference from callback
   * @param {number} maxLength - Maximum allowed length
   * @returns {string|null} Sanitized ref or null if invalid
   */
  static cleanMerchantRef(ref, maxLength = 64) {
    if (!ref || typeof ref !== 'string') return null;
    const trimmed = ref.trim();
    if (trimmed.length === 0 || trimmed.length > maxLength) return null;
    // Strict: only alphanumeric and dash
    if (!/^[a-zA-Z0-9\-]+$/.test(trimmed)) return null;
    return trimmed;
  }

  /**
   * Escape special characters for Telegram Markdown (V1)
   * Prevents UI breakage when displaying user input
   * @param {string} text 
   * @returns {string}
   */
  static escapeMarkdown(text) {
    if (!text) return '';
    // Telegram Markdown V1 special chars: * _ [ `
    return text.replace(/[*_[`]/g, '\\$&');
  }

  /**
   * Check if text looks like a conversational sentence rather than an ID
   * @param {string} text 
   * @returns {boolean}
   */
  static isConversational(text) {
    if (!text) return false;
    const trimmed = text.trim();
    const lowText = trimmed.toLowerCase();
    const words = lowText.split(/\s+/);

    // 1. Common Indonesian stopwords/slang (if single word matches, it's conversational)
    const indonesianSlang = [
      'oke', 'ok', 'okei', 'sip', 'siap', 'mantap', 'sipp', 'okehh',
      'sudah', 'udah', 'blom', 'belum', 'nanti', 'besok', 'saya', 'aku',
      'kamu', 'apa', 'kenapa', 'gimana', 'mana', 'siapa', 'kapan',
      'bisa', 'gak', 'tidak', 'ya', 'iya', 'yoi', 'ready', 'bentar',
      'tunggu', 'sebentar', 'dulu', 'lagi', 'ada', 'adaa', 'mau',
      'ingin', 'order', 'pesan', 'topup', 'bang', 'kak', 'sis', 'gan',
      'min', 'admin', 'test', 'tes', 'cek', 'recheck', 'wow', 'asik'
    ];

    // 2. If it's more than 2 words, it's likely a sentence
    if (words.length > 2) return true;

    // 3. Check if any word is a specific slang/conversational word
    if (words.some(word => indonesianSlang.includes(word))) return true;

    // 4. Check for question marks or other conversational punctuation
    if (/[?!,;]/.test(trimmed)) return true;

    // 5. If it's a single word, purely alphabetic, and > 10 chars, likely gibberish/sentence
    if (words.length === 1 && trimmed.length > 10 && /^[a-zA-Z]+$/.test(trimmed)) {
      return true;
    }

    return false;
  }
}
