import emailjs from "@emailjs/nodejs";
import logger from "../utils/logger.js";


emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY as string,
  privateKey: process.env.EMAILJS_PRIVATE_KEY as string,
});

if (
  !process.env.EMAILJS_SERVICE_ID ||
  !process.env.EMAILJS_PUBLIC_KEY ||
  !process.env.EMAILJS_PRIVATE_KEY ||
  !process.env.EMAILJS_OTP_TEMPLATE_ID
) {
  logger.error(
    "[Mail] Missing EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY or EMAILJS_OTP_TEMPLATE_ID in your .env",
  );
} else {
  logger.info("[Mail] EmailJS configured — ready to send emails");
}

export default emailjs;
