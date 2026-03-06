'use strict';

/**
 * returns.cjs - Structured return protocol parser and generator.
 *
 * Every agent return contains both a human-readable Markdown table
 * AND a machine-parseable JSON payload in <!-- RAPID:RETURN {...} -->.
 * The JSON payload is the source of truth; the Markdown table is
 * rendered from the JSON (never independently generated).
 */

const { z } = require('zod');

const RETURN_MARKER = '<!-- RAPID:RETURN';
const RETURN_END = '-->';

const VALID_STATUSES = ['COMPLETE', 'CHECKPOINT', 'BLOCKED'];
const VALID_BLOCKER_CATEGORIES = ['DEPENDENCY', 'PERMISSION', 'CLARIFICATION', 'ERROR'];

/**
 * Parse a RAPID:RETURN marker from agent output text.
 *
 * @param {string} agentOutput - The full agent output text
 * @returns {{ parsed: boolean, data?: object, error?: string }}
 */
function parseReturn(agentOutput) {
  const markerIndex = agentOutput.indexOf(RETURN_MARKER);
  if (markerIndex === -1) {
    return { parsed: false, error: 'No RAPID:RETURN marker found' };
  }

  const jsonStart = markerIndex + RETURN_MARKER.length;
  const endIndex = agentOutput.indexOf(RETURN_END, jsonStart);
  if (endIndex === -1) {
    return { parsed: false, error: 'Unclosed RAPID:RETURN marker' };
  }

  const jsonStr = agentOutput.substring(jsonStart, endIndex).trim();

  try {
    const data = JSON.parse(jsonStr);
    return { parsed: true, data };
  } catch (err) {
    return { parsed: false, error: `Invalid JSON: ${err.message}` };
  }
}

/**
 * Generate a structured return string with Markdown table + JSON comment.
 *
 * @param {object} data - Return data with status and status-specific fields
 * @returns {string} Markdown string with table and RAPID:RETURN comment
 * @throws {Error} If data fails validation
 */
function generateReturn(data) {
  const validation = validateReturn(data);
  if (!validation.valid) {
    throw new Error(`Return validation failed: ${validation.errors.join(', ')}`);
  }

  const rows = buildTableRows(data);
  const table = formatTable(rows);
  const json = JSON.stringify(data);

  return `## ${data.status}\n\n${table}\n\n${RETURN_MARKER} ${json} ${RETURN_END}`;
}

/**
 * Validate return data has required fields for its status type.
 *
 * @param {object} data - Return data to validate
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateReturn(data) {
  const errors = [];

  if (!data || !data.status) {
    errors.push('status is required');
    return { valid: false, errors };
  }

  if (!VALID_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    return { valid: false, errors };
  }

  switch (data.status) {
    case 'COMPLETE':
      if (!Array.isArray(data.artifacts)) {
        errors.push('artifacts (array) is required for COMPLETE status');
      }
      if (typeof data.tasks_completed !== 'number') {
        errors.push('tasks_completed (number) is required for COMPLETE status');
      }
      if (typeof data.tasks_total !== 'number') {
        errors.push('tasks_total (number) is required for COMPLETE status');
      }
      break;

    case 'CHECKPOINT':
      if (typeof data.handoff_done !== 'string') {
        errors.push('handoff_done (string) is required for CHECKPOINT status');
      }
      if (typeof data.handoff_remaining !== 'string') {
        errors.push('handoff_remaining (string) is required for CHECKPOINT status');
      }
      if (typeof data.handoff_resume !== 'string') {
        errors.push('handoff_resume (string) is required for CHECKPOINT status');
      }
      break;

    case 'BLOCKED':
      if (!data.blocker_category || !VALID_BLOCKER_CATEGORIES.includes(data.blocker_category)) {
        errors.push(`blocker_category must be one of: ${VALID_BLOCKER_CATEGORIES.join(', ')}`);
      }
      if (typeof data.blocker !== 'string') {
        errors.push('blocker (string) is required for BLOCKED status');
      }
      if (typeof data.resolution !== 'string') {
        errors.push('resolution (string) is required for BLOCKED status');
      }
      break;
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Build table rows based on status type.
 * Only includes rows for non-null, non-empty fields.
 */
function buildTableRows(data) {
  const rows = [];

  rows.push(['Status', data.status]);

  switch (data.status) {
    case 'COMPLETE':
      if (data.artifacts && data.artifacts.length > 0) {
        rows.push(['Artifacts', data.artifacts.map(a => `\`${a}\``).join(', ')]);
      }
      if (data.commits && data.commits.length > 0) {
        rows.push(['Commits', data.commits.join(', ')]);
      }
      rows.push(['Tasks', `${data.tasks_completed}/${data.tasks_total}`]);
      if (data.duration_minutes != null) {
        rows.push(['Duration', `${data.duration_minutes} min`]);
      }
      if (data.next_action) {
        rows.push(['Next', data.next_action]);
      }
      if (data.warnings && data.warnings.length > 0) {
        rows.push(['Warnings', data.warnings.join('; ')]);
      }
      if (data.notes) {
        rows.push(['Notes', data.notes]);
      }
      break;

    case 'CHECKPOINT':
      if (data.artifacts && data.artifacts.length > 0) {
        rows.push(['Artifacts', data.artifacts.map(a => `\`${a}\``).join(', ')]);
      }
      if (data.tasks_completed != null && data.tasks_total != null) {
        rows.push(['Tasks', `${data.tasks_completed}/${data.tasks_total}`]);
      }
      if (data.duration_minutes != null) {
        rows.push(['Duration', `${data.duration_minutes} min`]);
      }
      rows.push(['Done', data.handoff_done]);
      rows.push(['Remaining', data.handoff_remaining]);
      if (data.decisions && data.decisions.length > 0) {
        rows.push(['Decisions', data.decisions.join('; ')]);
      }
      if (data.blockers && data.blockers.length > 0) {
        rows.push(['Blockers', data.blockers.join('; ')]);
      }
      rows.push(['Resume', data.handoff_resume]);
      break;

    case 'BLOCKED':
      rows.push(['Category', data.blocker_category]);
      rows.push(['Blocker', data.blocker]);
      rows.push(['Resolution', data.resolution]);
      if (data.artifacts && data.artifacts.length > 0) {
        rows.push(['Artifacts', data.artifacts.map(a => `\`${a}\``).join(', ')]);
      }
      if (data.tasks_completed != null && data.tasks_total != null) {
        rows.push(['Tasks', `${data.tasks_completed}/${data.tasks_total}`]);
      }
      break;
  }

  return rows;
}

/**
 * Format rows into a Markdown table.
 */
function formatTable(rows) {
  const lines = [
    '| Field | Value |',
    '|-------|-------|',
  ];

  for (const [field, value] of rows) {
    lines.push(`| ${field} | ${value} |`);
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Zod schemas for structured inter-agent handoff validation
// ────────────────────────────────────────────────────────────────

const CompleteReturn = z.object({
  status: z.literal('COMPLETE'),
  artifacts: z.array(z.string()),
  tasks_completed: z.number(),
  tasks_total: z.number(),
  commits: z.array(z.string()).optional(),
  duration_minutes: z.number().optional(),
  next_action: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const CheckpointReturn = z.object({
  status: z.literal('CHECKPOINT'),
  handoff_done: z.string(),
  handoff_remaining: z.string(),
  handoff_resume: z.string(),
  artifacts: z.array(z.string()).optional(),
  tasks_completed: z.number().optional(),
  tasks_total: z.number().optional(),
  duration_minutes: z.number().optional(),
  decisions: z.array(z.string()).optional(),
  blockers: z.array(z.string()).optional(),
});

const BlockedReturn = z.object({
  status: z.literal('BLOCKED'),
  blocker_category: z.enum(['DEPENDENCY', 'PERMISSION', 'CLARIFICATION', 'ERROR']),
  blocker: z.string(),
  resolution: z.string(),
  artifacts: z.array(z.string()).optional(),
  tasks_completed: z.number().optional(),
  tasks_total: z.number().optional(),
});

const AnyReturn = z.discriminatedUnion('status', [CompleteReturn, CheckpointReturn, BlockedReturn]);

const ReturnSchemas = {
  Complete: CompleteReturn,
  Checkpoint: CheckpointReturn,
  Blocked: BlockedReturn,
  Any: AnyReturn,
};

/**
 * Validate agent output using Zod schemas at handoff points.
 *
 * Parses the RAPID:RETURN marker, then validates the JSON payload
 * against the appropriate Zod schema based on the status field.
 *
 * @param {string} agentOutput - The full agent output text
 * @returns {{ valid: true, data: object } | { valid: false, error: string }}
 */
function validateHandoff(agentOutput) {
  const parseResult = parseReturn(agentOutput);

  if (!parseResult.parsed) {
    return { valid: false, error: parseResult.error };
  }

  const zodResult = AnyReturn.safeParse(parseResult.data);

  if (!zodResult.success) {
    const errorMsg = zodResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { valid: false, error: errorMsg };
  }

  return { valid: true, data: zodResult.data };
}

module.exports = { parseReturn, generateReturn, validateReturn, validateHandoff, ReturnSchemas };
