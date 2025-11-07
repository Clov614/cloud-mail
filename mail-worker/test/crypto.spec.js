import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from '../src/utils/crypto-utils.js';

describe('crypto-utils', () => {
  describe('generateApiKey', () => {
    it('应生成以 cm_sk_ 开头的 fullKey', () => {
      const { fullKey, prefix } = generateApiKey();

      expect(fullKey).toMatch(/^cm_sk_/);
      expect(fullKey.length).toBeGreaterThan(6); // cm_sk_ + uuid without hyphens
    });

    it('应生成以 cm_ 开头的 prefix，且长度正确', () => {
      const { prefix } = generateApiKey();

      expect(prefix).toMatch(/^cm_/);
      expect(prefix.length).toBe(7); // cm_ + 4 chars, but secret.substring(secret.length - 4) where secret is 32 chars, so 4 chars
    });
  });

  describe('hashApiKey', () => {
    it('相同的输入应产生相同的 SHA-256 哈希输出', async () => {
      const input = 'test-key';
      const hash1 = await hashApiKey(input);
      const hash2 = await hashApiKey(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('不同的输入应产生不同的哈希', async () => {
      const hash1 = await hashApiKey('key1');
      const hash2 = await hashApiKey('key2');

      expect(hash1).not.toBe(hash2);
    });
  });
});