import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { RequestContextStore } from '../context/request-context';

/**
 * Opens the ambient request context and stamps a request id.
 *
 * Runs before guards, so by the time `JwtAuthGuard` resolves a principal there
 * is already a context to patch the tenant and actor into.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', requestId);

    RequestContextStore.run(
      {
        requestId,
        actorType: 'USER',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      () => next(),
    );
  }
}
