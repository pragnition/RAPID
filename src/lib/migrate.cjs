'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Recursively copy a directory and all its contents.
 *
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Scan a file's content for specific patterns.
 *
 * @param {string} filePath - Path to the file
 * @param {RegExp[]} patterns - Array of regex patterns to test
 * @returns {boolean[]} Array of booleans indicating which patterns matched
 */
function scanFilePatterns(filePath, patterns) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return patterns.map(p => p.test(content));
  } catch {
    return patterns.map(() => false);
  }
}

/**
 * Detect the planning framework used in a project.
 * Scans for GSD, openspec, and generic planning patterns.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{type: string, confidence: string, artifacts: string[], details: Object}>}
 */
async function detectFramework(projectRoot) {
  const planningDir = path.join(projectRoot, '.planning');

  // Check if .planning/ exists at all
  if (!fs.existsSync(planningDir) || !fs.statSync(planningDir).isDirectory()) {
    return {
      type: 'none',
      confidence: 'high',
      artifacts: [],
      details: { reason: 'No .planning/ directory found' },
    };
  }

  const artifacts = [];
  const details = { indicators: [] };

  // Collect all files in .planning/
  const stateMdPath = path.join(planningDir, 'STATE.md');
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const phasesDir = path.join(planningDir, 'phases');
  const specPath = path.join(planningDir, 'SPEC.md');

  const hasStateMd = fs.existsSync(stateMdPath);
  const hasRoadmap = fs.existsSync(roadmapPath);
  const hasPhases = fs.existsSync(phasesDir) && fs.statSync(phasesDir).isDirectory();
  const hasSpec = fs.existsSync(specPath);

  if (hasStateMd) artifacts.push('STATE.md');
  if (hasRoadmap) artifacts.push('ROADMAP.md');
  if (hasSpec) artifacts.push('SPEC.md');

  // Check for GSD-specific patterns
  let isGsd = false;
  if (hasStateMd) {
    const [hasGsdVersion, hasGsdRef] = scanFilePatterns(stateMdPath, [
      /gsd_state_version/,
      /get.shit.done|gsd/i,
    ]);
    if (hasGsdVersion) {
      isGsd = true;
      details.indicators.push('gsd_state_version found in STATE.md');
    }
    if (hasGsdRef) {
      details.indicators.push('GSD reference found in STATE.md');
    }
  }

  if (hasPhases) {
    // Look for PLAN.md files in phases/ (GSD pattern)
    try {
      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      for (const entry of phaseEntries) {
        if (entry.isDirectory()) {
          const phaseFiles = fs.readdirSync(path.join(phasesDir, entry.name));
          const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md'));
          if (planFiles.length > 0) {
            isGsd = true;
            artifacts.push(`phases/${entry.name}`);
            details.indicators.push(`Phase directory with PLAN.md files: ${entry.name}`);
          }
        }
      }
    } catch {
      // Ignore read errors on phases directory
    }
  }

  if (isGsd) {
    return {
      type: 'gsd',
      confidence: 'high',
      artifacts,
      details,
    };
  }

  // Check for openspec patterns
  if (hasSpec) {
    const [hasOpenspecVersion] = scanFilePatterns(specPath, [/openspec/i]);
    if (hasOpenspecVersion) {
      details.indicators.push('OpenSpec patterns found in SPEC.md');
      return {
        type: 'openspec',
        confidence: 'high',
        artifacts,
        details,
      };
    }
  }

  // Generic planning structure
  if (hasStateMd || hasRoadmap) {
    details.indicators.push('Generic planning files found (STATE.md and/or ROADMAP.md)');
    return {
      type: 'generic',
      confidence: 'medium',
      artifacts,
      details,
    };
  }

  // Has .planning/ dir but nothing recognizable inside
  return {
    type: 'none',
    confidence: 'high',
    artifacts: [],
    details: { reason: '.planning/ directory exists but contains no recognized patterns' },
  };
}

/**
 * Create a backup of the .planning/ directory.
 * Copies .planning/ to .planning.bak/ using recursive copy.
 * Throws if backup already exists (prevents accidental overwrite).
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<void>}
 * @throws {Error} If .planning.bak/ already exists or .planning/ doesn't exist
 */
async function backupPlanning(projectRoot) {
  const planningDir = path.join(projectRoot, '.planning');
  const backupDir = path.join(projectRoot, '.planning.bak');

  if (!fs.existsSync(planningDir) || !fs.statSync(planningDir).isDirectory()) {
    throw new Error(`Cannot backup: .planning/ directory does not exist at ${projectRoot}`);
  }

  if (fs.existsSync(backupDir)) {
    throw new Error(
      `Backup already exists at .planning.bak/ in ${projectRoot}. ` +
      'Remove it manually before creating a new backup.'
    );
  }

  copyDirRecursive(planningDir, backupDir);
}

/**
 * Transform a detected planning framework to RAPID conventions.
 * Based on detected framework type, restructures files accordingly.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {{type: string, confidence: string, artifacts: string[], details: Object}} detectionResult
 * @returns {Promise<{transformed: string[], skipped: string[], errors: string[]}>}
 */
async function transformToRapid(projectRoot, detectionResult) {
  const planningDir = path.join(projectRoot, '.planning');
  const transformed = [];
  const skipped = [];
  const errors = [];

  if (detectionResult.type === 'none') {
    return { transformed, skipped, errors };
  }

  if (detectionResult.type === 'gsd') {
    // GSD-to-RAPID: rename state version references
    const stateMdPath = path.join(planningDir, 'STATE.md');
    if (fs.existsSync(stateMdPath)) {
      try {
        let content = fs.readFileSync(stateMdPath, 'utf-8');
        if (content.includes('gsd_state_version')) {
          content = content.replace(/gsd_state_version/g, 'rapid_state_version');
          fs.writeFileSync(stateMdPath, content, 'utf-8');
          transformed.push('STATE.md: renamed gsd_state_version to rapid_state_version');
        } else {
          skipped.push('STATE.md: no gsd_state_version found');
        }
      } catch (err) {
        errors.push(`STATE.md: ${err.message}`);
      }
    } else {
      errors.push('STATE.md: file not found');
    }

    // Process other GSD artifacts
    for (const artifact of detectionResult.artifacts) {
      if (artifact === 'STATE.md') continue; // Already handled
      if (artifact.startsWith('phases/')) {
        // Phase directories are kept as-is for now; RAPID uses the same structure
        skipped.push(`${artifact}: phase directory retained (compatible with RAPID)`);
      }
    }

    return { transformed, skipped, errors };
  }

  if (detectionResult.type === 'openspec') {
    // OpenSpec-to-RAPID: create RAPID-compatible structure
    // Retain existing files, add RAPID-specific directories
    const phasesDir = path.join(planningDir, 'phases');
    if (!fs.existsSync(phasesDir)) {
      fs.mkdirSync(phasesDir, { recursive: true });
      transformed.push('phases/: created RAPID phases directory');
    }

    for (const artifact of detectionResult.artifacts) {
      skipped.push(`${artifact}: retained from openspec structure`);
    }

    return { transformed, skipped, errors };
  }

  if (detectionResult.type === 'generic') {
    // Generic-to-RAPID: create RAPID-compatible directory structure
    const phasesDir = path.join(planningDir, 'phases');
    if (!fs.existsSync(phasesDir)) {
      fs.mkdirSync(phasesDir, { recursive: true });
      transformed.push('phases/: created RAPID phases directory');
    }

    const contextDir = path.join(planningDir, 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
      transformed.push('context/: created RAPID context directory');
    }

    for (const artifact of detectionResult.artifacts) {
      skipped.push(`${artifact}: retained from generic structure`);
    }

    return { transformed, skipped, errors };
  }

  return { transformed, skipped, errors };
}

module.exports = {
  detectFramework,
  backupPlanning,
  transformToRapid,
};
