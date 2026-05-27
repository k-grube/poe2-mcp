// tests/tools/update-pob2.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { LuaBridge } from '../../src/lua-bridge.js';

vi.mock('../../src/pob-manager.js', () => ({
  cloneOrPull: vi.fn(),
  getHead: vi.fn(),
}));

import { handler, definition } from '../../src/tools/update-pob2.js';
import { cloneOrPull } from '../../src/pob-manager.js';

const mockBridge = { restart: vi.fn() } as unknown as LuaBridge;

describe('update_pob2 tool', () => {
  it('has correct name', () => expect(definition.name).toBe('update_pob2'));

  it('pulls and restarts bridge', async () => {
    vi.mocked(cloneOrPull).mockResolvedValueOnce({ action: 'pulled', head: 'abc1234' });
    const result = await handler(mockBridge, {});
    expect(vi.mocked(mockBridge.restart)).toHaveBeenCalled();
    const text = JSON.parse((result.content[0] as any).text);
    expect(text.action).toBe('pulled');
  });
});
