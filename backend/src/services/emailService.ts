import emailjs from '../config/mail.js';
import logger from '../utils/logger.js';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID as string;
const OTP_TEMPLATE_ID = process.env.EMAILJS_OTP_TEMPLATE_ID as string;

/**
 * Sends a 6-digit OTP email via EmailJS. `purpose` and `expiryMinutes` are
 * passed through as template variables so a single EmailJS template can
 * render copy for both email verification and password reset.
 *
 * Expected template variables (configure these in the EmailJS dashboard):
 *   to_email, otp_code, purpose, expiry_minutes
 */
const sendOtpEmail = async (
  to: string,
  otp: string,
  purpose: 'Verify your email' | 'Reset your password',
  expiryMinutes: number
): Promise<void> => {
  await emailjs.send(SERVICE_ID, OTP_TEMPLATE_ID, {
    to_email: to,
    otp_code: otp,
    purpose,
    expiry_minutes: expiryMinutes,
  });
};

/** Sends the password-reset OTP (valid 10 minutes). */
export const sendPasswordResetOtp = async (to: string, otp: string): Promise<void> => {
  try {
    await sendOtpEmail(to, otp, 'Reset your password', 10);
    logger.info(`[Mail] Password reset OTP sent to ${to}`);
  } catch (err) {
    logger.error('[Mail] Failed to send password reset OTP', err);
    throw { statusCode: 500, isOperational: true, message: 'Failed to send email. Please try again later.' };
  }
};

/** Sends the email-verification OTP (valid 10 minutes). */
export const sendVerificationOtp = async (to: string, otp: string): Promise<void> => {
  try {
    await sendOtpEmail(to, otp, 'Verify your email', 10);
    logger.info(`[Mail] Verification OTP sent to ${to}`);
  } catch (err) {
        logger.error(`[Mail] Failed to send verification OTP: ${JSON.stringify(err)}`);
    throw { statusCode: 500, isOperational: true, message: 'Failed to send email. Please try again later.' };
  }
};
