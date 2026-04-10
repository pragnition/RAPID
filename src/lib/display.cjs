'use strict';

/**
 * RAPID display utilities -- banner rendering with raw ANSI escape codes.
 *
 * Zero dependencies. Uses basic 16-color ANSI palette for maximum
 * terminal compatibility. Respects NO_COLOR (https://no-color.org) when set to a non-empty value.
 */

// ANSI escape codes -- basic 16-color palette
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  brightWhite: '\x1b[97m',
  dim: '\x1b[2m',
};

/**
 * Stage-to-verb mapping for banner display.
 * Each stage gets an uppercase action verb.
 *
 * Legacy (8): init, set-init, discuss, wave-plan, plan-set, execute, review, merge
 * v3.0  (7): start-set, discuss-set, execute-set, new-version, add-set, quick, scaffold
 * Branding (1): branding
 * Audit   (1): audit-version
 * Review  (4): unit-test, bug-hunt, uat, bug-fix
 */
const STAGE_VERBS = {
  'init': 'INITIALIZING',
  'set-init': 'PREPARING',
  'discuss': 'DISCUSSING',
  'wave-plan': 'PLANNING',
  'plan-set': 'PLANNING SET',
  'execute': 'EXECUTING',
  'review': 'REVIEWING',
  'merge': 'MERGING',
  'start-set': 'STARTING SET',
  'discuss-set': 'DISCUSSING SET',
  'execute-set': 'EXECUTING SET',
  'new-version': 'NEW VERSION',
  'add-set': 'ADDING SET',
  'quick': 'QUICK TASK',
  'scaffold': 'SCAFFOLDING',
  'branding': 'BRANDING',
  'audit-version': 'AUDITING',
  'unit-test': 'UNIT TESTING',
  'bug-hunt': 'BUG HUNTING',
  'uat': 'UAT TESTING',
  'bug-fix': 'BUG FIXING',
};

/**
 * Stage-to-background-color mapping.
 * Uses dark background variants (4Xm) for better readability with white text.
 *
 * Groups:
 *   Planning stages (init, set-init, discuss, wave-plan, plan-set, start-set, discuss-set, new-version, add-set, scaffold, branding) = dark blue bg
 *   Execution stages (execute, execute-set, quick) = dark green bg
 *   Review stages (review, merge, audit-version, unit-test, bug-hunt, uat, bug-fix) = dark red bg
 */
const STAGE_BG = {
  'init': '\x1b[44m',        // dark blue
  'set-init': '\x1b[44m',    // dark blue
  'discuss': '\x1b[44m',     // dark blue
  'wave-plan': '\x1b[44m',   // dark blue
  'plan-set': '\x1b[44m',    // dark blue
  'execute': '\x1b[42m',     // dark green
  'review': '\x1b[41m',      // dark red
  'merge': '\x1b[41m',       // dark red
  'start-set': '\x1b[44m',   // dark blue (planning stage)
  'discuss-set': '\x1b[44m', // dark blue (planning stage)
  'execute-set': '\x1b[42m', // dark green (execution stage)
  'new-version': '\x1b[44m', // dark blue (lifecycle stage)
  'add-set': '\x1b[44m',    // dark blue (planning stage)
  'quick': '\x1b[42m',      // dark green (execution stage)
  'scaffold': '\x1b[44m',  // dark blue (planning stage)
  'branding': '\x1b[44m',  // dark blue (planning stage)
  'audit-version': '\x1b[41m',   // dark red (review/analysis stage)
  'unit-test': '\x1b[41m',    // dark red (review stage)
  'bug-hunt': '\x1b[41m',     // dark red (review stage)
  'uat': '\x1b[41m',          // dark red (review stage)
  'bug-fix': '\x1b[41m',      // dark red (review stage)
};

/**
 * Render a branded RAPID stage banner.
 *
 * Produces a fixed-width, ANSI-colored banner string with the RAPID brand,
 * stage verb, and optional target. Always ends with ANSI reset code.
 *
 * @param {string} stage - Stage name (init, set-init, discuss, wave-plan, plan-set, execute, review, merge, start-set, discuss-set, execute-set, new-version, add-set, quick, scaffold, branding, audit-version, unit-test, bug-hunt, uat, bug-fix)
 * @param {string} [target] - Optional target description (e.g., "Wave 1.1", "auth-system")
 * @returns {string} Formatted banner string with ANSI escape codes, or fallback for unknown stages
 */
function renderBanner(stage, target) {
  const verb = STAGE_VERBS[stage];
  const bg = STAGE_BG[stage];

  if (!verb || !bg) {
    return `[RAPID] Unknown stage: ${stage}`;
  }

  // NO_COLOR support (https://no-color.org) -- any non-empty value suppresses color
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return `--- RAPID > ${verb}  ${target || ''} ---`;
  }

  const content = ` \u2593\u2593\u2593 RAPID \u25B6 ${verb}  ${target || ''} \u2593\u2593\u2593 `;
  // Pad to consistent fixed width (50 chars visible)
  const padded = content.padEnd(50);
  return `${bg}${ANSI.bold}${ANSI.brightWhite}${padded}${ANSI.reset}`;
}

/**
 * Render a standardized footer with /clear reminder, next command, and optional breadcrumb.
 *
 * Returns a multi-line string (does NOT write to stdout). The caller decides output.
 * Footer uses no ANSI color codes -- plain text only.
 *
 * @param {string} nextCommand - The next command to suggest (e.g., '/rapid:plan-set 1')
 * @param {object} [options] - Optional settings
 * @param {string} [options.breadcrumb] - Raw breadcrumb string to display as-is
 * @param {boolean} [options.clearRequired=true] - Whether to include the /clear reminder line
 * @returns {string} Formatted footer string
 */
function renderFooter(nextCommand, options = {}) {
  const { breadcrumb, clearRequired = true } = options;

  // Detect terminal width: process.stdout.columns -> COLUMNS env -> default 80
  const columns = process.stdout.columns || parseInt(process.env.COLUMNS, 10) || 80;
  const compact = columns < 60;

  const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';

  // ── Compact mode: plain text, no box-drawing ──
  if (compact) {
    const lines = ['---'];
    if (clearRequired) {
      lines.push('> /clear');
    }
    lines.push(`> ${nextCommand}`);
    if (breadcrumb && breadcrumb.length > 0) {
      // Abbreviate [done] to [ok] for space savings
      lines.push(`> ${breadcrumb.replace(/\[done\]/g, '[ok]')}`);
    }
    lines.push('---');
    return '\n' + lines.join('\n');
  }

  // ── Full mode: compact inline footer ──

  const bullet = noColor ? '>' : '\u25B6';

  const lines = [];
  if (clearRequired) {
    lines.push(`${bullet} Run /clear before continuing`);
  }

  let nextLine = `${bullet} Next: ${nextCommand}`;
  if (breadcrumb && breadcrumb.length > 0) {
    const separator = '  \u00B7  ';
    const combined = nextLine + separator + breadcrumb;
    if (combined.length > columns - 2) {
      // Truncate breadcrumb so the whole line fits within columns - 2
      const available = columns - 2 - nextLine.length - separator.length;
      if (available > 3) {
        nextLine = nextLine + separator + breadcrumb.slice(0, available - 3) + '...';
      } else {
        nextLine = nextLine + separator + '...';
      }
    } else {
      nextLine = combined;
    }
  }
  lines.push(nextLine);

  return '\n' + lines.join('\n');
}

/**
 * Render a deferred update-reminder banner. Designed to be called AFTER a
 * command's primary output, so the user sees the reminder without it
 * disrupting parsing/automation.
 *
 * Returns an empty string (caller should emit nothing) when:
 *   - the install is not stale,
 *   - stdout is not a TTY (piped/scripted contexts),
 *   - NO_UPDATE_NOTIFIER is set to any non-empty value, or
 *   - the timestamp can't be read.
 *
 * Respects NO_COLOR (https://no-color.org): when set to a non-empty value,
 * the banner is plain text. Otherwise it is wrapped in ANSI dim.
 *
 * @param {string} pluginRoot - Absolute path to plugin root
 * @returns {string} Banner string (with optional trailing reset) or empty string
 */
function renderUpdateReminder(pluginRoot) {
  // Suppression checks first -- cheapest, no I/O
  if (!process.stdout.isTTY) return '';
  if (process.env.NO_UPDATE_NOTIFIER !== undefined && process.env.NO_UPDATE_NOTIFIER !== '') {
    return '';
  }

  // Lazy-require version primitives to avoid pulling fs into display.cjs's
  // require graph at module load time.
  const { readInstallTimestamp, isUpdateStale } = require('./version.cjs');

  const timestamp = readInstallTimestamp(pluginRoot);
  if (timestamp === null) return '';
  if (!isUpdateStale(pluginRoot)) return '';

  const ageMs = Date.now() - new Date(timestamp).getTime();
  const ageDays = Math.floor(ageMs / 86400000);
  const text = `[RAPID] Your install is ${ageDays} days old. Run /rapid:install to refresh.`;

  const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
  if (noColor) return text;
  return `${ANSI.dim}${text}${ANSI.reset}`;
}

module.exports = { renderBanner, renderFooter, renderUpdateReminder, STAGE_VERBS, STAGE_BG };
