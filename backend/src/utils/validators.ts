import { body, query, param, ValidationChain } from 'express-validator';

/** Validates the registration request body (username, email, password, optional fullName). */
export const registerValidation: ValidationChain[] = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  body('fullName').optional().trim().isLength({ max: 50 }).withMessage('Full name too long'),
];

/** Validates the login request body (email + password). */
export const loginValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

/** Validates the email-verification request body (email + 6-digit OTP). */
export const verifyEmailValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric().withMessage('OTP must be numeric'),
];

/** Validates the password-reset request body (email + 6-digit OTP + new password). */
export const resetPasswordValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric().withMessage('OTP must be numeric'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
];

/** Validates the send-message request body (chatId required; content, type, replyTo optional). */
export const sendMessageValidation: ValidationChain[] = [
  body('chatId').notEmpty().withMessage('chatId is required').isMongoId().withMessage('Invalid chatId'),
  body('content').optional().isString().isLength({ max: 2000 }).withMessage('Message too long'),
  body('type').optional().isIn(['text', 'image', 'file']).withMessage('Invalid message type'),
  body('replyTo').optional().isMongoId().withMessage('Invalid replyTo id'),
];

/**
 * Validates the create-group request body. The `members` array is optional —
 * invited users are placed in pendingInvites rather than added directly.
 */
export const createGroupValidation: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Group name is required').isLength({ max: 50 }).withMessage('Group name too long'),
  body('members').optional().isArray().withMessage('members must be an array'),
  body('members.*').optional().isMongoId().withMessage('Invalid member id'),
];

/** Validates profile update fields (fullName, bio, isPrivate — all optional). */
export const updateProfileValidation: ValidationChain[] = [
  body('fullName').optional().trim().isLength({ max: 50 }).withMessage('Full name too long'),
  body('bio').optional().trim().isLength({ max: 200 }).withMessage('Bio must be max 200 characters'),
  body('isPrivate').optional().isBoolean().withMessage('isPrivate must be a boolean'),
];

/** Validates query-string search parameters (q and page). */
export const searchValidation: ValidationChain[] = [
  query('q').optional().isString().isLength({ max: 50 }).withMessage('Search query too long'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
];

/** Returns a single validation chain that checks the named URL param is a valid MongoDB ObjectId. */
export const mongoIdParam = (paramName: string): ValidationChain =>
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`);

/** Validates the friend-request response body (action must be 'accept' or 'reject'). */
export const respondToRequestValidation: ValidationChain[] = [
  body('action').isIn(['accept', 'reject']).withMessage('Action must be "accept" or "reject"'),
];
