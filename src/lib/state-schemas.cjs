'use strict';
const { z } = require('zod');

const SetStatus = z.enum(['pending', 'discussed', 'planned', 'executed', 'complete', 'merged']);

const WaveStatus = z.enum(['pending', 'executing', 'complete']);

const JobStatus = z.enum(['pending', 'executing', 'complete']);

const JobState = z.object({
  id: z.string(),
  status: JobStatus.default('pending'),
}).passthrough();

const WaveState = z.object({
  id: z.string(),
  status: WaveStatus.default('pending'),
  jobs: z.array(JobState).default([]),
}).passthrough();

const SetState = z.object({
  id: z.string(),
  status: SetStatus.default('pending'),
  waves: z.array(WaveState).default([]),
}).passthrough();

const MilestoneState = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(SetState).default([]),
}).passthrough();

const ProjectState = z.object({
  version: z.number().int().min(1),
  rapidVersion: z.string().optional(),
  projectName: z.string(),
  currentMilestone: z.string(),
  milestones: z.array(MilestoneState).default([]),
  lastUpdatedAt: z.string(),
  createdAt: z.string(),
}).passthrough();

module.exports = { SetStatus, SetState, MilestoneState, ProjectState, WaveStatus, WaveState, JobStatus, JobState };
