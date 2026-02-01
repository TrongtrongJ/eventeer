import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      {
        statusCode,
        message,
        error: 'BusinessRuleViolation',
      },
      statusCode,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `${resource} with ID '${id}' not found`,
        error: 'ResourceNotFound',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InsufficientPermissionsException extends HttpException {
  constructor(action: string, resource: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: `You don't have permission to ${action} ${resource}`,
        error: 'InsufficientPermissions',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class RateLimitExceededException extends HttpException {
  constructor(retryAfter?: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Rate limit exceeded. Please try again later.',
        error: 'RateLimitExceeded',
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
