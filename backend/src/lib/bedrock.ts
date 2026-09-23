import { BedrockRuntimeClient, ConverseCommand, type Message } from '@aws-sdk/client-bedrock-runtime';
import type { RawRepairEstimate } from '../types/domain';

const client = new BedrockRuntimeClient({});

const TOOL_NAME = 'provide_repair_estimate';

const ESTIMATE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    estimatedHours: { type: 'number', description: 'Estimated labor hours, e.g. 1.5' },
    partsCostLow: { type: 'number', description: 'Low end of estimated parts cost in USD' },
    partsCostHigh: { type: 'number', description: 'High end of estimated parts cost in USD' },
    explanation: {
      type: 'string',
      description:
        '2-4 sentence explanation of how you arrived at the labor hours and parts cost range, referencing the vehicle and repair specifics.',
    },
  },
  required: ['estimatedHours', 'partsCostLow', 'partsCostHigh', 'explanation'],
};

const ESTIMATE_TOOL = {
  toolSpec: {
    name: TOOL_NAME,
    description: 'Provide a structured cost and time estimate for an auto repair job.',
    inputSchema: { json: ESTIMATE_JSON_SCHEMA },
  },
};

export interface EstimateInput {
  year: number;
  make: string;
  model: string;
  repairLabel: string;
  baselineHours: number;
  freeformDescription?: string;
  shopRatePerHour: number;
}

/**
 * Bedrock model id is fully swappable via the BEDROCK_MODEL_ID env var (see the
 * BedrockModelId parameter in template.yaml / .env). Not every model on Bedrock supports
 * Converse tool-use, so this tries structured tool-use first and falls back to asking the
 * model for raw JSON in its reply if the model/provider doesn't support tools at all.
 *
 * Returns hours/parts only (no dollar totals) — cost math happens separately in
 * estimate-math.ts so it always uses the current shop rate, whether the raw numbers came
 * from Bedrock just now or were read back out of the quote cache later.
 */
export async function getAiRepairEstimate(input: EstimateInput): Promise<RawRepairEstimate> {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) throw new Error('Missing BEDROCK_MODEL_ID env var');

  const vehicleDesc = `${input.year} ${input.make} ${input.model}`;
  const repairDesc = input.freeformDescription
    ? `Customer's own description of the requested work: "${input.freeformDescription}"`
    : `Requested repair: ${input.repairLabel} (typical shop baseline: ${input.baselineHours} labor hours)`;

  const basePrompt =
    'You are a service advisor assistant for Save My Ride, an auto repair shop in Willoughby, Ohio. ' +
    `The shop labor rate is $${input.shopRatePerHour}/hour. Given a vehicle and a requested repair, estimate ` +
    'realistic labor hours and a typical parts cost range for that specific vehicle, considering its age, make, and model. ' +
    'Be conservative and realistic — do not lowball.';

  const userPrompt = `Vehicle: ${vehicleDesc}\n${repairDesc}\n\nEstimate the labor hours and parts cost range for this job.`;

  const messages: Message[] = [{ role: 'user', content: [{ text: userPrompt }] }];

  return getEstimateViaToolUse(modelId, basePrompt, messages).catch(() =>
    getEstimateViaJsonPrompt(modelId, basePrompt, messages)
  );
}

/** Preferred path: Converse tool-use, for models/providers that support it (e.g. Claude on Bedrock). */
async function getEstimateViaToolUse(
  modelId: string,
  basePrompt: string,
  messages: Message[]
): Promise<RawRepairEstimate> {
  const response = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: `${basePrompt} Respond by calling the provide_repair_estimate tool.` }],
      messages,
      toolConfig: { tools: [ESTIMATE_TOOL] },
      inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
    })
  );

  const content = response.output?.message?.content ?? [];
  const toolUse = content.find((block) => 'toolUse' in block)?.toolUse;

  if (!toolUse || toolUse.name !== TOOL_NAME) {
    throw new Error('Model did not return a tool-use response');
  }

  return validateRawEstimate(toolUse.input);
}

/** Fallback path for models/providers that don't support Converse tool-use at all. */
async function getEstimateViaJsonPrompt(
  modelId: string,
  basePrompt: string,
  messages: Message[]
): Promise<RawRepairEstimate> {
  const response = await client.send(
    new ConverseCommand({
      modelId,
      system: [
        {
          text:
            `${basePrompt} Respond with ONLY a single JSON object (no markdown, no code fences, no extra text) ` +
            `matching this exact shape: ${JSON.stringify(ESTIMATE_JSON_SCHEMA.properties)}.`,
        },
      ],
      messages,
      inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
    })
  );

  const text = (response.output?.message?.content ?? [])
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Model response did not contain a JSON object: ${text.slice(0, 200)}`);
  }

  return validateRawEstimate(JSON.parse(jsonMatch[0]));
}

function validateRawEstimate(value: unknown): RawRepairEstimate {
  const v = value as Partial<RawRepairEstimate> | null;
  if (
    !v ||
    typeof v.estimatedHours !== 'number' ||
    typeof v.partsCostLow !== 'number' ||
    typeof v.partsCostHigh !== 'number' ||
    typeof v.explanation !== 'string'
  ) {
    throw new Error(`Model returned an incomplete estimate: ${JSON.stringify(value)}`);
  }
  return v as RawRepairEstimate;
}
