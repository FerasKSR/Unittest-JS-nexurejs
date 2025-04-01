/**
 * Type declarations for test utilities
 */

declare global {
  /**
   * Mock request factory
   * @param options Options to override default request values
   */
  function mockRequest(options?: Record<string, any>): {
    headers: Record<string, any>;
    method: string;
    url: string;
    params: Record<string, any>;
    query: Record<string, any>;
    body: Record<string, any>;
    [key: string]: any;
  };

  /**
   * Mock response factory
   */
  function mockResponse(): {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
    end: jest.Mock;
    setHeader: jest.Mock;
    getHeader: jest.Mock;
    headersSent: boolean;
    [key: string]: any;
  };
}

// This export is needed to make this a module
export {};
