import { BadRequestException } from '@nestjs/common';

/** Throws `BadRequestException` if `value` is `undefined` or `''`. */
export function requireNonEmptyString(
  value: string | undefined,
  field: string,
): string {
  if (value === undefined || value === '') {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

/**
 * Parses a JSON array of strings from a multipart form field (e.g. `publicIds`).
 * Throws `BadRequestException` on missing, invalid JSON, or non-string array elements.
 */
export function parsePublicIdsJson(raw: string | undefined): string[] {
  if (raw === undefined || raw === '') {
    throw new BadRequestException(
      'publicIds form field is required (JSON array of strings)',
    );
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      throw new BadRequestException(
        'publicIds must be a JSON array of strings',
      );
    }
    return parsed;
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException('publicIds must be valid JSON');
  }
}
