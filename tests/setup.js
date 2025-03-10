import { TextEncoder, TextDecoder } from 'util';
// Add TextEncoder and TextDecoder to global scope for Node.js environments
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// Mock native module loading
jest.mock('../src/native/index.js', () => ({
    configureNativeModules: jest.fn(),
    getNativeModuleStatus: jest.fn(() => ({
        loaded: false,
        httpParser: false,
        radixRouter: false,
        jsonProcessor: false,
        error: 'Native modules disabled for testing'
    })),
    HttpParser: jest.fn().mockImplementation(() => ({
        parse: jest.fn(),
        parseHeaders: jest.fn(),
        parseBody: jest.fn(),
        reset: jest.fn()
    })),
    RadixRouter: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
        find: jest.fn(),
        remove: jest.fn()
    })),
    JsonProcessor: jest.fn().mockImplementation(() => ({
        parse: jest.fn(),
        stringify: jest.fn(),
        parseStream: jest.fn(),
        stringifyStream: jest.fn()
    }))
}));
//# sourceMappingURL=setup.js.map