import { test, expect } from '@playwright/test';
import { normalizeAgentTools, getBookingToolStatus } from '@/lib/tools';
import { AgentConfig } from '@/lib/types';

test.describe('Write Page Tool Mapping & New Assistant Reset', () => {
  const sampleConfigWithProposedTools: AgentConfig = {
    name: 'Apex Institute Admissions Assistant',
    persona: 'Helpful and professional academic counselor',
    goals: [
      'Provide admissions counseling and course details',
      'Explain semester tuition fees and payment options',
    ],
    flowSteps: [
      { title: 'Greeting', instruction: 'Introduce as AI admissions counselor for Apex Institute.' },
      { title: 'Counseling', instruction: 'Answer applicant questions and explain course offerings.' },
    ],
    welcomeMessage: 'Hello! I am the AI admissions assistant for Apex Institute. How can I help you today?',
    welcomeMessageHindi: 'नमस्ते! मैं एपेक्स इंस्टीट्यूट का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
    languages: ['English', 'Hindi'],
    voiceSuggestion: 'Warm and articulate tone',
    guardrails: [
      'Disclose AI identity at the start of call',
      'Never invent unaccredited courses or unapproved discounts',
    ],
    tools: [
      {
        name: 'Course Catalog Lookup',
        purpose: 'Query course catalog database for syllabus details',
        status: 'Proposed — integration not connected',
      },
      {
        name: 'Fee Structure Database',
        purpose: 'Lookup tuition fees and semester costs',
        status: 'Proposed — integration not connected',
      },
      {
        name: 'Appointment Scheduler',
        purpose: 'Schedule campus tour visits',
        status: 'Proposed — integration not connected',
      },
      {
        name: 'Human Transfer Router',
        purpose: 'Transfer caller to dean or admissions officer',
        status: 'Proposed — integration not connected',
      },
    ],
  };

  test('normalizeAgentTools strips catalog/fee lookup tools and human transfer router, and normalizes appointment booking', () => {
    const normalized = normalizeAgentTools(sampleConfigWithProposedTools, 'http://localhost:3000');

    // 1. Course and fee tools should NOT exist as separate tools
    const catalogTool = normalized.tools.find((t) => t.name.includes('Course Catalog'));
    const feeTool = normalized.tools.find((t) => t.name.includes('Fee Structure'));
    expect(catalogTool).toBeUndefined();
    expect(feeTool).toBeUndefined();

    // 2. Legacy Human Transfer Router should be normalized to Transfer Call to Person (Human Escalation)
    const legacyRouter = normalized.tools.find((t) => t.name === 'Human Transfer Router');
    expect(legacyRouter).toBeUndefined();

    const escalationTool = normalized.tools.find(
      (t) => t.name.includes('Transfer Call to Person') || t.name.includes('Human Escalation')
    );
    expect(escalationTool).toBeDefined();
    expect(escalationTool?.status).toContain('Active');

    // 3. Human escalation should be present in guardrails as a behavioural instruction
    const hasEscalationGuardrail = normalized.guardrails.some(
      (g) => g.toLowerCase().includes('escalat') || g.toLowerCase().includes('human') || g.toLowerCase().includes('transfer')
    );
    expect(hasEscalationGuardrail).toBe(true);

    // 4. Appointment scheduler should be normalized to Appointment Booking Webhook
    const bookingTool = normalized.tools.find((t) => t.name.includes('Appointment Booking Webhook'));
    expect(bookingTool).toBeDefined();

    // 5. On localhost, status must accurately reflect that booking is not connected
    expect(bookingTool?.status).toContain('Not connected');
    expect(bookingTool?.status).toContain('localhost');
  });

  test('getBookingToolStatus correctly distinguishes localhost from public HTTPS domains', () => {
    const localStatus = getBookingToolStatus('http://localhost:3000');
    expect(localStatus.isConnected).toBe(false);
    expect(localStatus.status).toContain('Not connected');

    const httpsStatus = getBookingToolStatus('https://voiceforge.example.com');
    expect(httpsStatus.isConnected).toBe(true);
    expect(httpsStatus.status).toContain('Connected');
  });

  test('Write page loads normalized tools, displays working Human Escalation tool, removes tags, and clears on Create New Assistant', async ({ page }) => {
    // Seed draft in localStorage with the 4 proposed tools
    await page.goto('/write');
    await page.evaluate((cfg) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(cfg));
    }, sampleConfigWithProposedTools);

    await page.reload();

    // Verify Assistant Setup Summary is visible
    const setupHeading = page.locator('#draft-config-heading');
    await expect(setupHeading).toBeVisible();

    // Verify tags are REMOVED as requested by user
    await expect(page.locator('text=Draft configuration saved')).toHaveCount(0);
    await expect(page.locator('text=Changes auto-save locally')).toHaveCount(0);

    // Verify "Create New Assistant" button is displayed
    const createNewBtn = page.locator('button:has-text("Create New Assistant")');
    await expect(createNewBtn).toBeVisible();

    // Verify Tools & Integrations section
    const toolsSection = page.locator('text=Tools & Integrations');
    await expect(toolsSection).toBeVisible();

    // Course Catalog Lookup and Fee Structure Database should NOT appear in tool list
    await expect(page.locator('input[value="Course Catalog Lookup"]')).toHaveCount(0);
    await expect(page.locator('input[value="Fee Structure Database"]')).toHaveCount(0);
    await expect(page.locator('input[value="Human Transfer Router"]')).toHaveCount(0);

    // Transfer Call to Person (Human Escalation) should appear as working tool with phone input and Call button
    const escalationInput = page.locator('input[value="Transfer Call to Person"]');
    await expect(escalationInput).toBeVisible();
    await expect(page.locator('text=Active — Live Call Transfer')).toBeVisible();

    const staffPhoneInput = page.locator('#staff-transfer-phone');
    await expect(staffPhoneInput).toBeVisible();

    const testTransferBtn = page.locator('button:has-text("Call to Person")');
    await expect(testTransferBtn).toBeVisible();
    await testTransferBtn.click();
    await expect(page.locator('text=Call transferred to staff')).toBeVisible();

    // Appointment Booking Webhook should appear with Test Booking button
    const bookingInput = page.locator('input[value="Appointment Booking Webhook"]');
    await expect(bookingInput).toBeVisible();
    const testBookingBtn = page.locator('button:has-text("Test Booking")');
    await expect(testBookingBtn).toBeVisible();
    await testBookingBtn.click();
    await expect(page.locator('text=Booking confirmed')).toBeVisible();

    // Test "Create New Assistant" button
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('create a new assistant');
      await dialog.accept();
    });

    await createNewBtn.click();

    // Draft should be cleared
    await expect(setupHeading).not.toBeVisible();
    const stored = await page.evaluate(() => window.localStorage.getItem('voiceforge:agent'));
    expect(stored).toBeNull();
  });
});
