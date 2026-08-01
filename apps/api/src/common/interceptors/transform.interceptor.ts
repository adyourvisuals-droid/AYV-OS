import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { RequestContextStore } from '../context/request-context';

/**
 * Wraps every response in the standard envelope.
 *
 * A handler that returns `{ data, meta }` — as paginated lists do — has its
 * meta merged rather than nested, so pagination lands where clients expect it.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        const base = {
          timestamp: new Date().toISOString(),
          requestId: RequestContextStore.get()?.requestId,
        };

        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in (payload as Record<string, unknown>)
        ) {
          const { data, meta } = payload as unknown as {
            data: unknown;
            meta: Record<string, unknown>;
          };
          return { success: true, data, meta: { ...base, ...meta } };
        }

        return { success: true, data: payload, meta: base };
      }),
    );
  }
}
