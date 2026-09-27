export const PAGINATION_LIMIT = 20;

export const MESSAGE_LIMIT = 30;

export const MAX_GROUP_MEMBERS = 100;

export const CHATS_PAGE_LIMIT = 30;

export const MAX_MESSAGE_LENGTH = 2000;

export const MAX_ENCRYPTED_CONTENT_LENGTH = 4000;
export const MAX_NONCE_LENGTH = 64;

// Allowed durations (in seconds) for the disappearing-messages feature.
// 0 = off.
export const DISAPPEARING_OPTIONS = [0, 86400, 604800, 7776000] as const;
