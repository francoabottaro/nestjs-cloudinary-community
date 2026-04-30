import { BadRequestException } from '@nestjs/common';
import {
  parsePublicIdsJson,
  requireNonEmptyString,
} from './cloudinary-http.helpers';

describe('cloudinary-http.helpers', () => {
  describe('requireNonEmptyString', () => {
    it('returns value when defined and non-empty', () => {
      expect(requireNonEmptyString('x', 'field')).toBe('x');
    });

    it('throws when undefined', () => {
      expect(() => requireNonEmptyString(undefined, 'name')).toThrow(
        BadRequestException,
      );
      expect(() => requireNonEmptyString(undefined, 'name')).toThrow(
        /name is required/,
      );
    });

    it('throws when empty string', () => {
      expect(() => requireNonEmptyString('', 'name')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('parsePublicIdsJson', () => {
    it('parses a valid JSON string array', () => {
      expect(parsePublicIdsJson('["a","b"]')).toEqual(['a', 'b']);
    });

    it('throws when raw is undefined', () => {
      expect(() => parsePublicIdsJson(undefined)).toThrow(BadRequestException);
    });

    it('throws when raw is empty', () => {
      expect(() => parsePublicIdsJson('')).toThrow(BadRequestException);
    });

    it('throws when JSON is not a string array', () => {
      expect(() => parsePublicIdsJson('[1,2]')).toThrow(BadRequestException);
    });

    it('throws when JSON is invalid', () => {
      expect(() => parsePublicIdsJson('not-json')).toThrow(BadRequestException);
    });

    it('rethrows BadRequestException from inner validation', () => {
      expect(() => parsePublicIdsJson('{}')).toThrow(BadRequestException);
    });
  });
});
