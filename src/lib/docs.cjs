'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Template definitions for documentation scaffolding.
 * Each entry: { filename, title, sections: [{ heading, placeholder }] }
 */
const DOC_TEMPLATES = {
  'setup.md': {
    filename: 'setup.md',
    title: 'Setup',
    sections: [
      { heading: 'Prerequisites', placeholder: 'System requirements and dependencies needed before installation.' },
      { heading: 'Installation', placeholder: 'Step-by-step installation instructions.' },
      { heading: 'Configuration', placeholder: 'Initial configuration steps after installation.' },
      { heading: 'Verification', placeholder: 'How to verify the installation is working correctly.' },
    ],
  },
  'planning.md': {
    filename: 'planning.md',
    title: 'Planning',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of the planning phase.' },
      { heading: 'Creating a Milestone', placeholder: 'How to create and configure milestones.' },
      { heading: 'Defining Sets', placeholder: 'How to define and organize sets within a milestone.' },
      { heading: 'Wave Planning', placeholder: 'How to break sets into executable waves.' },
    ],
  },
  'execution.md': {
    filename: 'execution.md',
    title: 'Execution',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of the execution phase.' },
      { heading: 'Running Sets', placeholder: 'How to execute sets and their waves.' },
      { heading: 'Monitoring Progress', placeholder: 'How to track execution progress and status.' },
      { heading: 'Error Handling', placeholder: 'How to handle errors during execution.' },
    ],
  },
  'agents.md': {
    filename: 'agents.md',
    title: 'Agents',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of the agent system.' },
      { heading: 'Agent Roles', placeholder: 'Description of each agent role and its responsibilities.' },
      { heading: 'Agent Communication', placeholder: 'How agents communicate and coordinate.' },
      { heading: 'Custom Agents', placeholder: 'How to create and register custom agents.' },
    ],
  },
  'configuration.md': {
    filename: 'configuration.md',
    title: 'Configuration',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of configuration options.' },
      { heading: 'Project Configuration', placeholder: 'Project-level configuration settings.' },
      { heading: 'Agent Configuration', placeholder: 'Agent-specific configuration options.' },
      { heading: 'Environment Variables', placeholder: 'Environment variables that affect behavior.' },
    ],
  },
  'merge-and-cleanup.md': {
    filename: 'merge-and-cleanup.md',
    title: 'Merge and Cleanup',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of the merge and cleanup phase.' },
      { heading: 'Merging Sets', placeholder: 'How to merge completed sets back into the main branch.' },
      { heading: 'Conflict Resolution', placeholder: 'How to resolve merge conflicts.' },
      { heading: 'Cleanup', placeholder: 'Post-merge cleanup steps.' },
    ],
  },
  'review.md': {
    filename: 'review.md',
    title: 'Review',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of the review process.' },
      { heading: 'Code Review', placeholder: 'How code review is performed on set changes.' },
      { heading: 'Scope Review', placeholder: 'How scope review validates file ownership boundaries.' },
      { heading: 'Review Commands', placeholder: 'CLI commands for the review workflow.' },
    ],
  },
  'state-machines.md': {
    filename: 'state-machines.md',
    title: 'State Machines',
    sections: [
      { heading: 'Overview', placeholder: 'High-level description of the state machine system.' },
      { heading: 'Milestone States', placeholder: 'State transitions for milestones.' },
      { heading: 'Set States', placeholder: 'State transitions for sets.' },
      { heading: 'Wave States', placeholder: 'State transitions for waves.' },
    ],
  },
  'troubleshooting.md': {
    filename: 'troubleshooting.md',
    title: 'Troubleshooting',
    sections: [
      { heading: 'Overview', placeholder: 'Common issues and their solutions.' },
      { heading: 'Installation Issues', placeholder: 'Problems encountered during installation.' },
      { heading: 'Execution Issues', placeholder: 'Problems encountered during set execution.' },
      { heading: 'Merge Issues', placeholder: 'Problems encountered during merge operations.' },
    ],
  },
};

/**
 * Scope-to-filenames mapping.
 */
const SCOPE_MAP = {
  full: [
    'setup.md', 'planning.md', 'execution.md', 'agents.md',
    'configuration.md', 'merge-and-cleanup.md', 'review.md',
    'state-machines.md', 'troubleshooting.md',
  ],
  changelog: ['CHANGELOG.md'],
  api: ['agents.md', 'configuration.md', 'state-machines.md'],
  architecture: [
    'setup.md', 'planning.md', 'execution.md',
    'merge-and-cleanup.md', 'review.md', 'troubleshooting.md',
  ],
};

/**
 * CHANGELOG.md template (separate since it is not in the 9 guide files).
 */
const CHANGELOG_TEMPLATE = {
  filename: 'CHANGELOG.md',
  title: 'Changelog',
  sections: [
    { heading: 'Unreleased', placeholder: 'Changes that have not yet been released.' },
  ],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Render a template into markdown content.
 * @param {string} title - Document title (used as # heading)
 * @param {{ heading: string, placeholder: string }[]} sections - Section definitions
 * @returns {string}
 */
function _renderTemplate(title, sections) {
  let content = `# ${title}\n`;
  for (const section of sections) {
    content += `\n## ${section.heading}\n\n${section.placeholder}\n`;
  }
  return content;
}

/**
 * Get template definition for a given filename.
 * @param {string} filename
 * @returns {{ filename: string, title: string, sections: { heading: string, placeholder: string }[] } | null}
 */
function _getTemplate(filename) {
  if (filename === 'CHANGELOG.md') {
    return CHANGELOG_TEMPLATE;
  }
  return DOC_TEMPLATES[filename] || null;
}

/**
 * Split markdown content into sections by heading boundaries.
 * @param {string} content - Markdown file content
 * @returns {{ level: number, title: string, content: string, headingLine: string }[]}
 */
function _splitBySections(content) {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections = [];
  let lastIndex = 0;
  let lastSection = null;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    // Capture content before this heading
    if (lastSection) {
      lastSection.content = content.slice(lastIndex, match.index);
      sections.push(lastSection);
    } else if (match.index > 0) {
      // Preamble content before the first heading
      sections.push({
        level: 0,
        title: '',
        content: content.slice(0, match.index),
        headingLine: '',
      });
    }

    lastSection = {
      level: match[1].length,
      title: match[2],
      content: '',
      headingLine: match[0],
    };
    lastIndex = match.index + match[0].length;
  }

  // Capture the last section's content
  if (lastSection) {
    lastSection.content = content.slice(lastIndex);
    sections.push(lastSection);
  } else if (content.length > 0) {
    // File with no headings at all
    sections.push({
      level: 0,
      title: '',
      content: content,
      headingLine: '',
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Changelog helpers
// ---------------------------------------------------------------------------

/**
 * Keyword lists for changelog entry categorization.
 * Matched case-insensitively against the entry description.
 */
const CATEGORY_KEYWORDS = {
  Added: ['add', 'create', 'build', 'implement', 'new', 'introduce'],
  Fixed: ['fix', 'repair', 'resolve', 'patch', 'correct'],
  Breaking: ['break', 'remove', 'delete', 'drop'],
};

/**
 * Extract the text block for a given milestone from ROADMAP.md content.
 * Supports both heading-based (`## Current Milestone: <id>`) and
 * details/summary-based (`<summary><id> ...`) formats.
 *
 * @param {string} content - Full ROADMAP.md content
 * @param {string} milestoneId - Milestone identifier to match
 * @returns {string} The text block for the milestone, or empty string if not found
 */
function _parseMilestoneSection(content, milestoneId) {
  const lines = content.split('\n');
  let inSection = false;
  let sectionLines = [];
  let sectionType = null; // 'heading' or 'details'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inSection) {
      // Check for heading-based milestone: ## ... milestoneId
      if (/^##\s+/.test(line) && line.includes(milestoneId)) {
        inSection = true;
        sectionType = 'heading';
        continue;
      }
      // Check for details/summary-based milestone: <summary>milestoneId ...
      if (/<summary>/.test(line) && line.includes(milestoneId)) {
        inSection = true;
        sectionType = 'details';
        continue;
      }
    } else {
      // Determine when the section ends
      if (sectionType === 'heading') {
        // Ends at the next heading of same or higher level
        if (/^##\s+/.test(line) || /^#\s+/.test(line)) {
          break;
        }
      } else if (sectionType === 'details') {
        // Ends at </details>
        if (/<\/details>/.test(line)) {
          break;
        }
      }
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n');
}

/**
 * Parse set entries from a milestone section's text.
 * Set entries match: `- [x] set-name -- description` or `- [ ] set-name -- description`
 * Handles both ASCII em-dash (`--`) and Unicode em-dash (`\u2014`).
 *
 * @param {string} sectionText - Text of the milestone section
 * @returns {{ setName: string, description: string }[]}
 */
function _parseSetEntries(sectionText) {
  const entries = [];
  const lines = sectionText.split('\n');
  // Match: - [x] or - [ ] followed by set-name, then -- or \u2014, then description
  const entryRegex = /^-\s+\[[ x]\]\s+(\S+)\s+(?:--|—)\s+(.+)$/;

  for (const line of lines) {
    const match = line.trim().match(entryRegex);
    if (match) {
      entries.push({
        setName: match[1],
        description: match[2].trim(),
      });
    }
  }

  return entries;
}

/**
 * Categorize a changelog entry description into one of:
 * 'Added', 'Fixed', 'Breaking', or 'Changed' (default).
 *
 * Keyword matching is case-insensitive.
 *
 * @param {string} description - The set description text
 * @returns {'Added' | 'Changed' | 'Fixed' | 'Breaking'}
 */
function _categorizeEntry(description) {
  const lowerDesc = description.toLowerCase();

  // Check categories in priority order: Breaking > Fixed > Added > Changed
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Changed';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scaffold documentation template files for the given scope.
 * Never overwrites existing files (idempotent).
 *
 * @param {string} cwd - Project root directory
 * @param {string} [scope] - One of 'full', 'changelog', 'api', 'architecture'. Defaults to 'full'.
 * @returns {string[]} Array of absolute paths of files that were actually created
 */
function scaffoldDocTemplates(cwd, scope) {
  const effectiveScope = scope || 'full';
  const filenames = SCOPE_MAP[effectiveScope];
  if (!filenames) {
    throw new Error(`Unknown scope: ${effectiveScope}. Valid scopes: ${Object.keys(SCOPE_MAP).join(', ')}`);
  }

  const docsDir = path.join(cwd, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });

  const created = [];

  for (const filename of filenames) {
    const filePath = path.join(docsDir, filename);

    // Idempotency guard: never overwrite existing files
    if (fs.existsSync(filePath)) {
      continue;
    }

    const template = _getTemplate(filename);
    if (!template) {
      continue;
    }

    const content = _renderTemplate(template.title, template.sections);
    fs.writeFileSync(filePath, content, 'utf-8');
    created.push(filePath);
  }

  return created;
}

/**
 * Update a specific section of an existing markdown file by heading match.
 * Only the matched section's content is replaced; all other sections are preserved exactly.
 * If the section is not found, it is appended at the end of the document.
 *
 * @param {string} docPath - Absolute path to the markdown file
 * @param {string} sectionId - Heading text to match (case-insensitive)
 * @param {string} newContent - New content for the section
 * @returns {{ updated: boolean, diff: string }}
 */
function updateDocSection(docPath, sectionId, newContent) {
  const fileContent = fs.readFileSync(docPath, 'utf-8');
  const sections = _splitBySections(fileContent);
  const normalizedId = sectionId.trim().toLowerCase();

  // Find the target section index
  let targetIdx = -1;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].title.trim().toLowerCase() === normalizedId) {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx === -1) {
    // Section not found -- append at end
    const appendText = `\n\n## ${sectionId}\n\n${newContent}\n`;
    const result = fileContent + appendText;
    fs.writeFileSync(docPath, result, 'utf-8');
    return {
      updated: true,
      diff: `--- old\n+++ new\n\n---\n${newContent}`,
    };
  }

  const target = sections[targetIdx];

  // Determine the content boundaries for this section.
  // The section's content extends from after the heading line to the start of
  // the next heading at the same or higher (lower number) level, or end of file.
  // But with _splitBySections, we already have sections split at every heading.
  // We need to find the range of sections that fall under this heading (nested subsections).

  // Find where this section's scope ends: the next heading at same or higher level
  let endIdx = targetIdx + 1;
  while (endIdx < sections.length) {
    if (sections[endIdx].level > 0 && sections[endIdx].level <= target.level) {
      break;
    }
    endIdx++;
  }

  // Build old content (everything between heading and the end boundary)
  let oldContent = target.content;
  for (let i = targetIdx + 1; i < endIdx; i++) {
    oldContent += sections[i].headingLine + sections[i].content;
  }

  // Normalize old content for comparison: strip leading/trailing whitespace
  const oldTrimmed = oldContent.trim();
  const newTrimmed = newContent.trim();

  if (oldTrimmed === newTrimmed) {
    return { updated: false, diff: '' };
  }

  // Reassemble the file with the replaced section
  let result = '';
  for (let i = 0; i < sections.length; i++) {
    if (i === targetIdx) {
      // Write heading line + new content
      result += target.headingLine + '\n\n' + newContent + '\n';
      // Skip any nested subsections that were part of this section
      i = endIdx - 1; // will be incremented by the for loop
      continue;
    }
    if (sections[i].headingLine) {
      result += sections[i].headingLine + sections[i].content;
    } else {
      result += sections[i].content;
    }
  }

  fs.writeFileSync(docPath, result, 'utf-8');

  const diff = `--- old\n+++ new\n${oldTrimmed}\n---\n${newTrimmed}`;
  return { updated: true, diff };
}

/**
 * Extract changelog entries from ROADMAP.md for a given milestone.
 * Returns structured entries categorized by keyword detection on descriptions.
 * Never fabricates entries -- every returned entry corresponds to a line in ROADMAP.md.
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Milestone identifier (e.g., 'v3.4.0')
 * @returns {{ category: 'Added'|'Changed'|'Fixed'|'Breaking', description: string, setName: string }[]}
 */
function extractChangelog(cwd, milestoneId) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  if (!fs.existsSync(roadmapPath)) {
    return [];
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const sectionText = _parseMilestoneSection(content, milestoneId);

  if (!sectionText) {
    return [];
  }

  const setEntries = _parseSetEntries(sectionText);

  return setEntries.map((entry) => ({
    category: _categorizeEntry(entry.description),
    description: entry.description,
    setName: entry.setName,
  }));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  scaffoldDocTemplates,
  updateDocSection,
  extractChangelog,
};
