'use strict';
const { z } = require('zod');

const SetStatus = z.enum(['pending', 'discussed', 'planned', 'executed', 'complete', 'merged']);

const SetState = z.object({
  id: z.string(),
  status: SetStatus.default('pending'),
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

module.exports = { SetStatus, SetState, MilestoneState, ProjectState };
