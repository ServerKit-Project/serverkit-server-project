abstract class Response {
  message: 'success' | 'error';

  constructor(message: 'success' | 'error') {
    this.message = message;
  }
}

export class SuccessResponse<T> extends Response {
  data?: T | undefined;

  constructor(data?: T) {
    super('success');
    this.data = data;
  }
}

export class PaginationResponse<T> extends Response {
  data: {
    list: T[];
    pagination: {
      page: number;
      pageSize: number;
      totalPage: number;
      itemCount: number;
    };
  };

  constructor({
    list,
    page,
    pageSize,
    totalPage,
    itemCount
  }: {
    list: T[];
    page: number;
    pageSize: number;
    totalPage: number;
    itemCount: number;
  }) {
    super('success');
    this.data = {
      list,
      pagination: {
        page,
        pageSize,
        totalPage,
        itemCount,
      },
    };
  }
}

export class FailedResponse extends Response {
  status: number;
  error: string;

  constructor(status: number, error: string) {
    super('error');
    this.status = status;
    this.error = error;
  }
}

export class InternalErrorResponse extends Response {
  error: string;

  constructor(error: string) {
    super('error');
    this.error = error;
  }
}