import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

import type { ApiErrorCode } from '@ayv/types';

import { RequestContextStore } from '../context/request-context';

interface NormalisedError {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: { field?: string; message: string }[];
}

/**
 * Single exit point for every error.
 *
 * Prisma's error codes are translated into the API's vocabulary here so that
 * database specifics never leak into a client response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = RequestContextStore.get()?.requestId;

    const normalised = this.normalise(exception);

    if (normalised.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${normalised.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(normalised.status).json({
      success: false,
      error: {
        code: normalised.code,
        message: normalised.message,
        ...(normalised.details ? { details: normalised.details } : {}),
        requestId,
      },
    });
  }

  private normalise(exception: unknown): NormalisedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'The request could not be processed against the data model',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private fromHttpException(exception: HttpException): NormalisedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    const statusCodeMap: Record<number, ApiErrorCode> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    };

    let message = exception.message;
    let code = statusCodeMap[status] ?? 'INTERNAL_ERROR';
    let details: NormalisedError['details'];

    if (typeof payload === 'object' && payload !== null) {
      const body = payload as Record<string, unknown>;

      if (typeof body.code === 'string') code = body.code as ApiErrorCode;
      if (typeof body.message === 'string') message = body.message;

      // ValidationPipe emits `message` as a string array.
      if (Array.isArray(body.message)) {
        details = body.message.map((entry) => ({ message: String(entry) }));
        message = 'Validation failed';
      }
    }

    return { status, code, message, details };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): NormalisedError {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ');
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: target
            ? `A record with this ${target} already exists`
            : 'A record with these details already exists',
        };
      }
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'VALIDATION_ERROR',
          message: 'Referenced record does not exist',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: 'A database error occurred',
        };
    }
  }
}
