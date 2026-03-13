'use strict';
const { z } = require('zod');

const SetStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'complete', 'merged']);

const WaveStatus = z.enum(['pending', 'executing', 'complete']);

const JobStatus = z.enum(['pending', 'executing', 'complete']);

const JobState = z.object({
  id: z.string(),
  status: JobStatus.default('pending'),
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

module.exports = { SetStatus, SetState, MilestoneState, ProjectState, WaveStatus, WaveState, JobStatus, JobState };
