'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// These 5 v2 roles must be completely removed from the codebase
const REMOVED_ROLES = ['wave-researcher', 'wave-planner', 'job-planner', 'job-executor', 'wave-analyzer'];

describe('v2 role pruning', () => {
  describe('rapid-tools.cjs registry pruning', () => {
    // We test by loading the source and checking the registry maps
    const rapidToolsSrc = fs.readFileSync(
      path.join(__dirname, '..', 'bin', 'rapid-tools.cjs'), 'utf-8'
    );

    it('ROLE_TOOLS has no entries for any removed v2 role', () => {
      for (const role of REMOVED_ROLES) {
        // Check that the role key is not in ROLE_TOOLS object literal
        const pattern = new RegExp(`'${role}'\\s*:`);
        // Count occurrences before ROLE_COLORS to isolate ROLE_TOOLS section
        const roleToolsStart = rapidToolsSrc.indexOf('const ROLE_TOOLS');
        const roleColorsStart = rapidToolsSrc.indexOf('const ROLE_COLORS');
        const roleToolsSection = rapidToolsSrc.substring(roleToolsStart, roleColorsStart);
        assert.ok(
          !pattern.test(roleToolsSection),
          `ROLE_TOOLS should not contain entry for '${role}'`
        );
      }
    });

    it('ROLE_COLORS has no entries for any removed v2 role', () => {
      for (const role of REMOVED_ROLES) {
        const pattern = new RegExp(`'${role}'\\s*:`);
        const start = rapidToolsSrc.indexOf('const ROLE_COLORS');
        const end = rapidToolsSrc.indexOf('const ROLE_DESCRIPTIONS');
        const section = rapidToolsSrc.substring(start, end);
        assert.ok(
          !pattern.test(section),
          `ROLE_COLORS should not contain entry for '${role}'`
        );
      }
    });

    it('ROLE_DESCRIPTIONS has no entries for any removed v2 role', () => {
      for (const role of REMOVED_ROLES) {
        const pattern = new RegExp(`'${role}'\\s*:`);
        const start = rapidToolsSrc.indexOf('const ROLE_DESCRIPTIONS');
        const end = rapidToolsSrc.indexOf('const ROLE_CORE_MAP');
        const section = rapidToolsSrc.substring(start, end);
        assert.ok(
          !pattern.test(section),
          `ROLE_DESCRIPTIONS should not contain entry for '${role}'`
        );
      }
    });

    it('ROLE_CORE_MAP has no entries for any removed v2 role', () => {
      for (const role of REMOVED_ROLES) {
        const pattern = new RegExp(`'${role}'\\s*:`);
        const start = rapidToolsSrc.indexOf('const ROLE_CORE_MAP');
        const end = rapidToolsSrc.indexOf('function generateFrontmatter');
        const section = rapidToolsSrc.substring(start, end);
        assert.ok(
          !pattern.test(section),
          `ROLE_CORE_MAP should not contain entry for '${role}'`
        );
      }
    });
  });

  describe('tool-docs.cjs ROLE_TOOL_MAP pruning', () => {
    const { ROLE_TOOL_MAP } = require('./tool-docs.cjs');

    it('ROLE_TOOL_MAP has no entries for job-executor, wave-planner, job-planner, wave-analyzer', () => {
      const removedFromToolMap = ['job-executor', 'wave-planner', 'job-planner', 'wave-analyzer'];
      for (const role of removedFromToolMap) {
        assert.ok(
          !(role in ROLE_TOOL_MAP),
          `ROLE_TOOL_MAP should not contain entry for '${role}'`
        );
      }
    });

    it('exclusion comment does not list wave-researcher', () => {
      const src = fs.readFileSync(path.join(__dirname, 'tool-docs.cjs'), 'utf-8');
      // Find the comment section about excluded roles
      const commentMatch = src.match(/\/\/.*'wave-researcher'/);
      assert.ok(
        !commentMatch,
        `Exclusion comment should not list 'wave-researcher' (role no longer exists)`
      );
    });
  });

  describe('role module files deleted', () => {
    it('5 v2 role module files do not exist', () => {
      for (const role of REMOVED_ROLES) {
        const rolePath = path.join(__dirname, '..', 'modules', 'roles', `role-${role}.md`);
        assert.ok(
          !fs.existsSync(rolePath),
          `role-${role}.md should be deleted from src/modules/roles/`
        );
      }
    });
  });

  describe('generated agent files deleted', () => {
    it('5 v2 agent files do not exist', () => {
      for (const role of REMOVED_ROLES) {
        const agentPath = path.join(__dirname, '..', '..', 'agents', `rapid-${role}.md`);
        assert.ok(
          !fs.existsSync(agentPath),
          `rapid-${role}.md should be deleted from agents/`
        );
      }
    });
  });
});
