'use strict';

const { z } = require('zod');

// --- Status enums ---

const JobStatus = z.enum(['pending', 'executing', 'complete', 'failed']);

const WaveStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'reconciling', 'complete']);

const SetStatus = z.enum(['pending', 'planning', 'executing', 'reviewing', 'merging', 'complete']);

// --- State schemas (bottom-up) ---

const JobState = z.object({
  id: z.string(),
  status: JobStatus.default('pending'),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  commitSha: z.string().optional(),
  artifacts: z.array(z.string()).default([]),
});

const WaveState = z.object({
  id: z.string(),
  status: WaveStatus.default('pending'),
  jobs: z.array(JobState).default([]),
});

const SetState = z.object({
  id: z.string(),
  status: SetStatus.default('pending'),
  waves: z.array(WaveState).default([]),
});

const MilestoneState = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(SetState).default([]),
});

const ProjectState = z.object({
  version: z.literal(1),
  projectName: z.string(),
  currentMilestone: z.string(),
  milestones: z.array(MilestoneState).default([]),
  lastUpdatedAt: z.string(),
  createdAt: z.string(),
});

module.exports = {
  JobStatus,
  JobState,
  WaveStatus,
  WaveState,
  SetStatus,
  SetState,
  MilestoneState,
  ProjectState,
};
