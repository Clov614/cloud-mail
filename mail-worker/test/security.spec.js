import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiKeyAuthMiddleware } from '../src/security/security.js';

// Mock dependencies
vi.mock('../src/utils/crypto-utils.js', () => ({
  hashApiKey: vi.fn()
}));

vi.mock('../src/entity/orm.js', () => ({
  default: vi.fn()
}));

vi.mock('../src/entity/api_key.js', () => ({
  default: {}
}));

vi.mock('../src/entity/user.js', () => ({
  default: {}
}));

vi.mock('../src/model/result.js', () => ({
  default: {
    fail: vi.fn((msg) => ({ error: msg }))
  }
}));

describe('apiKeyAuthMiddleware', () => {
  let mockContext;
  let mockNext;

  beforeEach(() => {
    mockNext = vi.fn();
    mockContext = {
      req: {
        header: vi.fn()
      },
      set: vi.fn(),
      json: vi.fn(),
      executionCtx: {
        waitUntil: vi.fn()
      },
      env: {}
    };
  });

  it('应旁路没有 X-API-Key 的请求', async () => {
    // 模拟没有 X-API-Key 头
    mockContext.req.header.mockReturnValue(undefined);

    await apiKeyAuthMiddleware(mockContext, mockNext);

    // 断言 next 被调用
    expect(mockNext).toHaveBeenCalledTimes(1);
    // 断言 c.set('user', ...) 未被调用
    expect(mockContext.set).not.toHaveBeenCalled();
  });

  it('应拒绝无效的 X-API-Key', async () => {
    // 模拟有无效的 X-API-Key
    mockContext.req.header.mockReturnValue('invalid-key');

    // Mock hashApiKey
    const { hashApiKey } = await import('../src/utils/crypto-utils.js');
    hashApiKey.mockResolvedValue('hashed-invalid');

    // Mock db select to return empty array
    const { default: orm } = await import('../src/entity/orm.js');
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            leftJoin: vi.fn(() => [])
          }))
        }))
      }))
    };
    orm.mockReturnValue(mockDb);

    await apiKeyAuthMiddleware(mockContext, mockNext);

    // 断言 next 未被调用
    expect(mockNext).not.toHaveBeenCalled();
    // 断言 c.json 被调用，状态码 401
    expect(mockContext.json).toHaveBeenCalledWith({ error: 'Invalid API Key' }, 401);
  });

  it('应接受有效的 X-API-Key 并注入用户', async () => {
    // 模拟有有效的 X-API-Key
    mockContext.req.header.mockReturnValue('valid-key');

    // Mock hashApiKey
    const { hashApiKey } = await import('../src/utils/crypto-utils.js');
    hashApiKey.mockResolvedValue('hashed-valid');

    // Mock db select to return apiKeyWithUser
    const mockApiKeyWithUser = {
      api_key: { id: 1 },
      user: { userId: 123, email: 'test@example.com' }
    };
    const { default: orm } = await import('../src/entity/orm.js');
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            leftJoin: vi.fn(() => [mockApiKeyWithUser])
          }))
        }))
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve())
        }))
      }))
    };
    orm.mockReturnValue(mockDb);

    await apiKeyAuthMiddleware(mockContext, mockNext);

    // 断言 c.set('user', ...) 被调用
    expect(mockContext.set).toHaveBeenCalledWith('user', mockApiKeyWithUser.user);
    // 断言 next 被调用
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});