import { z } from 'zod';

export const formAssistSchema = z
  .object({
    taskType: z.literal('form_assist'),
    suggestedDescription: z.string().min(1).nullable(),
    missingFields: z.array(z.string()),
    explanation: z.string().min(1),
    evidenceRefs: z.array(z.string()),
    requiresUserConfirmation: z.literal(true),
  })
  .strict();

export const reviewBriefSchema = z
  .object({
    taskType: z.literal('review_brief'),
    caseSummary: z.string().min(1),
    passedRules: z.array(
      z.object({
        ruleId: z.string(),
        evidenceRefs: z.array(z.string()),
      }).strict(),
    ),
    failedRules: z.array(
      z.object({
        ruleId: z.string(),
        evidenceRefs: z.array(z.string()),
      }).strict(),
    ),
    missingInformation: z.array(z.string()),
    humanJudgementItems: z.array(z.string()),
    requiresHumanReview: z.literal(true),
  })
  .strict();

export const returnMessageSchema = z
  .object({
    taskType: z.literal('return_message_draft'),
    message: z.string().min(1),
    requiredActions: z.array(z.string()),
    evidenceRefs: z.array(z.string()),
    requiresHumanConfirmation: z.literal(true),
  })
  .strict();

export type FormAssistOutput = z.infer<typeof formAssistSchema>;
export type ReviewBriefOutput = z.infer<typeof reviewBriefSchema>;
export type ReturnMessageOutput = z.infer<typeof returnMessageSchema>;

