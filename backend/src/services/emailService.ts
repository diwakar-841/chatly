import transporter from '../config/mail.js';
import logger from '../utils/logger.js';

/** Sends a branded password-reset email containing a time-limited link. */
export const sendPasswordReset = async (to: string, resetUrl: string): Promise<void> => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Password Reset Request – Chatly',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#3B82F6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
        <p style="margin-top:16px;color:#666;font-size:13px">This link expires in 30 minutes.<br>If you did not request this, ignore this email.</p>
      </div>
    `,
  });
  logger.info(`[Mail] Password reset email sent to ${to}`);
};

/** Sends a branded email verification link with a 24-hour expiry. */
export const sendVerificationEmail = async (to: string, verifyUrl: string): Promise<void> => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Verify your email – Chatly',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Email Verification</h2>
        <p>Thanks for signing up! Please verify your email address:</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#10B981;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email</a>
        <p style="margin-top:16px;color:#666;font-size:13px">This link expires in 24 hours.<br>If you did not create an account, ignore this email.</p>
      </div>
    `,
  });
  logger.info(`[Mail] Verification email sent to ${to}`);
};
