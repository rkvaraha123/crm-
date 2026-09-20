import { Prisma } from '@prisma/client';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const databaseStatus =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? (
            { P2002: 409, P2003: 409, P2004: 409, P2025: 404 } as Record<
              string,
              number
            >
          )[exception.code]
        : undefined;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (databaseStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      status >= 500
        ? 'Internal server error'
        : typeof body === 'string'
          ? body
          : databaseStatus === 409
            ? 'Database constraint conflict'
            : databaseStatus === 404
              ? 'Record not found'
              : ((body as { message?: unknown })?.message ?? 'Request failed');
    if (status >= 500)
      this.logger.error(
        `Request failed: ${request.method} ${request.path} (${status})`,
      );
    response.status(status).json({
      statusCode: status,
      message,
      path: request.path,
      timestamp: new Date().toISOString(),
    });
  }
}
