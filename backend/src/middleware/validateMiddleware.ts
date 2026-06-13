import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Express middleware that checks the result of preceding express-validator
 * chains and returns a 400 with the first error message if any fail.
 */
const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: errors.array()[0].msg as string,
      errors: errors.array(),
    });
    return;
  }
  next();
};

export default validate;
