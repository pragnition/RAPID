'use strict';

/**
 * RAPID display utilities -- banner rendering with raw ANSI escape codes.
 *
 * Zero dependencies. Uses basic 16-color ANSI palette for maximum
 * terminal compatibility. Always outputs colors (no NO_COLOR checking).
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
};

/**
 * Stage-to-background-color mapping.
 * Uses bright background variants (10Xm) for better readability with white text.
 *
 * Groups:
 *   Planning stages (init, set-init, discuss, wave-plan, plan-set, start-set, discuss-set, new-version, add-set) = bright blue bg
 *   Execution stages (execute, execute-set, quick) = bright green bg
 *   Review stages (review, merge) = bright red bg
 */
const STAGE_BG = {
  'init': '\x1b[104m',        // bright blue
  'set-init': '\x1b[104m',    // bright blue
  'discuss': '\x1b[104m',     // bright blue
  'wave-plan': '\x1b[104m',   // bright blue
  'plan-set': '\x1b[104m',    // bright blue
  'execute': '\x1b[102m',     // bright green
  'review': '\x1b[101m',      // bright red
  'merge': '\x1b[101m',       // bright red
  'start-set': '\x1b[104m',   // bright blue (planning stage)
  'discuss-set': '\x1b[104m', // bright blue (planning stage)
  'execute-set': '\x1b[102m', // bright green (execution stage)
  'new-version': '\x1b[104m', // bright blue (lifecycle stage)
  'add-set': '\x1b[104m',    // bright blue (planning stage)
  'quick': '\x1b[102m',      // bright green (execution stage)
  'scaffold': '\x1b[104m',  // bright blue (planning stage)
  'branding': '\x1b[104m',  // bright blue (planning stage)
  'audit-version': '\x1b[101m',   // bright red (review/analysis stage)
};

/**
 * Render a branded RAPID stage banner.
 *
 * Produces a fixed-width, ANSI-colored banner string with the RAPID brand,
 * stage verb, and optional target. Always ends with ANSI reset code.
 *
 * @param {string} stage - Stage name (init, set-init, discuss, wave-plan, plan-set, execute, review, merge, start-set, discuss-set, execute-set, new-version, add-set, quick)
 * @param {string} [target] - Optional target description (e.g., "Wave 1.1", "auth-system")
 * @returns {string} Formatted banner string with ANSI escape codes, or fallback for unknown stages
 */
function renderBanner(stage, target) {
  const verb = STAGE_VERBS[stage];
  const bg = STAGE_BG[stage];

  if (!verb || !bg) {
    return `[RAPID] Unknown stage: ${stage}`;
  }

  const content = ` \u2593\u2593\u2593 RAPID \u25B6 ${verb}  ${target || ''} \u2593\u2593\u2593 `;
  // Pad to consistent fixed width (50 chars visible)
  const padded = content.padEnd(50);
  return `${bg}${ANSI.bold}${ANSI.brightWhite}${padded}${ANSI.reset}`;
}

module.exports = { renderBanner, STAGE_VERBS, STAGE_BG };
