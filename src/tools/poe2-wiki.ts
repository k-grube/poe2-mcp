import { z } from 'zod'
import { defineTool, type ToolBody } from './define-tool.js'

const WIKI_API = 'https://www.poe2wiki.net/api.php'
const WIKI_PAGE_BASE = 'https://www.poe2wiki.net/wiki'
const USER_AGENT = 'poe2-mcp/0.1 (https://github.com/k-grube/poe2-mcp)'
const CACHE_TTL_MS = 60 * 60 * 1000

const cache = new Map<string, { fetchedAt: number; data: unknown }>()

interface WikiError {
  error?: { code?: string; info?: string }
}

async function callWiki(params: Record<string, string>): Promise<unknown> {
  const url = new URL(WIKI_API)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  url.searchParams.set('format', 'json')
  url.searchParams.set('formatversion', '2')
  const key = url.toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data
  }
  const resp = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } })
  if (!resp.ok) {
    throw new Error(`poe2wiki HTTP ${resp.status} for ${url.toString()}`)
  }
  const json = (await resp.json()) as WikiError & Record<string, unknown>
  if (json.error) {
    throw new Error(`poe2wiki: ${json.error.info ?? json.error.code ?? 'unknown error'}`)
  }
  cache.set(key, { fetchedAt: Date.now(), data: json })
  return json
}

function stripWikiHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .trim()
}

function pageUrl(title: string): string {
  return `${WIKI_PAGE_BASE}/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

const SearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
})

const searchBody: ToolBody = async (_bridge, args) => {
  const { query, limit = 10 } = SearchInput.parse(args)
  const data = (await callWiki({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    srprop: 'snippet|titlesnippet|wordcount',
  })) as { query?: { search?: Array<{ title: string; snippet?: string; wordcount?: number }> } }
  const results = (data.query?.search ?? []).map((r) => ({
    title: r.title,
    snippet: stripWikiHtml(r.snippet ?? ''),
    wordcount: r.wordcount ?? 0,
    url: pageUrl(r.title),
  }))
  return { query, results }
}

export const { definition: searchDefinition, handler: searchHandler } = defineTool(
  {
    name: 'poe2_wiki_search',
    description:
      'Search the community PoE 2 wiki (poe2wiki.net) for pages matching a query. Returns a list of { title, snippet, wordcount, url } sorted by MediaWiki relevance. Pass the title of a result to poe2_wiki_page to fetch full content. Useful for verifying game-mechanics claims (ailments, skill interactions, stat behavior) instead of relying on extrapolation from PoE 1.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'search terms, e.g. "Freeze buildup" or "Ignite duration"' },
        limit: { type: 'number', description: 'max results (default 10, max 50)' },
      },
      required: ['query'],
    },
  },
  searchBody,
)

const PageInput = z.object({
  title: z.string().min(1),
  section: z.number().int().nonnegative().optional(),
})

interface ParseSection {
  toclevel?: number
  level?: string
  line?: string
  number?: string
  index?: string
  anchor?: string
}

interface ParseResponse {
  parse?: {
    title?: string
    pageid?: number
    wikitext?: string
    sections?: ParseSection[]
    categories?: Array<{ category?: string; sortkey?: string; hidden?: boolean }>
    redirects?: Array<{ from?: string; to?: string }>
  }
}

const pageBody: ToolBody = async (_bridge, args) => {
  const { title, section } = PageInput.parse(args)
  const params: Record<string, string> = {
    action: 'parse',
    page: title,
    prop: 'wikitext|sections|categories',
    redirects: '1',
  }
  if (section !== undefined) {
    params.section = String(section)
  }
  const data = (await callWiki(params)) as ParseResponse
  const parse = data.parse
  if (!parse) {
    throw new Error(`poe2wiki: no parse data for "${title}"`)
  }
  const resolvedTitle = parse.title ?? title
  return {
    title: resolvedTitle,
    pageid: parse.pageid ?? null,
    url: pageUrl(resolvedTitle),
    section: section ?? null,
    sections: (parse.sections ?? []).map((s) => ({
      index: s.index ?? '',
      level: Number(s.level ?? '0'),
      title: s.line ?? '',
      anchor: s.anchor ?? '',
    })),
    categories: (parse.categories ?? [])
      .filter((c) => !c.hidden)
      .map((c) => c.category ?? '')
      .filter(Boolean),
    redirects: (parse.redirects ?? []).map((r) => ({ from: r.from, to: r.to })),
    wikitext: parse.wikitext ?? '',
  }
}

export const { definition: pageDefinition, handler: pageHandler } = defineTool(
  {
    name: 'poe2_wiki_page',
    description:
      'Fetch a page from poe2wiki.net by title (case-insensitive, follows redirects). Returns { title, url, sections[], categories[], wikitext }. wikitext is raw MediaWiki markup; section structure lets you re-call with section=N to fetch a single section. Useful after poe2_wiki_search picks a target page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'page title, e.g. "Freeze" or "Ignite"' },
        section: {
          type: 'number',
          description: '0-based section index (from a prior page response); omit for the full page',
        },
      },
      required: ['title'],
    },
  },
  pageBody,
)
