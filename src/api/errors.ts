import { DomainError, type DomainErrorCode } from '../domain/types';

export type ApiErrorCode = DomainErrorCode | 'NETWORK' | 'UNAUTHORIZED' | 'SERVER' | 'RATE_LIMIT';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

const FRIENDLY: Partial<Record<ApiErrorCode, string>> = {
  NETWORK: 'Нет соединения. Проверьте интернет и попробуйте ещё раз.',
  UNAUTHORIZED: 'Сессия устарела. Закройте и снова откройте приложение.',
  SERVER: 'Что-то пошло не так на нашей стороне. Мы уже разбираемся.',
  RATE_LIMIT: 'Слишком много запросов. Подождите пару секунд.',
};

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof DomainError) return new ApiError(e.code, e.message);
  if (e instanceof TypeError) return new ApiError('NETWORK', FRIENDLY.NETWORK!);
  return new ApiError('SERVER', FRIENDLY.SERVER!);
}

export function errorMessage(e: unknown): string {
  const err = toApiError(e);
  return FRIENDLY[err.code] ?? err.message;
}
