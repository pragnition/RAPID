'use strict';

const { output } = require('../lib/core.cjs');
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

async function handleReview(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const review = require('../lib/review.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'scope': {
      const { flags: scopeFlags, positional: scopePos } = parseArgs(args, { branch: 'string', 'post-merge': 'boolean' });
      const setId = scopePos[0];
      if (!setId) {
        throw new CliError('Usage: rapid-tools review scope <set-id> [<wave-id>] [--branch <branch>] [--post-merge]');
      }
      const postMerge = scopeFlags['post-merge'];
      // Post-merge mode: scope from merge commit, skip worktree resolution
      if (postMerge) {
        try {
          const result = review.scopeSetPostMerge(cwd, setId);
          const allFiles = [...result.changedFiles, ...result.dependentFiles];
          const chunks = review.chunkByDirectory(allFiles);
          output(JSON.stringify({ ...result, chunks, postMerge: true }));
        } catch (err) {
          throw new CliError(err.message);
        }
        break;
      }
      // Detect mode: if positional[1] exists, it is the wave-id
      const waveId = scopePos[1] || null;
      let baseBranch = scopeFlags.branch || 'main';
      // Resolve worktree path from registry
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setId];
      const worktreePath = entry ? path.resolve(cwd, entry.path) : cwd;
      try {
        const result = review.scopeSetForReview(cwd, worktreePath, baseBranch);
        if (!waveId) {
          // Set-level mode: include chunks and wave attribution
          const allFiles = [...result.changedFiles, ...result.dependentFiles];
          const chunks = review.chunkByDirectory(allFiles);
          const waveAttribution = review.buildWaveAttribution(cwd, setId);
          output(JSON.stringify({ ...result, chunks, waveAttribution }));
        } else {
          // Wave-level mode (backward compat for lean review): no chunks/attribution
          output(JSON.stringify(result));
        }
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    case 'log-issue': {
      const setId = args[0];
      if (!setId) {
        throw new CliError('Usage: rapid-tools review log-issue <set-id> [<wave-id>] [--post-merge]  (reads JSON issue from stdin)');
      }
      const logPostMerge = args.includes('--post-merge');
      // Detect mode: if args[1] present and not a flag, it is the wave-id (lean compat)
      const waveId = (args[1] && !args[1].startsWith('--')) ? args[1] : null;
      try {
        const stdinData = fs.readFileSync(0, 'utf-8').trim();
        if (!stdinData) {
          throw new CliError('No issue data on stdin. Pipe a JSON issue object.');
        }
        const issue = JSON.parse(stdinData);
        // If wave-id provided (lean compat), add originatingWave to issue
        if (waveId) {
          issue.originatingWave = waveId;
        }
        if (logPostMerge) {
          review.logIssuePostMerge(cwd, setId, issue);
        } else {
          review.logIssue(cwd, setId, issue);
        }
        output(JSON.stringify({ logged: true, issueId: issue.id, postMerge: logPostMerge }));
      } catch (err) {
        if (err instanceof CliError) throw err;
        throw new CliError(err.message);
      }
      break;
    }

    case 'list-issues': {
      const { flags: listFlags, positional: listPos } = parseArgs(args, { status: 'string' });
      const setId = listPos[0];
      if (!setId) {
        throw new CliError('Usage: rapid-tools review list-issues <set-id> [--status <status>]');
      }
      let statusFilter = listFlags.status || null;
      try {
        let issues = review.loadSetIssues(cwd, setId);
        if (statusFilter) {
          issues = issues.filter(i => i.status === statusFilter);
        }
        output(JSON.stringify(issues));
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    case 'update-issue': {
      const setId = args[0];
      // Detect mode by arg count:
      // 4-arg: set-id wave-id issue-id status (lean compat -- wave-id accepted but ignored)
      // 3-arg: set-id issue-id status (set-level)
      let issueId, newStatus;
      if (args.length >= 4) {
        // 4-arg mode: args[1] is wave-id (ignored for path), args[2] is issue-id, args[3] is status
        issueId = args[2];
        newStatus = args[3];
      } else if (args.length >= 3) {
        // 3-arg mode: args[1] is issue-id, args[2] is status
        issueId = args[1];
        newStatus = args[2];
      } else {
        throw new CliError('Usage: rapid-tools review update-issue <set-id> [<wave-id>] <issue-id> <status>');
      }
      if (!setId || !issueId || !newStatus) {
        throw new CliError('Usage: rapid-tools review update-issue <set-id> [<wave-id>] <issue-id> <status>');
      }
      try {
        review.updateIssueStatus(cwd, setId, issueId, newStatus);
        output(JSON.stringify({ updated: true }));
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    case 'lean': {
      const setId = args[0];
      const waveId = args[1];
      if (!setId || !waveId) {
        throw new CliError('Usage: rapid-tools review lean <set-id> <wave-id>');
      }
      // Resolve worktree path from registry
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setId];
      const worktreePath = entry ? path.resolve(cwd, entry.path) : cwd;
      const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);

      const issues = [];
      let autoFixed = 0;
      const needsAttention = [];

      try {
        // Read JOB-PLAN.md files in the wave dir to find planned artifacts
        const plannedArtifacts = [];
        if (fs.existsSync(waveDir)) {
          const planFiles = fs.readdirSync(waveDir).filter(f => f.endsWith('-PLAN.md'));
          for (const planFile of planFiles) {
            const content = fs.readFileSync(path.join(waveDir, planFile), 'utf-8');
            // Extract files from "Files to Create/Modify" table
            const tableRegex = /\|\s*`?([^`\|]+?)`?\s*\|\s*(Create|Modify)\s*\|/gi;
            let match;
            while ((match = tableRegex.exec(content)) !== null) {
              const filePath = match[1].trim();
              if (filePath && filePath !== 'File' && !filePath.startsWith('---')) {
                plannedArtifacts.push({ file: filePath, jobId: planFile.replace('-PLAN.md', '') });
              }
            }
          }
        }

        // Verify each planned artifact exists in the worktree
        for (const artifact of plannedArtifacts) {
          const fullPath = path.join(worktreePath, artifact.file);
          if (!fs.existsSync(fullPath)) {
            const issueId = `lean-${waveId}-${artifact.jobId}-${path.basename(artifact.file)}`;
            const issue = {
              id: issueId,
              type: 'artifact',
              severity: 'high',
              file: artifact.file,
              description: `Missing artifact: ${artifact.file} (expected from job ${artifact.jobId})`,
              autoFixAttempted: false,
              autoFixSucceeded: false,
              source: 'lean-review',
              status: 'open',
              createdAt: new Date().toISOString(),
            };
            // Log the issue (3-param: cwd, setId, issue with originatingWave)
            issue.originatingWave = waveId;
            review.logIssue(cwd, setId, issue);
            issues.push(issue);
            needsAttention.push(issue);
          }
        }

        output(JSON.stringify({ issues, autoFixed, needsAttention }));
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    case 'summary': {
      const setId = args[0];
      if (!setId) {
        throw new CliError('Usage: rapid-tools review summary <set-id> [--post-merge]');
      }
      const summaryPostMerge = args.includes('--post-merge');
      try {
        if (summaryPostMerge) {
          const issues = review.loadPostMergeIssues(cwd, setId);
          const summaryPath = review.generatePostMergeReviewSummary(cwd, setId, issues);
          output(JSON.stringify({ written: true, path: summaryPath, issueCount: issues.length, postMerge: true }));
        } else {
          const issues = review.loadSetIssues(cwd, setId);
          const summaryContent = review.generateReviewSummary(setId, issues);
          const summaryPath = path.join(cwd, '.planning', 'waves', setId, 'REVIEW-SUMMARY.md');
          fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
          fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
          output(JSON.stringify({ written: true, path: summaryPath, issueCount: issues.length }));
        }
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    default:
      throw new CliError(`Unknown review subcommand: ${subcommand}. Use: scope, log-issue, list-issues, update-issue, lean, summary`);
  }
}

module.exports = { handleReview };
