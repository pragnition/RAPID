'use strict';

const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./tool-docs.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_BUDGET_TOKENS = 120000;
const DIGEST_SUFFIX = '-DIGEST.md';
const VERBATIM_PATTERNS = ['CONTRACT.json'];
const ACTIVE_WAVE_EXEMPT = true;

// ---------------------------------------------------------------------------
// resolveDigestPath(artifactPath)
// Given an artifact file path, compute the sibling digest path.
// Example: 'wave-1-PLAN.md' -> 'wave-1-PLAN-DIGEST.md'
//          'HANDOFF.md' -> 'HANDOFF-DIGEST.md'
//          'CONTRACT.json' -> 'CONTRACT.json-DIGEST.md'
// ---------------------------------------------------------------------------
function resolveDigestPath(artifactPath) {
  if (artifactPath.endsWith('.md')) {
    return artifactPath.slice(0, -3) + DIGEST_SUFFIX;
  }
  return artifactPath + DIGEST_SUFFIX;
}

// ---------------------------------------------------------------------------
// readDigestOrFull(artifactPath)
// Read a digest file if it exists, otherwise read the full artifact.
// Returns { content, isDigest, path, tokens }.
// ---------------------------------------------------------------------------
function readDigestOrFull(artifactPath) {
  const digestPath = resolveDigestPath(artifactPath);
  let content;
  let isDigest;
  let readPath;

  if (fs.existsSync(digestPath)) {
    content = fs.readFileSync(digestPath, 'utf-8');
    isDigest = true;
    readPath = digestPath;
  } else {
    content = fs.readFileSync(artifactPath, 'utf-8');
    isDigest = false;
    readPath = artifactPath;
  }

  return {
    content,
    isDigest,
    path: artifactPath,
    tokens: estimateTokens(content),
  };
}

// ---------------------------------------------------------------------------
// isVerbatimArtifact(filename)
// Check if an artifact should always be included verbatim (never compacted).
// Small config files like CONTRACT.json stay verbatim.
// ---------------------------------------------------------------------------
function isVerbatimArtifact(filename) {
  if (VERBATIM_PATTERNS.includes(filename)) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// compactContext(context, options)
// Context-aware compaction that preserves active state while summarizing
// completed work. Reads pre-written digests for completed wave artifacts.
// ---------------------------------------------------------------------------
function compactContext(context, options = {}) {
  const budget = options.budget || DEFAULT_BUDGET_TOKENS;
  let totalTokens = 0;
  let digestsUsed = 0;
  let fullsUsed = 0;

  const compacted = context.waves.map(wave => {
    const isActiveWave = ACTIVE_WAVE_EXEMPT && wave.wave === context.activeWave;
    const isCompletedWave = wave.wave < context.activeWave;

    const artifacts = wave.artifacts.map(artifact => {
      const filename = path.basename(artifact.path);

      // Active wave: always read full content
      if (isActiveWave) {
        const content = fs.readFileSync(artifact.path, 'utf-8');
        const tokens = estimateTokens(content);
        totalTokens += tokens;
        fullsUsed++;
        return {
          name: artifact.name,
          content,
          isDigest: false,
          tokens,
          path: artifact.path,
        };
      }

      // Verbatim patterns: always read full content
      if (isVerbatimArtifact(filename)) {
        const content = fs.readFileSync(artifact.path, 'utf-8');
        const tokens = estimateTokens(content);
        totalTokens += tokens;
        fullsUsed++;
        return {
          name: artifact.name,
          content,
          isDigest: false,
          tokens,
          path: artifact.path,
        };
      }

      // Completed wave: try digest, fallback to full
      if (isCompletedWave) {
        const result = readDigestOrFull(artifact.path);
        totalTokens += result.tokens;
        if (result.isDigest) {
          digestsUsed++;
        } else {
          fullsUsed++;
        }
        return {
          name: artifact.name,
          content: result.content,
          isDigest: result.isDigest,
          tokens: result.tokens,
          path: artifact.path,
        };
      }

      // Future wave or wave 0 (set-level): read full content
      const content = fs.readFileSync(artifact.path, 'utf-8');
      const tokens = estimateTokens(content);
      totalTokens += tokens;
      fullsUsed++;
      return {
        name: artifact.name,
        content,
        isDigest: false,
        tokens,
        path: artifact.path,
      };
    });

    return { wave: wave.wave, artifacts };
  });

  return {
    compacted,
    totalTokens,
    digestsUsed,
    fullsUsed,
    budgetExceeded: totalTokens > budget,
  };
}

// ---------------------------------------------------------------------------
// Hook Registry -- Global singleton for lifecycle event triggers
// ---------------------------------------------------------------------------

/** @type {Object<string, Array<function>>} */
let _hookRegistry = {};
const VALID_EVENTS = ['wave-complete', 'pause', 'review-stage-complete'];

// ---------------------------------------------------------------------------
// registerCompactionTrigger(event, handler)
// Register a callback for a lifecycle event that should trigger
// compaction-related actions.
// ---------------------------------------------------------------------------
function registerCompactionTrigger(event, handler) {
  if (!VALID_EVENTS.includes(event)) {
    throw new Error(`Invalid compaction trigger event "${event}". Valid events: ${VALID_EVENTS.join(', ')}`);
  }
  if (!_hookRegistry[event]) {
    _hookRegistry[event] = [];
  }
  _hookRegistry[event].push(handler);
}

// ---------------------------------------------------------------------------
// fireCompactionTrigger(event, context)
// Fire all registered handlers for a lifecycle event.
// Handlers are called sequentially. Errors are caught and logged but do not
// prevent subsequent handlers from running.
// ---------------------------------------------------------------------------
async function fireCompactionTrigger(event, context) {
  if (!VALID_EVENTS.includes(event)) {
    throw new Error(`Invalid compaction trigger event "${event}". Valid events: ${VALID_EVENTS.join(', ')}`);
  }
  const handlers = _hookRegistry[event] || [];
  let fired = 0;
  const errors = [];

  for (const handler of handlers) {
    try {
      await handler(context);
      fired++;
    } catch (err) {
      errors.push(err.message || String(err));
      fired++;
    }
  }

  return { fired, errors };
}

// ---------------------------------------------------------------------------
// clearHooks()
// Clear all registered hooks. Primarily for testing.
// ---------------------------------------------------------------------------
function clearHooks() {
  _hookRegistry = {};
}

// ---------------------------------------------------------------------------
// getRegisteredHooks()
// Get a snapshot of registered hooks for inspection.
// ---------------------------------------------------------------------------
function getRegisteredHooks() {
  const result = {};
  for (const [event, handlers] of Object.entries(_hookRegistry)) {
    result[event] = handlers.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// collectWaveArtifacts(setDir)
// Scan a set's planning directory and collect wave artifacts grouped by wave.
// ---------------------------------------------------------------------------
function collectWaveArtifacts(setDir) {
  if (!fs.existsSync(setDir)) {
    return [];
  }

  let entries;
  try {
    entries = fs.readdirSync(setDir);
  } catch {
    return [];
  }

  const waveMap = new Map();

  // Helper to add artifact to a wave group
  function addArtifact(waveNum, name, filePath) {
    if (!waveMap.has(waveNum)) {
      waveMap.set(waveNum, []);
    }
    waveMap.get(waveNum).push({ name, path: filePath });
  }

  // Wave-level artifact patterns
  const wavePlanPattern = /^wave-(\d+)-PLAN\.md$/;
  const waveCompletePattern = /^WAVE-(\d+)-COMPLETE\.md$/;
  const waveHandoffPattern = /^WAVE-(\d+)-HANDOFF\.md$/;

  // Set-level artifacts (wave 0)
  const setLevelArtifacts = ['CONTRACT.json', 'CONTEXT.md', 'SET-OVERVIEW.md', 'DEFINITION.md'];

  // Review artifacts (wave 999)
  const reviewArtifacts = ['REVIEW-SCOPE.md', 'REVIEW-UNIT.md', 'REVIEW-BUGS.md', 'REVIEW-UAT.md'];

  for (const entry of entries) {
    const fullPath = path.join(setDir, entry);

    // Skip digest files -- they are siblings, not primary artifacts
    if (entry.endsWith(DIGEST_SUFFIX)) {
      continue;
    }

    // Wave plan: wave-N-PLAN.md
    let match = entry.match(wavePlanPattern);
    if (match) {
      addArtifact(parseInt(match[1], 10), 'PLAN', fullPath);
      continue;
    }

    // Wave complete: WAVE-N-COMPLETE.md
    match = entry.match(waveCompletePattern);
    if (match) {
      addArtifact(parseInt(match[1], 10), 'COMPLETE', fullPath);
      continue;
    }

    // Wave handoff: WAVE-N-HANDOFF.md
    match = entry.match(waveHandoffPattern);
    if (match) {
      addArtifact(parseInt(match[1], 10), 'HANDOFF', fullPath);
      continue;
    }

    // Set-level artifacts
    if (setLevelArtifacts.includes(entry)) {
      addArtifact(0, entry, fullPath);
      continue;
    }

    // Review artifacts
    if (reviewArtifacts.includes(entry)) {
      addArtifact(999, entry, fullPath);
      continue;
    }
  }

  // Sort by wave number and return
  const waves = [];
  const sortedKeys = [...waveMap.keys()].sort((a, b) => a - b);
  for (const waveNum of sortedKeys) {
    waves.push({ wave: waveNum, artifacts: waveMap.get(waveNum) });
  }

  return waves;
}

// ---------------------------------------------------------------------------
// registerDefaultHooks(cwd)
// Register the default compaction lifecycle hooks.
// Called once during RAPID initialization.
//
// Hooks:
// - 'wave-complete': Validates that plan digests exist for completed waves.
//   Logs a warning if digest is missing (does not block execution).
// - 'pause': No-op placeholder for future pause-time compaction.
// - 'review-stage-complete': No-op placeholder for future review compaction.
// ---------------------------------------------------------------------------
function registerDefaultHooks(cwd) {
  // wave-complete: check for missing plan digests (advisory only)
  registerCompactionTrigger('wave-complete', async function onWaveComplete(context) {
    // context: { setId, waveNum, setDir }
    const planFile = path.join(context.setDir, `wave-${context.waveNum}-PLAN.md`);
    const digestFile = resolveDigestPath(planFile);
    if (fs.existsSync(planFile) && !fs.existsSync(digestFile)) {
      // Log warning -- the execute-set skill should have created this
      console.error(`[COMPACTION WARN] Missing plan digest: ${digestFile}`);
    }
  });

  // pause: placeholder for future pause-time compaction
  registerCompactionTrigger('pause', async function onPause(/* context */) {
    // No-op placeholder
  });

  // review-stage-complete: placeholder for future review compaction
  registerCompactionTrigger('review-stage-complete', async function onReviewStageComplete(/* context */) {
    // No-op placeholder
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  compactContext,
  registerCompactionTrigger,
  fireCompactionTrigger,
  clearHooks,
  getRegisteredHooks,
  registerDefaultHooks,
  resolveDigestPath,
  readDigestOrFull,
  isVerbatimArtifact,
  collectWaveArtifacts,
  DEFAULT_BUDGET_TOKENS,
};
