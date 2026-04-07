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

  // ── Full mode: box-drawing layout, clamped to terminal width ──

  // Box-drawing characters (or ASCII fallbacks for NO_COLOR)
  const chars = noColor
    ? { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' }
    : { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' };

  const contentLines = [];
  if (clearRequired) {
    contentLines.push('Run /clear before continuing');
  }
  contentLines.push(`Next: ${nextCommand}`);
  if (breadcrumb && breadcrumb.length > 0) {
    contentLines.push(breadcrumb);
  }

  const maxLen = Math.max(...contentLines.map(l => l.length));
  // Clamp innerWidth so total box width (innerWidth + 2 border chars) never exceeds terminal
  const innerWidth = Math.min(Math.max(maxLen + 4, 40), columns - 2);

  const topBorder = `${chars.tl}${chars.h.repeat(innerWidth)}${chars.tr}`;
  const botBorder = `${chars.bl}${chars.h.repeat(innerWidth)}${chars.br}`;

  // Truncate lines that exceed the available inner space (innerWidth - 4 for 2-char padding each side)
  const maxTextWidth = innerWidth - 4;
  const truncate = (text) => {
    if (text.length > maxTextWidth) {
      return text.slice(0, maxTextWidth - 3) + '...';
    }
    return text;
  };

  const padLine = (text) => {
    const truncated = truncate(text);
    return `${chars.v}  ${truncated.padEnd(innerWidth - 2)}${chars.v}`;
  };
  const emptyLine = `${chars.v}${' '.repeat(innerWidth)}${chars.v}`;

  const boxLines = [topBorder, emptyLine];
  for (const line of contentLines) {
    boxLines.push(padLine(line));
  }
  boxLines.push(emptyLine, botBorder);

  return '\n' + boxLines.join('\n');
}

module.exports = { renderBanner, renderFooter, STAGE_VERBS, STAGE_BG };
