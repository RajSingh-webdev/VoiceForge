import { AgentConfig, ProposedTool } from './types';

/**
 * Checks if a proposed tool is for static knowledge, course catalog, or fee structure lookup.
 * Course and fee information must be handled by the Knowledge Base (documents or facts),
 * NOT as separate connected tools unless real API integrations exist.
 */
export function isKnowledgeLookupTool(name: string, purpose: string): boolean {
  const text = `${name || ''} ${purpose || ''}`.toLowerCase();
  return (
    text.includes('course catalog') ||
    text.includes('fee structure') ||
    text.includes('course lookup') ||
    text.includes('fee database') ||
    text.includes('pricing database') ||
    text.includes('catalog lookup') ||
    text.includes('menu lookup') ||
    text.includes('faq lookup') ||
    text.includes('knowledge lookup') ||
    text.includes('syllabus') ||
    text.includes('curriculum lookup')
  );
}

/**
 * Checks if a tool is for human transfer or escalation.
 * Human hand-off must be distinguished as a behavioural instruction in flowSteps and guardrails,
 * NEVER claimed as a connected telephone-transfer integration unless a real telephony PBX exists.
 */
export function isHumanTransferTool(name: string, purpose: string): boolean {
  const text = `${name || ''} ${purpose || ''}`.toLowerCase();
  return (
    text.includes('human transfer') ||
    text.includes('human hand-off') ||
    text.includes('human handoff') ||
    text.includes('transfer router') ||
    text.includes('transfer to human') ||
    text.includes('call routing') ||
    text.includes('escalat') ||
    text.includes('call to person') ||
    text.includes('transfer call') ||
    text.includes('human escalation')
  );
}

/**
 * Checks if a tool is for appointment booking / scheduling.
 */
export function isAppointmentBookingTool(name: string, purpose: string): boolean {
  const text = `${name || ''} ${purpose || ''}`.toLowerCase();
  return (
    text.includes('appointment') ||
    text.includes('booking') ||
    text.includes('scheduler') ||
    text.includes('reservation') ||
    text.includes('slot availability')
  );
}

/**
 * Accurately determines the connection status of the appointment booking webhook tool.
 * If running on localhost or APP_BASE_URL is not HTTPS, ElevenLabs cannot call the webhook,
 * so it must accurately show as not connected.
 */
export function getBookingToolStatus(currentOrigin?: string, customWebhookUrl?: string): {
  isConnected: boolean;
  status: string;
  reason: string;
} {
  if (customWebhookUrl && customWebhookUrl.trim().startsWith('https://')) {
    return {
      isConnected: true,
      status: `Connected — Live Zapier / CRM Webhook (${customWebhookUrl.trim()})`,
      reason: 'Public HTTPS webhook configured. ElevenLabs and VoiceForge will deliver bookings directly to your CRM, Zapier, or Google Calendar.',
    };
  }

  // Check server environment variables if available
  const serverBaseUrl = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  ).replace(/\/$/, '');

  const effectiveUrl = serverBaseUrl || currentOrigin || '';

  if (!effectiveUrl) {
    return {
      isConnected: false,
      status: 'Not connected — requires public HTTPS webhook URL',
      reason: 'No webhook URL is configured. ElevenLabs requires a public HTTPS domain to trigger webhook tools.',
    };
  }

  const isLocal =
    effectiveUrl.includes('localhost') ||
    effectiveUrl.includes('127.0.0.1') ||
    effectiveUrl.startsWith('http://');

  if (isLocal) {
    return {
      isConnected: false,
      status: 'Not connected — requires public HTTPS webhook URL (currently on localhost)',
      reason: 'ElevenLabs servers cannot reach localhost webhooks. The booking webhook will connect once deployed to a public HTTPS domain.',
    };
  }

  if (effectiveUrl.startsWith('https://')) {
    return {
      isConnected: true,
      status: 'Connected — Inbound Booking Webhook',
      reason: `Webhook active at ${effectiveUrl}/api/webhooks/booking`,
    };
  }

  return {
    isConnected: false,
    status: 'Not connected — requires HTTPS endpoint',
    reason: 'Webhook endpoint must use HTTPS to connect with ElevenLabs.',
  };
}

export function isBookingToolConnected(currentOrigin?: string): boolean {
  return getBookingToolStatus(currentOrigin).isConnected;
}

/**
 * Normalizes an agent configuration's tools and behavioural instructions:
 * 1. Course & fee information: Handled via Knowledge Base, filtered from separate tool list.
 * 2. Human hand-off: Handled as behavioural escalation in flowSteps/guardrails, filtered from external tools.
 * 3. Appointment booking: Accurately reflects webhook connection status (not connected if on localhost).
 */
export function normalizeAgentTools(config: AgentConfig, currentOrigin?: string): AgentConfig {
  if (!config) return config;

  const currentTools = Array.isArray(config.tools) ? config.tools : [];
  let hasCourseOrFeeTool = false;
  let hasHumanTransferTool = false;

  const normalizedTools: ProposedTool[] = [];

  for (const tool of currentTools) {
    const name = tool.name || '';
    const purpose = tool.purpose || '';

    // 1. Course & Fee Information -> belongs to Knowledge Base
    if (isKnowledgeLookupTool(name, purpose)) {
      hasCourseOrFeeTool = true;
      continue;
    }

    // 2. Transfer Call to Person (Human Escalation) -> Active Tool that calls to a person
    if (isHumanTransferTool(name, purpose)) {
      normalizedTools.push({
        name: 'Transfer Call to Person',
        purpose: 'Transfers active call directly to a live human staff member when requested or in case of emergency.',
        status: 'Active — Live Call Transfer to Person',
      });
      hasHumanTransferTool = true;
      continue;
    }

    // 3. Appointment booking webhook
    if (isAppointmentBookingTool(name, purpose)) {
      const bookingStatus = getBookingToolStatus(currentOrigin, config.bookingWebhookUrl);
      normalizedTools.push({
        name: 'Appointment Booking Webhook',
        purpose: 'Record and confirm appointment or reservation bookings via inbound webhook.',
        status: bookingStatus.status,
      });
      continue;
    }

    // Keep other generic custom tools with accurate status
    normalizedTools.push({
      ...tool,
      status: tool.status || 'Proposed — integration not connected',
    });
  }

  // Always ensure Transfer Call to Person tool is included as a fixed core capability
  const alreadyHasEscalationTool = normalizedTools.some((t) => isHumanTransferTool(t.name, t.purpose));
  if (!alreadyHasEscalationTool) {
    normalizedTools.unshift({
      name: 'Transfer Call to Person',
      purpose: 'Transfers active call directly to a live human staff member when requested or in case of emergency.',
      status: 'Active — Live Call Transfer to Person',
    });
  }

  // Always ensure Appointment Booking Webhook is included as a fixed core capability
  const alreadyHasBookingTool = normalizedTools.some((t) => isAppointmentBookingTool(t.name, t.purpose));
  if (!alreadyHasBookingTool) {
    const bookingStatus = getBookingToolStatus(currentOrigin, config.bookingWebhookUrl);
    normalizedTools.push({
      name: 'Appointment Booking Webhook',
      purpose: 'Record and confirm appointment or reservation bookings via inbound webhook.',
      status: bookingStatus.status,
    });
  }

  // Ensure human escalation behavioural instruction is preserved in guardrails
  const updatedGuardrails = [...(config.guardrails || [])];
  if (hasHumanTransferTool) {
    const hasEscalationGuardrail = updatedGuardrails.some((g) =>
      g.toLowerCase().includes('escalat') || g.toLowerCase().includes('human')
    );
    if (!hasEscalationGuardrail) {
      updatedGuardrails.push(
        'Politely escalate to human team members verbally if caller requests a person or reports an emergency (prompt escalation; no active telecom transfer connected).'
      );
    }
  }

  // Ensure course & fee knowledge guidance is captured in guardrails if previously proposed
  if (hasCourseOrFeeTool) {
    const hasCourseGuardrail = updatedGuardrails.some((g) =>
      g.toLowerCase().includes('course') || g.toLowerCase().includes('fee')
    );
    if (!hasCourseGuardrail) {
      updatedGuardrails.push(
        'Answer course, curriculum, and fee structure inquiries strictly from uploaded knowledge documents or verified facts. Do not invent unverified fees.'
      );
    }
  }

  return {
    ...config,
    tools: normalizedTools,
    guardrails: updatedGuardrails,
  };
}
