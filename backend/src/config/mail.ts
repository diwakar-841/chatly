import emailjs from '@emailjs/nodejs';
import logger from '../utils/logger.js';

/**
 * EmailJS server-side client (@emailjs/nodejs). Sends transactional email
 * through the EmailJS API instead of raw SMTP. The private key is required
 * for server-side use — it authenticates the request so the public key
 * alone can't be used to send on this account's behalf.
 *
 * Required env vars:
 *   EMAILJS_SERVICE_ID   - EmailJS "Email Service" ID
 *   EMAILJS_PUBLIC_KEY   - EmailJS account public key
 *   EMAILJS_PRIVATE_KEY  - EmailJS account private key (server-side auth)
 *   EMAILJS_OTP_TEMPLATE_ID - Template ID used for OTP emails (verification + reset)
 */
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY as string,
  privateKey: process.env.EMAILJS_PRIVATE_KEY as string,
});

if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_PUBLIC_KEY ||
    !process.env.EMAILJS_PRIVATE_KEY || !process.env.EMAILJS_OTP_TEMPLATE_ID) {
  logger.error('[Mail] Missing EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY or EMAILJS_OTP_TEMPLATE_ID in your .env');
} else {
  logger.info('[Mail] EmailJS configured — ready to send emails');
}

export default emailjs;
