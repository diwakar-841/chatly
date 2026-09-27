import { body, query, param, ValidationChain } from "express-validator";
import { DISAPPEARING_OPTIONS } from "./constants.js";

export const registerValidation: ValidationChain[] = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters"),
  body("email").isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),
  body("fullName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Full name too long"),
];

export const loginValidation: ValidationChain[] = [
  body("email").isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const verifyEmailValidation: ValidationChain[] = [
  body("email").isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must be numeric"),
];

export const resetPasswordValidation: ValidationChain[] = [
  body("email").isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must be numeric"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),
];

export const sendMessageValidation: ValidationChain[] = [
  body("chatId")
    .notEmpty()
    .withMessage("chatId is required")
    .isMongoId()
    .withMessage("Invalid chatId"),
  body("content")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("Message too long"),
  body("type")
    .optional()
    .isIn(["text", "image", "file"])
    .withMessage("Invalid message type"),
  body("replyTo").optional().isMongoId().withMessage("Invalid replyTo id"),
  body("encryptedContent")
    .optional()
    .isString()
    .isLength({ max: 4000 })
    .withMessage("Encrypted payload too large"),
  body("nonce")
    .optional()
    .isString()
    .isLength({ max: 64 })
    .withMessage("Invalid nonce"),
];

export const editMessageValidation: ValidationChain[] = [
  body("content")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("Message too long"),
  body("encryptedContent")
    .optional()
    .isString()
    .isLength({ max: 4000 })
    .withMessage("Encrypted payload too large"),
  body("nonce")
    .optional()
    .isString()
    .isLength({ max: 64 })
    .withMessage("Invalid nonce"),
];

export const disappearingMessagesValidation: ValidationChain[] = [
  body("seconds")
    .custom((value) => {
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        (DISAPPEARING_OPTIONS as readonly number[]).includes(value)
      );
    })
    .withMessage("Invalid disappearing messages duration"),
];

export const createGroupValidation: ValidationChain[] = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Group name is required")
    .isLength({ max: 50 })
    .withMessage("Group name too long"),
  body("members").optional().isArray().withMessage("members must be an array"),
  body("members.*").optional().isMongoId().withMessage("Invalid member id"),
];

export const updateProfileValidation: ValidationChain[] = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Full name too long"),
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Bio must be max 200 characters"),
  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean"),
];

export const searchValidation: ValidationChain[] = [
  query("q")
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage("Search query too long"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
];

export const mongoIdParam = (paramName: string): ValidationChain => {
  return param(paramName).isMongoId().withMessage(`Invalid ${paramName}`);
};

export const respondToRequestValidation: ValidationChain[] = [
  body("action")
    .isIn(["accept", "reject"])
    .withMessage('Action must be "accept" or "reject"'),
];
