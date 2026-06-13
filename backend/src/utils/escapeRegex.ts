/**
 * Escapes special regex characters in a user-supplied string to prevent ReDoS.
 */
const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
