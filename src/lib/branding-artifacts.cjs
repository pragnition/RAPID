'use strict';

const { z } = require('zod');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANIFEST_FILENAME = 'artifacts.json';
const BRANDING_DIR = path.join('.planning', 'branding');

/** Files to exclude from the "untracked" scan (infrastructure files). */
const INFRA_FILES = new Set([MANIFEST_FILENAME, '.server.pid', 'index.html']);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ArtifactEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  filename: z.string(),
  createdAt: z.string(), // ISO 8601
  description: z.string(),
});

const ManifestSchema = z.array(ArtifactEntrySchema);

// ---------------------------------------------------------------------------
// Manifest CRUD
// ---------------------------------------------------------------------------

/**
 * Returns absolute path to artifacts.json inside the branding directory.
 * Pure path computation -- no I/O.
 * @param {string} projectRoot
 * @returns {string}
 */
function getManifestPath(projectRoot) {
  return path.join(projectRoot, BRANDING_DIR, MANIFEST_FILENAME);
}

/**
 * Read and parse artifacts.json.
 * Returns [] if the file does not exist.
 * Throws on invalid content.
 * @param {string} projectRoot
 * @returns {z.infer<typeof ManifestSchema>}
 */
function loadManifest(projectRoot) {
  const manifestPath = getManifestPath(projectRoot);
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${manifestPath}: ${err.message}`);
  }

  const result = ManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid manifest at ${manifestPath}: ${result.error.message}`
    );
  }
  return result.data;
}

/**
 * Validate and write the manifest array to artifacts.json.
 * Throws if validation fails.
 * @param {string} projectRoot
 * @param {z.infer<typeof ManifestSchema>} manifest
 */
function saveManifest(projectRoot, manifest) {
  const result = ManifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new Error(`Invalid manifest data: ${result.error.message}`);
  }

  const manifestPath = getManifestPath(projectRoot);
  const dir = path.dirname(manifestPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(result.data, null, 2) + '\n');
}

/**
 * Create a new artifact entry.
 * @param {string} projectRoot
 * @param {{ type: string, filename: string, description: string }} opts
 * @returns {z.infer<typeof ArtifactEntrySchema>}
 */
function createArtifact(projectRoot, { type, filename, description }) {
  const entry = {
    id: crypto.randomUUID(),
    type,
    filename,
    createdAt: new Date().toISOString(),
    description,
  };

  const manifest = loadManifest(projectRoot);
  manifest.push(entry);
  saveManifest(projectRoot, manifest);
  return entry;
}

/**
 * List all artifact entries (alias for loadManifest).
 * @param {string} projectRoot
 * @returns {z.infer<typeof ManifestSchema>}
 */
function listArtifacts(projectRoot) {
  return loadManifest(projectRoot);
}

/**
 * Get a single artifact entry by id.
 * @param {string} projectRoot
 * @param {string} id
 * @returns {z.infer<typeof ArtifactEntrySchema>|null}
 */
function getArtifact(projectRoot, id) {
  const manifest = loadManifest(projectRoot);
  return manifest.find((e) => e.id === id) || null;
}

/**
 * Delete an artifact entry by id.
 * Removes the manifest entry and the physical file if it exists.
 * @param {string} projectRoot
 * @param {string} id
 * @returns {{ deleted: boolean, entry?: z.infer<typeof ArtifactEntrySchema> }}
 */
function deleteArtifact(projectRoot, id) {
  const manifest = loadManifest(projectRoot);
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx === -1) return { deleted: false };

  const [entry] = manifest.splice(idx, 1);
  saveManifest(projectRoot, manifest);

  // Attempt to delete physical file
  try {
    fs.unlinkSync(path.join(projectRoot, BRANDING_DIR, entry.filename));
  } catch {
    // File may not exist on disk -- that is fine
  }

  return { deleted: true, entry };
}

/**
 * Update an existing artifact entry by id (partial update).
 * Only 'type', 'filename', and 'description' are patchable.
 * @param {string} projectRoot
 * @param {string} id
 * @param {{ type?: string, filename?: string, description?: string }} updates
 * @returns {{ updated: boolean, entry?: z.infer<typeof ArtifactEntrySchema> }}
 */
function updateArtifact(projectRoot, id, updates) {
  const manifest = loadManifest(projectRoot);
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx === -1) return { updated: false };

  const patchable = ['type', 'filename', 'description'];
  for (const key of patchable) {
    if (updates[key] !== undefined) {
      manifest[idx][key] = updates[key];
    }
  }

  saveManifest(projectRoot, manifest);
  return { updated: true, entry: manifest[idx] };
}

/**
 * Return filenames present on disk but NOT tracked in the manifest.
 * Excludes infrastructure files (artifacts.json, .server.pid, index.html).
 * @param {string} projectRoot
 * @returns {string[]}
 */
function listUntrackedFiles(projectRoot) {
  const brandingDir = path.join(projectRoot, BRANDING_DIR);
  let entries;
  try {
    entries = fs.readdirSync(brandingDir);
  } catch {
    return [];
  }

  // Keep only files (not directories)
  const files = entries.filter((e) => {
    try {
      return fs.statSync(path.join(brandingDir, e)).isFile();
    } catch {
      return false;
    }
  });

  const manifest = loadManifest(projectRoot);
  const trackedFilenames = new Set(manifest.map((e) => e.filename));

  return files.filter((f) => !trackedFilenames.has(f) && !INFRA_FILES.has(f));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  MANIFEST_FILENAME,
  ArtifactEntrySchema,
  ManifestSchema,
  getManifestPath,
  loadManifest,
  saveManifest,
  createArtifact,
  listArtifacts,
  getArtifact,
  updateArtifact,
  deleteArtifact,
  listUntrackedFiles,
};
