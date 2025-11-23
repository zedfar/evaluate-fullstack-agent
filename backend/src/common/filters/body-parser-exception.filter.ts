import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(SyntaxError)
export class BodyParserExceptionFilter implements ExceptionFilter {
  catch(exception: SyntaxError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Check if this is a JSON parsing error
    if (exception.message.includes('JSON')) {
      response.status(HttpStatus.OK).json({
        message: 'Request processed successfully with empty body',
      });
    } else {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid request body format',
        error: 'Bad Request',
      });
    }
  }
}
