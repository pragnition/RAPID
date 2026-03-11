'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('quick task operations', () => {
  let tmpDir;
  let planningDir;
  let statePath;

  const baseState = {
    version: 1,
    projectName: 'TestProject',
    currentMilestone: 'ms-1',
    milestones: [],
    lastUpdatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quick-test-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    statePath = path.join(planningDir, 'STATE.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getNextQuickTaskId', () => {
    it('returns 1 when no tasks exist', async () => {
      const { getNextQuickTaskId } = require('./quick.cjs');
      fs.writeFileSync(statePath, JSON.stringify(baseState));
      const id = await getNextQuickTaskId(statePath);
      assert.equal(id, 1);
    });

    it('returns N+1 when tasks exist', async () => {
      const { getNextQuickTaskId } = require('./quick.cjs');
      const stateWithTasks = {
        ...baseState,
        quickTasks: [
          { id: 1, description: 'Task one', date: '2026-03-01' },
          { id: 3, description: 'Task three', date: '2026-03-03' },
        ],
      };
      fs.writeFileSync(statePath, JSON.stringify(stateWithTasks));
      const id = await getNextQuickTaskId(statePath);
      assert.equal(id, 4);
    });

    it('returns 1 when quickTasks field is missing (backward compat)', async () => {
      const { getNextQuickTaskId } = require('./quick.cjs');
      fs.writeFileSync(statePath, JSON.stringify(baseState));
      const id = await getNextQuickTaskId(statePath);
      assert.equal(id, 1);
    });
  });

  describe('listQuickTasks', () => {
    it('returns empty array when no tasks exist', async () => {
      const { listQuickTasks } = require('./quick.cjs');
      fs.writeFileSync(statePath, JSON.stringify(baseState));
      const tasks = await listQuickTasks(statePath);
      assert.deepEqual(tasks, []);
    });

    it('returns empty array when quickTasks field is missing', async () => {
      const { listQuickTasks } = require('./quick.cjs');
      const stateNoField = { ...baseState };
      delete stateNoField.quickTasks;
      fs.writeFileSync(statePath, JSON.stringify(stateNoField));
      const tasks = await listQuickTasks(statePath);
      assert.deepEqual(tasks, []);
    });

    it('returns all tasks in order', async () => {
      const { listQuickTasks } = require('./quick.cjs');
      const stateWithTasks = {
        ...baseState,
        quickTasks: [
          { id: 1, description: 'First', date: '2026-03-01' },
          { id: 2, description: 'Second', date: '2026-03-02' },
        ],
      };
      fs.writeFileSync(statePath, JSON.stringify(stateWithTasks));
      const tasks = await listQuickTasks(statePath);
      assert.equal(tasks.length, 2);
      assert.equal(tasks[0].id, 1);
      assert.equal(tasks[0].description, 'First');
      assert.equal(tasks[1].id, 2);
      assert.equal(tasks[1].description, 'Second');
    });
  });

  describe('addQuickTask', () => {
    it('returns updated state with new task appended, auto-incrementing ID', async () => {
      const { addQuickTask } = require('./quick.cjs');
      fs.writeFileSync(statePath, JSON.stringify(baseState));
      const newTask = await addQuickTask(statePath, 'My first task');
      assert.equal(newTask.id, 1);
      assert.equal(newTask.description, 'My first task');
      assert.ok(newTask.date);

      // Verify state file was updated
      const updatedState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      assert.equal(updatedState.quickTasks.length, 1);
      assert.equal(updatedState.quickTasks[0].id, 1);
    });

    it('auto-increments ID based on existing max', async () => {
      const { addQuickTask } = require('./quick.cjs');
      const stateWithTasks = {
        ...baseState,
        quickTasks: [
          { id: 1, description: 'First', date: '2026-03-01' },
          { id: 5, description: 'Fifth', date: '2026-03-05' },
        ],
      };
      fs.writeFileSync(statePath, JSON.stringify(stateWithTasks));
      const newTask = await addQuickTask(statePath, 'Next task');
      assert.equal(newTask.id, 6);

      const updatedState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      assert.equal(updatedState.quickTasks.length, 3);
    });

    it('accepts optional commitHash and directory', async () => {
      const { addQuickTask } = require('./quick.cjs');
      fs.writeFileSync(statePath, JSON.stringify(baseState));
      const newTask = await addQuickTask(statePath, 'Committed task', 'abc123', 'my-dir');
      assert.equal(newTask.commitHash, 'abc123');
      assert.equal(newTask.directory, 'my-dir');
    });

    it('handles state without quickTasks field (backward compat)', async () => {
      const { addQuickTask } = require('./quick.cjs');
      const stateNoField = { ...baseState };
      delete stateNoField.quickTasks;
      fs.writeFileSync(statePath, JSON.stringify(stateNoField));
      const newTask = await addQuickTask(statePath, 'First ever task');
      assert.equal(newTask.id, 1);
      assert.equal(newTask.description, 'First ever task');
    });
  });
});
