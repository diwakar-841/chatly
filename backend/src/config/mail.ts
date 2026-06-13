import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

/**
 * Nodemailer transporter configured for STARTTLS (port 587).
 * Uses `requireTLS` to force the upgrade, which is needed for Gmail and most
 * hosted SMTP providers. `rejectUnauthorized: false` avoids cert errors on
 * restricted environments (e.g. Termux/Android).
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

transporter.verify((error) => {
  if (error) {
    logger.error(`[Mail] Connection failed: ${(error as Error).message}`);
    logger.error(`[Mail] Check EMAIL_HOST, EMAIL_USER, EMAIL_PASS in your .env`);
  } else {
    logger.info('[Mail] SMTP connected — ready to send emails');
  }
});

export default transporter;
