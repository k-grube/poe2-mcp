// tests/tools/load-build.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { LuaBridge } from '../../src/lua-bridge.js';
import { handler, definition } from '../../src/tools/load-build.js';

const mockBridge = { send: vi.fn() } as unknown as LuaBridge;

describe('load_build tool', () => {
  it('definition has correct name and required pob_code input', () => {
    expect(definition.name).toBe('load_build');
    const props = definition.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty('pob_code');
    expect(definition.inputSchema.required).toContain('pob_code');
  });

  it('returns build summary on success', async () => {
    vi.mocked(mockBridge.send).mockResolvedValueOnce({
      ok: true,
      data: { class_name: 'Witch', ascendancy: 'Infernalist', level: 90, main_skill: 'Fireball' },
    });
    const result = await handler(mockBridge, { pob_code: '<xml/>' });
    expect(result.content[0].type).toBe('text');
    const text = JSON.parse((result.content[0] as any).text);
    expect(text.class_name).toBe('Witch');
    expect(text.level).toBe(90);
  });

  it('returns error text on bridge failure', async () => {
    vi.mocked(mockBridge.send).mockRejectedValueOnce(new Error('bad xml'));
    const result = await handler(mockBridge, { pob_code: 'garbage' });
    expect((result.content[0] as any).text).toContain('bad xml');
    expect(result.isError).toBe(true);
  });
});
