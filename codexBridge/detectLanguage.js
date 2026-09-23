function detectLanguage(textToDetect) {
  if (!textToDetect || typeof textToDetect !== 'string') return 'en';

  const text = textToDetect.trim();
  const normalizedText = text.toLowerCase();
  const countLanguageTerms = (terms) => terms.reduce((count, term) => (
    new RegExp(`\\b${term}\\b`, 'i').test(normalizedText) ? count + 1 : count
  ), 0);

  // Check Japanese Kana before CJK characters because Japanese commonly uses Kanji.
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
  if (/[\u4e00-\u9fff]/u.test(text)) return 'zh';
  if (/[\u0E00-\u0E7F]/u.test(text)) return 'th';
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
  if (/[\u0600-\u06FF]/u.test(text)) return 'ar';
  if (/[\u0900-\u097F]/u.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/u.test(text)) return 'bn';
  if (/[\u0750-\u077F\u0600-\u06FF]/u.test(text)) return 'ur';
  if (/[\u0400-\u04FF]/u.test(text)) return 'ru';
  if (/[\u0100-\u017F\u1EA0-\u1EFF]/u.test(text)) return 'vi';
  if (/[\uA900-\uA92F]/u.test(text)) return 'my';
  if (/[\u0D80-\u0DFF]/u.test(text)) return 'si';
  if (/[\u0C80-\u0CFF]/u.test(text)) return 'kn';
  if (/[\u0A80-\u0AFF]/u.test(text)) return 'gu';
  if (/[\u0B80-\u0BFF]/u.test(text)) return 'ta';
  if (/[\u0D00-\u0D7F]/u.test(text)) return 'ml';
  if (/[\u1B80-\u1BBF]/u.test(text)) return 'id';
  if (/[\u1700-\u171F]/u.test(text)) return 'tl';

  const filipinoScore = countLanguageTerms([
    'ano', 'paano', 'saan', 'kailan', 'bakit', 'magkano', 'maaari', 'pwede',
    'puwede', 'ito', 'iyon', 'ako', 'ikaw', 'natin', 'ng', 'mga', 'ang', 'ko', 'mo',
  ]);
  const portugueseScore = countLanguageTerms([
    'como', 'onde', 'quando', 'porque', 'qual', 'quais', 'posso', 'pode',
    'configurar', 'definir', 'regra', 'regras', 'atraso', 'saída', 'saida',
    'chegada', 'funcionário', 'funcionario',
  ]);

  if (portugueseScore >= 1 || /[ãõçáéíóúâêôà]/iu.test(text)) return 'pt';
  if (
    filipinoScore >= 2
    || /\b(paano|saan|kailan|bakit|magkano|puwede|pwede)\b/u.test(normalizedText)
  ) return 'tl';
  if (/[a-zA-Z]/u.test(text)) return 'en';
  return 'en';
}

module.exports = { detectLanguage };
