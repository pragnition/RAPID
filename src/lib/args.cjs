'use strict';

/**
 * Lightweight argument parser for RAPID CLI commands.
 *
 * Replaces scattered `args.indexOf('--flag')` patterns with a declarative
 * schema-based approach. Designed to be a drop-in replacement that preserves
 * existing behavior (no defaults, no throws on missing values).
 *
 * @module args
 */

/**
 * Parse command-line arguments against a schema.
 *
 * @param {string[]} args - Array of argument tokens (e.g., ['--branch', 'main', '--force'])
 * @param {Object<string, 'string'|'boolean'|string>} schema - Map of flag names to types:
 *   - 'string'   -- consumes the next token as the value
 *   - 'boolean'  -- presence means true, absence means false (no value consumed)
 *   - 'multi:N'  -- consumes the next N tokens as an array
 * @returns {{ flags: Object, positional: string[] }}
 *   - flags: parsed flag values (string flags default to undefined, booleans to false)
 *   - positional: remaining args not consumed by any flag
 */
function parseArgs(args, schema) {
  const flags = {};
  const positional = [];

  // Initialize defaults from schema
  for (const [name, type] of Object.entries(schema)) {
    if (type === 'boolean') {
      flags[name] = false;
    } else {
      flags[name] = undefined;
    }
  }

  let i = 0;
  while (i < args.length) {
    const token = args[i];

    // Check for --flag=value syntax
    if (token.startsWith('--') && token.includes('=')) {
      const eqIdx = token.indexOf('=');
      const name = token.slice(2, eqIdx);
      const value = token.slice(eqIdx + 1);

      if (name in schema) {
        const type = schema[name];
        if (type === 'boolean') {
          // --force=true or --force=false
          flags[name] = value !== 'false';
        } else if (type === 'string') {
          flags[name] = value;
        } else if (type.startsWith('multi:')) {
          // For --flag=value with multi, treat the value as the first element
          // and consume remaining from subsequent tokens
          const count = parseInt(type.split(':')[1], 10);
          const values = [value];
          for (let j = 1; j < count && (i + j) < args.length; j++) {
            values.push(args[i + j]);
          }
          flags[name] = values;
          i += count - 1;
        }
      } else {
        // Unknown --flag=value goes to positional as a single token
        positional.push(token);
      }
      i++;
      continue;
    }

    // Check for --flag syntax (no =)
    if (token.startsWith('--')) {
      const name = token.slice(2);

      if (name in schema) {
        const type = schema[name];
        if (type === 'boolean') {
          flags[name] = true;
          i++;
          continue;
        } else if (type === 'string') {
          // Consume next token as value; undefined if no next token
          flags[name] = (i + 1 < args.length) ? args[i + 1] : undefined;
          // Only advance past the value if there was one
          if (i + 1 < args.length) {
            i += 2;
          } else {
            i++;
          }
          continue;
        } else if (type.startsWith('multi:')) {
          const count = parseInt(type.split(':')[1], 10);
          const values = [];
          for (let j = 1; j <= count && (i + j) < args.length; j++) {
            values.push(args[i + j]);
          }
          flags[name] = values.length > 0 ? values : undefined;
          i += 1 + values.length;
          continue;
        }
      } else {
        // Unknown flag: push the --flag token itself to positional
        positional.push(token);
        i++;
        continue;
      }
    }

    // Not a flag: positional argument
    positional.push(token);
    i++;
  }

  return { flags, positional };
}

module.exports = { parseArgs };
