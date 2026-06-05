import { describe, it, expect } from 'vitest';
import {
  extractSystemPrompt,
  extractInputContent,
  extractOutputContent,
  generateMarkdownTrace,
  type MarkdownTrace,
} from './markdown';

const ISO = (offsetMs = 0) => new Date(Date.UTC(2026, 5, 1, 0, 0, 0) + offsetMs).toISOString();

describe('extractSystemPrompt', () => {
  it('reads from GenAI attributes on span.metadata.attributes', () => {
    const span = {
      metadata: { attributes: { 'gen_ai.system_prompt': 'You are helpful.' } },
    };
    expect(extractSystemPrompt(span)).toBe('You are helpful.');
  });

  it('falls back through attribute keys in declared order', () => {
    const span = {
      metadata: { attributes: { 'gen_ai.prompt': 'from prompt key' } },
    };
    expect(extractSystemPrompt(span)).toBe('from prompt key');
  });

  it('reads from top-level systemPrompt field', () => {
    const span = { systemPrompt: 'top-level system' };
    expect(extractSystemPrompt(span)).toBe('top-level system');
  });

  it('reads from system role in input array', () => {
    const span = {
      input: [
        { role: 'system', content: 'You are a translator.' },
        { role: 'user', content: 'Hi' },
      ],
    };
    expect(extractSystemPrompt(span)).toBe('You are a translator.');
  });

  it('treats developer role as system', () => {
    const span = {
      input: [{ role: 'developer', content: 'dev policy' }],
    };
    expect(extractSystemPrompt(span)).toBe('dev policy');
  });

  it('returns null when nothing matches', () => {
    expect(extractSystemPrompt({ input: 'no system' })).toBeNull();
    expect(extractSystemPrompt(null)).toBeNull();
    expect(extractSystemPrompt(undefined)).toBeNull();
  });
});

describe('extractInputContent', () => {
  it('returns flattened text of non-system messages', () => {
    const span = {
      input: [
        { role: 'system', content: 'should be excluded' },
        { role: 'user', content: 'Hello, world.' },
        { role: 'assistant', content: 'Hi!' },
      ],
    };
    const out = extractInputContent(span);
    expect(out).toContain('Hello, world.');
    expect(out).toContain('Hi!');
    expect(out).not.toContain('should be excluded');
  });

  it('stringifies raw JSON tool-call payload', () => {
    const span = {
      input: { tool: 'get_weather', args: { city: 'SF' } },
    };
    const out = extractInputContent(span);
    expect(out).toContain('"tool": "get_weather"');
    expect(out).toContain('"city": "SF"');
  });

  it('returns plain string for string input', () => {
    expect(extractInputContent({ input: 'just a string' })).toBe('just a string');
  });

  it('returns null for missing input', () => {
    expect(extractInputContent({ input: null })).toBeNull();
    expect(extractInputContent({})).toBeNull();
  });
});

describe('extractOutputContent', () => {
  it('extracts text content from assistant message arrays', () => {
    const span = {
      output: [{ role: 'assistant', content: 'Model answer.' }],
    };
    expect(extractOutputContent(span)).toBe('Model answer.');
  });

  it('stringifies tool-call output', () => {
    const span = {
      output: [{ name: 'get_weather', result: { temp: 72 } }],
    };
    const out = extractOutputContent(span);
    expect(out).toContain('"get_weather"');
    expect(out).toContain('72');
  });

  it('returns null for missing output', () => {
    expect(extractOutputContent({ output: null })).toBeNull();
    expect(extractOutputContent({})).toBeNull();
  });
});

describe('generateMarkdownTrace', () => {
  it('emits "No observations found" when observations empty', () => {
    const md = generateMarkdownTrace({
      id: 't1',
      name: 'empty',
      timestamp: ISO(),
      latency: 0,
      observations: [],
    } as MarkdownTrace);
    expect(md).toContain('# Trace Analysis: empty');
    expect(md).toContain('*No observations found.*');
  });

  it('falls back to "Unknown" name', () => {
    const md = generateMarkdownTrace({ id: 't1' } as MarkdownTrace);
    expect(md).toContain('# Trace Analysis: Unknown');
  });

  it('builds full structure with system prompt, user input and output', () => {
    const trace: MarkdownTrace = {
      id: 'trace-xyz',
      name: 'chat run',
      timestamp: ISO(0),
      latency: 1.234,
      observations: [
        {
          id: 'o1',
          traceId: 'trace-xyz',
          type: 'GENERATION',
          name: 'gpt-call',
          startTime: ISO(0),
          endTime: ISO(800),
          usage: { promptTokens: 12, completionTokens: 34, totalTokens: 46 },
          input: [
            { role: 'system', content: 'You are concise.' },
            { role: 'user', content: 'What is 2+2?' },
          ],
          output: [{ role: 'assistant', content: '4' }],
        },
      ],
    };

    const md = generateMarkdownTrace(trace);

    // Header
    expect(md).toContain('# Trace Analysis: chat run');
    expect(md).toContain('## Global Metadata');
    expect(md).toContain('**Trace ID**: trace-xyz');
    expect(md).toContain('**Total Tokens**: 46');
    expect(md).toContain('## Trace Spans (Chronological Order)');

    // Span
    expect(md).toContain('### 1. [GENERATION] gpt-call');
    expect(md).toContain('**Latency**: 800ms');
    expect(md).toContain('**Tokens**: 46');

    // XML tags
    expect(md).toContain('<input>');
    expect(md).toContain('<system_prompt>\nYou are concise.\n</system_prompt>');
    expect(md).toContain('<user_input>\nWhat is 2+2?\n</user_input>');
    expect(md).toContain('</input>');
    expect(md).toContain('<output>');
    expect(md).toContain('4');
    expect(md).toContain('</output>');
  });

  it('omits system_prompt tag when not present and falls back to *No output recorded.*', () => {
    const trace: MarkdownTrace = {
      id: 't2',
      name: 'no-system',
      timestamp: ISO(0),
      observations: [
        {
          id: 'o2',
          traceId: 't2',
          type: 'SPAN',
          name: 'tool-only',
          startTime: ISO(0),
          endTime: ISO(500),
          input: { tool: 'noop' },
        },
      ],
    };
    const md = generateMarkdownTrace(trace);
    expect(md).not.toContain('<system_prompt>');
    expect(md).toContain('<user_input>');
    expect(md).toContain('"tool": "noop"');
    expect(md).toContain('*No output recorded.*');
  });

  it('sorts observations by startTime ascending', () => {
    const trace: MarkdownTrace = {
      id: 't3',
      name: 'ordered',
      timestamp: ISO(0),
      observations: [
        {
          id: 'late',
          traceId: 't3',
          type: 'SPAN',
          name: 'late',
          startTime: ISO(2000),
          endTime: ISO(2200),
        },
        {
          id: 'early',
          traceId: 't3',
          type: 'SPAN',
          name: 'early',
          startTime: ISO(500),
          endTime: ISO(800),
        },
      ],
    };
    const md = generateMarkdownTrace(trace);
    const earlyIdx = md.indexOf('### 1.');
    const lateIdx = md.indexOf('### 2.');
    expect(earlyIdx).toBeGreaterThan(-1);
    expect(lateIdx).toBeGreaterThan(earlyIdx);
    expect(md.substring(earlyIdx, lateIdx)).toContain('[SPAN] early');
  });
});
