import { Request, Response, NextFunction } from 'express';
import User from '../models/User.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';

/**
 * Registers or updates the caller's NaCl Curve25519 public key.
 * The client calls this once per login/session with the public half
 * of its locally-generated E2E keypair.
 *
 * FIX: The key length limit was 64 chars. A standard NaCl Curve25519 public
 * key in base64 is 44 chars (32 bytes, with padding). Raised the upper bound
 * to 100 to give headroom for any base64 variant (e.g. URL-safe with/without
 * padding) and to avoid silently rejecting valid keys. Added a minimum-length
 * guard (32 chars) to reject obvious garbage before attempting a DB write.
 */
export const updatePublicKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { publicKey } = req.body as { publicKey?: string };
    if (
      !publicKey ||
      typeof publicKey !== 'string' ||
      publicKey.length < 32 ||
      publicKey.length > 100
    ) {
      throw new AppError('Invalid public key', 400);
    }
    await User.findByIdAndUpdate((req as AuthRequest).user._id, { publicKey });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * Returns the NaCl public key of any user by ID.
 * Used by DM participants to derive a shared secret for E2E encryption.
 * Returns an empty string (not an error) when the user hasn't registered
 * a key yet — the client treats an empty key as "E2E not available" and
 * falls back to plaintext for that conversation.
 */
export const getUserPublicKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select('publicKey');
    if (!user) throw new AppError('User not found', 404);
    res.json({ publicKey: user.publicKey ?? '' });
  } catch (err) { next(err); }
};
