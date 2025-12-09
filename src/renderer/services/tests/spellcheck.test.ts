import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nspell before importing spellcheck module
const mockCorrect = vi.fn();
const mockSuggest = vi.fn();

vi.mock('nspell', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      correct: mockCorrect,
      suggest: mockSuggest,
    })),
  };
});

vi.mock('../../assets/dictionaries/en.aff?raw', () => ({
  default: 'mock aff data',
}));

vi.mock('../../assets/dictionaries/en.dic?raw', () => ({
  default: 'mock dic data',
}));

// Import after mocks are set up
import { initSpellcheck, isMisspelled, getSuggestions, checkWord } from '../spellcheck';

describe('spellcheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by re-initializing
    initSpellcheck();
  });

  describe('initSpellcheck', () => {
    it('should initialize the dictionary', () => {
      // Already initialized in beforeEach
      expect(mockCorrect).toBeDefined();
    });
  });

  describe('isMisspelled', () => {
    it('should return false for correctly spelled words', () => {
      mockCorrect.mockReturnValue(true);
      expect(isMisspelled('hello')).toBe(false);
      expect(mockCorrect).toHaveBeenCalledWith('hello');
    });

    it('should return true for misspelled words', () => {
      mockCorrect.mockReturnValue(false);
      expect(isMisspelled('helllo')).toBe(true);
      expect(mockCorrect).toHaveBeenCalledWith('helllo');
    });

    it('should return false for words shorter than 2 characters', () => {
      expect(isMisspelled('a')).toBe(false);
      expect(mockCorrect).not.toHaveBeenCalled();
    });

    it('should return false for numbers', () => {
      expect(isMisspelled('123')).toBe(false);
      expect(isMisspelled('456789')).toBe(false);
      expect(mockCorrect).not.toHaveBeenCalled();
    });

    it('should return false for words with multiple uppercase letters (likely code)', () => {
      // Words with 2+ uppercase letters are skipped (like getElementById, API, HTML)
      expect(isMisspelled('getElementById')).toBe(false);
      expect(isMisspelled('API')).toBe(false);
      expect(isMisspelled('HTML')).toBe(false);
      expect(isMisspelled('XMLHttpRequest')).toBe(false);
      expect(mockCorrect).not.toHaveBeenCalled();
    });

    it('should check simple camelCase words with one uppercase', () => {
      // Words like "camelCase" with only one uppercase are still checked
      mockCorrect.mockReturnValue(false);
      expect(isMisspelled('camelCase')).toBe(true);
      expect(mockCorrect).toHaveBeenCalledWith('camelCase');
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for a word', () => {
      mockSuggest.mockReturnValue(['hello', 'hallo', 'jello', 'cello', 'bello']);
      const suggestions = getSuggestions('helllo');
      expect(suggestions).toEqual(['hello', 'hallo', 'jello', 'cello', 'bello']);
      expect(mockSuggest).toHaveBeenCalledWith('helllo');
    });

    it('should limit suggestions to specified count', () => {
      mockSuggest.mockReturnValue(['hello', 'hallo', 'jello', 'cello', 'bello', 'fellow']);
      const suggestions = getSuggestions('helllo', 3);
      expect(suggestions).toEqual(['hello', 'hallo', 'jello']);
    });

    it('should return empty array if no suggestions', () => {
      mockSuggest.mockReturnValue([]);
      const suggestions = getSuggestions('xyzabc');
      expect(suggestions).toEqual([]);
    });
  });

  describe('checkWord', () => {
    it('should return misspelled: false for correctly spelled words', () => {
      mockCorrect.mockReturnValue(true);
      const result = checkWord('hello');
      expect(result).toEqual({ misspelled: false, suggestions: [] });
    });

    it('should return misspelled: true with suggestions for misspelled words', () => {
      mockCorrect.mockReturnValue(false);
      mockSuggest.mockReturnValue(['hello', 'hallo']);
      const result = checkWord('helllo');
      expect(result).toEqual({
        misspelled: true,
        suggestions: ['hello', 'hallo'],
      });
    });

    it('should skip short words', () => {
      const result = checkWord('a');
      expect(result).toEqual({ misspelled: false, suggestions: [] });
    });

    it('should skip words with multiple uppercase letters', () => {
      const result = checkWord('getElementById');
      expect(result).toEqual({ misspelled: false, suggestions: [] });
    });
  });
});
