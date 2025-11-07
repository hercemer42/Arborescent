import { describe, it, expect } from 'vitest';
import { PLUGIN_API_VERSION, checkApiCompatibility } from '../apiVersion';

describe('apiVersion', () => {
  describe('PLUGIN_API_VERSION', () => {
    it('should be defined as a semantic version string', () => {
      expect(PLUGIN_API_VERSION).toBeDefined();
      expect(typeof PLUGIN_API_VERSION).toBe('string');
      expect(PLUGIN_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should be version 1.0.0', () => {
      expect(PLUGIN_API_VERSION).toBe('1.0.0');
    });
  });

  describe('checkApiCompatibility', () => {
    describe('when no API version is specified', () => {
      it('should be compatible with undefined', () => {
        const result = checkApiCompatibility(undefined);

        expect(result.compatible).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it('should assume backward compatibility', () => {
        const result = checkApiCompatibility();

        expect(result.compatible).toBe(true);
      });
    });

    describe('when API versions match', () => {
      it('should be compatible with exact version match', () => {
        const result = checkApiCompatibility('1.0.0');

        expect(result.compatible).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it('should be compatible with same major, different minor', () => {
        const result = checkApiCompatibility('1.1.0');

        expect(result.compatible).toBe(true);
      });

      it('should be compatible with same major, different patch', () => {
        const result = checkApiCompatibility('1.0.5');

        expect(result.compatible).toBe(true);
      });

      it('should be compatible with same major, different minor and patch', () => {
        const result = checkApiCompatibility('1.999.999');

        expect(result.compatible).toBe(true);
      });
    });

    describe('when API versions have different majors', () => {
      it('should be incompatible with major version 0', () => {
        const result = checkApiCompatibility('0.5.0');

        expect(result.compatible).toBe(false);
        expect(result.warning).toContain('Incompatible API version');
        expect(result.warning).toContain('0.5.0');
        expect(result.warning).toContain('1.0.0');
      });

      it('should be incompatible with major version 2', () => {
        const result = checkApiCompatibility('2.0.0');

        expect(result.compatible).toBe(false);
        expect(result.warning).toContain('Incompatible API version');
        expect(result.warning).toContain('2.0.0');
      });

      it('should be incompatible with higher major version', () => {
        const result = checkApiCompatibility('5.0.0');

        expect(result.compatible).toBe(false);
        expect(result.warning).toContain('plugin requires v5.0.0');
        expect(result.warning).toContain('current API is v1.0.0');
      });
    });

    describe('when API version format is invalid', () => {
      it('should be incompatible with non-numeric major version', () => {
        const result = checkApiCompatibility('abc.0.0');

        expect(result.compatible).toBe(false);
        expect(result.warning).toContain('Invalid API version format');
        expect(result.warning).toContain('abc.0.0');
      });

      it('should be compatible with missing parts if major matches', () => {
        // The code only checks major version, so "1" parses as major=1 and is compatible
        const result = checkApiCompatibility('1');

        expect(result.compatible).toBe(true);
      });

      it('should be compatible with empty string due to falsy check', () => {
        // Empty string is falsy, so it hits the !pluginApiVersion check and returns compatible
        const result = checkApiCompatibility('');

        expect(result.compatible).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it('should be incompatible with malformed version', () => {
        const result = checkApiCompatibility('v1.0.0');

        expect(result.compatible).toBe(false);
        expect(result.warning).toContain('Invalid API version format');
      });

      it('should be compatible with special characters if major matches', () => {
        // "1.0.0-beta" splits to ['1', '0', '0-beta'], major=1 is compatible
        const result = checkApiCompatibility('1.0.0-beta');

        expect(result.compatible).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle version with extra zeros', () => {
        const result = checkApiCompatibility('1.00.00');

        expect(result.compatible).toBe(true);
      });

      it('should handle version with leading zeros in minor/patch', () => {
        const result = checkApiCompatibility('1.01.02');

        expect(result.compatible).toBe(true);
      });

      it('should handle negative version numbers as incompatible major', () => {
        // "-1.0.0" parses as major=-1, which is not NaN but different from 1
        const result = checkApiCompatibility('-1.0.0');

        expect(result.compatible).toBe(false);
        expect(result.warning).toContain('Incompatible API version');
      });

      it('should handle floating point version as invalid', () => {
        const result = checkApiCompatibility('1.5.0.1');

        // Will parse as 1 (major), so should be compatible but with wrong format
        const majorPart = parseInt('1.5.0.1'.split('.')[0], 10);
        expect(majorPart).toBe(1);
        // Since major matches, it will be compatible even though format is wrong
        expect(result.compatible).toBe(true);
      });
    });

    describe('compatibility matrix', () => {
      it('should have proper compatibility for common scenarios', () => {
        const testCases = [
          { version: '1.0.0', expected: true },
          { version: '1.0.1', expected: true },
          { version: '1.1.0', expected: true },
          { version: '1.99.99', expected: true },
          { version: '0.9.9', expected: false },
          { version: '2.0.0', expected: false },
          { version: '10.0.0', expected: false },
        ];

        testCases.forEach(({ version, expected }) => {
          const result = checkApiCompatibility(version);
          expect(result.compatible).toBe(expected);
        });
      });
    });
  });
});
