// tests/tools/gem-swap.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { LuaBridge } from '../../src/lua-bridge.js';
import { handler, definition } from '../../src/tools/gem-swap.js';

const mockBridge = { send: vi.fn() } as unknown as LuaBridge;

describe('compare_gem_swap tool', () => {
  it('has slot and new_gem as required inputs', () => {
    expect(definition.inputSchema.required).toContain('slot');
    expect(definition.inputSchema.required).toContain('new_gem');
  });

  it('returns delta on success', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: { before: { full_dps: 1_000_000 }, after: { full_dps: 1_100_000 }, delta_pct: 10 },
    });
    const result = await handler(mockBridge, { slot: '1', new_gem: 'Brutality' });
    const text = JSON.parse((result.content[0] as any).text);
    expect(text.delta_pct).toBe(10);
  });

  it('validates required inputs', async () => {
    const result = await handler(mockBridge, { slot: '1' });
    expect(result.isError).toBe(true);
  });
});
