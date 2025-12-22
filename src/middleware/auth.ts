import type { Request, Response, NextFunction } from 'express';
import { createScimError } from '../scim/schemas/core.js';
import { logger } from './logging.js';

/**
 * Bearer token authentication middleware
 * Validates that incoming requests from Alice have a valid Bearer token
 */
export function bearerTokenAuth(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn({ url: req.url }, 'Missing Authorization header');
      res.status(401).json(createScimError(401, 'Missing Authorization header', 'unauthorized'));
      return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer') {
      logger.warn({ url: req.url, scheme }, 'Invalid authorization scheme');
      res.status(401).json(createScimError(401, 'Invalid authorization scheme. Expected Bearer', 'unauthorized'));
      return;
    }

    if (!token || token !== expectedToken) {
      logger.warn({ url: req.url }, 'Invalid bearer token');
      res.status(401).json(createScimError(401, 'Invalid bearer token', 'unauthorized'));
      return;
    }

    next();
  };
}

