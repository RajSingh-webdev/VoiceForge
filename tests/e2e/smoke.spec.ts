import { test, expect } from '@playwright/test';

const MOCK_AGENT_CONFIG = {
  name: 'Smile Dental Assistant',
  persona: 'Friendly dental receptionist for Smile Dental in Bandra West, Mumbai.',
  goals: [
    'Greet callers warmly and identify their needs',
    'Assist with appointment requests and scheduling',
    'Answer pricing inquiries for dental treatments',
    'Escalate emergency dental pain or urgent queries to human staff',
  ],
  flowSteps: [
    {
      title: 'Greeting and AI disclosure',
      instruction: 'Warmly greet caller, state you are an AI assistant for Smile Dental, and ask how to help.',
    },
    {
      title: 'Determine inquiry type',
      instruction: 'Check if caller needs appointment, pricing, or emergency care.',
    },
    {
      title: 'Appointment Booking',
      instruction: 'Collect preferred date, time, and patient name.',
    },
    {
      title: 'Wrap up and confirmation',
      instruction: 'Confirm details and thank the patient.',
    },
  ],
  welcomeMessage: 'Hello, I am the AI assistant for Smile Dental clinic. How can I help you today?',
  languages: ['English', 'Hindi'],
  voiceSuggestion: 'Friendly, warm professional Indian English accent.',
  guardrails: [
    'Always disclose that you are an AI assistant',
    'Never provide medical diagnosis or prescribe medications',
    'Direct severe pain or emergency bleeding immediately to clinic emergency line',
  ],
  tools: [
    {
      name: 'Appointment Booking System',
      purpose: 'Check dental slot availability and book visits',
      status: 'Proposed — integration not connected',
    },
  ],
  knowledge: {
    business_name: 'Smile Dental',
    business_type: 'Dental Clinic',
    services: ['Dental Cleaning', 'Root Canal', 'Teeth Whitening'],
    prices: [
      { item: 'Consultation', price: '₹500' },
      { item: 'Dental Cleaning', price: '₹1500' },
    ],
    opening_hours: 'Monday to Saturday, 9am to 7pm',
    contact: '+91 22 2640 1234',
    faqs: [
      { question: 'What are clinic timings?', answer: 'Monday to Saturday, 9am to 7pm.' },
    ],
    not_found: [],
  },
};

function setupMockRoutes(page: any) {
  // Mock /api/agents/generate
  page.route('**/api/agents/generate', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ config: MOCK_AGENT_CONFIG }),
    });
  });

  // Mock /api/agents/refine
  page.route('**/api/agents/refine', async (route: any) => {
    const postData = JSON.parse(route.request().postData() || '{}');
    const reqText = (postData.request || '').toLowerCase();

    if (reqText.includes('disclosure') || reqText.includes('remove')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          changes: {
            welcomeMessage: 'Hello! I am a receptionist at Smile Dental clinic. How can I assist you?',
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          changes: {
            welcomeMessage: 'Hi! I am the AI assistant at Smile Dental. How may I help you today?',
          },
        }),
      });
    }
  });

  // Mock /api/calls/analyze (wrapped in analysis object)
  page.route('**/api/calls/analyze', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        analysis: {
          issue_found: true,
          unanswered_question: 'Caller asked if parking is available at the clinic, but the assistant did not know.',
          evidence: {
            turn: 4,
            quote: 'I am not certain about parking facilities at our Bandra clinic.',
          },
          fix_type: 'knowledge',
          suggested_title: 'Clinic Parking Information',
          suggested_text: 'Parking availability and instructions for visitors.',
          needs_owner_input: true,
          owner_question: 'Does Smile Dental provide parking for patients, and where is it located?',
        },
      }),
    });
  });

  // Mock /api/agents/create
  page.route('**/api/agents/create', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agentId: 'agent_sample_dental_123',
        createdAt: new Date().toISOString(),
        isSample: true,
        name: 'Smile Dental Assistant',
      }),
    });
  });

  // Mock /api/voice/session
  page.route('**/api/voice/session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        signedUrl: 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=mock_agent',
        isSample: true,
      }),
    });
  });

  // Mock /api/agents/hindi-welcome
  page.route('**/api/agents/hindi-welcome', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        welcomeMessageHindi: 'नमस्ते! मैं Smile Dental का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
      }),
    });
  });
}

test.describe('Group A - Smoke Tests (No AI Quota)', () => {
  // a. Every page loads with no console errors, shows the stepper, and shows "No agent yet" where an agent is needed
  test('a. Every page loads without console errors, shows stepper, and displays "No agent yet" when needed', async ({ page }) => {
    await setupMockRoutes(page);

    const pagesToTest = [
      { path: '/write', expectNoAgent: false },
      { path: '/test', expectNoAgent: true },
      { path: '/refine', expectNoAgent: true },
      { path: '/deploy', expectNoAgent: true },
      { path: '/observe', expectNoAgent: true },
      { path: '/agent/wrong-id', expectNoAgent: false, isPublicNotFound: true },
    ];

    for (const item of pagesToTest) {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      await page.goto(item.path);
      await page.waitForLoadState('domcontentloaded');

      // Verify Stepper is present on every page
      const stepper = page.locator('nav');
      await expect(stepper).toBeVisible();
      await expect(stepper).toContainText('Write');
      await expect(stepper).toContainText('Test');
      await expect(stepper).toContainText('Refine');
      await expect(stepper).toContainText('Deploy');
      await expect(stepper).toContainText('Observe');

      // Verify "No agent yet" when required
      if (item.expectNoAgent) {
        await expect(page.locator('text=No agent yet')).toBeVisible();
      }

      // Verify /agent/wrong-id displays not found message
      if (item.isPublicNotFound) {
        await expect(page.locator('text=/not found/i')).toBeVisible();
      }

      // Filter out benign browser/network errors if any, ensure no runtime JS exceptions
      expect(pageErrors, `Page errors on ${item.path}`).toEqual([]);
      expect(consoleErrors, `Console errors on ${item.path}`).toEqual([]);
    }
  });

  // b. /write: the 5 starter chips fill the box, the character counter and limit work, generate shows loading then a draft,
  // the welcome message shows the AI disclosure badge, and deleting "AI" from the welcome message shows the warning.
  test('b. /write: starter chips, counter/limit, draft generation, AI disclosure badge and warning', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/write');

    const textarea = page.locator('#agent-description-input');
    const counter = page.locator('#char-counter');

    // 1. Verify 5 starter chips fill the description box
    const chipTitles = ['Lead Generation', 'Appointments', 'Support', 'Negotiation', 'Collections'];
    for (const title of chipTitles) {
      const chip = page.locator(`button:has-text("${title}")`).first();
      await expect(chip).toBeVisible();
      await chip.click();
      const val = await textarea.inputValue();
      expect(val.length).toBeGreaterThan(20);
    }

    // 2. Character counter and limit
    await textarea.fill('Short test description.');
    await expect(counter).toContainText(`${'Short test description.'.length} / 1200 characters`);

    // Exceed limit (1201 characters)
    const longText = 'a'.repeat(1205);
    await textarea.fill(longText);
    await expect(counter).toContainText('1205 / 1200 characters');
    await expect(page.locator('text=Description exceeds maximum limit')).toBeVisible();

    const generateBtn = page.locator('button:has-text("Generate my AI assistant")');
    await expect(generateBtn).toBeDisabled();

    // 3. Valid generation
    await textarea.fill('Create a friendly dental clinic receptionist for Smile Dental in Mumbai.');
    await expect(generateBtn).toBeEnabled();

    await generateBtn.click();

    // Wait for draft configuration panel to appear
    const configPanel = page.locator('#generated-configuration-panel');
    await expect(configPanel).toBeVisible();
    await expect(page.locator('text=Draft configuration saved')).toBeVisible();

    // 4. Welcome message shows AI disclosure badge
    const welcomeInput = page.locator('#config-welcome-message');
    await expect(welcomeInput).toHaveValue(MOCK_AGENT_CONFIG.welcomeMessage);
    await expect(page.locator('text=Clearly discloses AI identity')).toBeVisible();

    // 5. Deleting "AI" from welcome message shows warning
    await welcomeInput.fill('Hello, welcome to Smile Dental clinic. How can I help you today?');
    await expect(page.locator('text=Must state the assistant is an AI')).toBeVisible();
  });

  // c. /write: add a flow step, delete a flow step, drag/move a flow step up or down, reload the page and verify the edits stayed.
  test('c. /write: add, delete, and reorder flow steps with persistence after reload', async ({ page }) => {
    await setupMockRoutes(page);

    await page.goto('/write');
    // Seed agent in localStorage once
    await page.evaluate((mockConfig) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(mockConfig));
    }, MOCK_AGENT_CONFIG);
    await page.reload();

    await expect(page.locator('#generated-configuration-panel')).toBeVisible();

    // Initial count of steps is 4
    const initialSteps = page.locator('input[aria-label$="Title"]');
    await expect(initialSteps).toHaveCount(4);

    // 1. Add a flow step
    const addStepBtn = page.locator('button:has-text("+ Add Step")');
    await addStepBtn.click();
    await expect(initialSteps).toHaveCount(5);

    // Edit the 5th step title
    const step5Input = page.locator('input[aria-label="Step 5 Title"]');
    await step5Input.fill('Emergency Escalation');

    // 2. Move step up (Step 5 up -> becomes Step 4)
    const moveStep5UpBtn = page.locator('button[aria-label="Move Step 5 up"]');
    await moveStep5UpBtn.click();
    const step4Input = page.locator('input[aria-label="Step 4 Title"]');
    await expect(step4Input).toHaveValue('Emergency Escalation');

    // 3. Move step down (Step 4 down -> becomes Step 5)
    const moveStep4DownBtn = page.locator('button[aria-label="Move Step 4 down"]');
    await moveStep4DownBtn.click();
    await expect(page.locator('input[aria-label="Step 5 Title"]')).toHaveValue('Emergency Escalation');

    // 4. Delete step 5
    const removeStep5Btn = page.locator('button[aria-label="Remove Step 5"]');
    await removeStep5Btn.click();
    await expect(initialSteps).toHaveCount(4);

    // Edit Step 1 Title
    const step1Input = page.locator('input[aria-label="Step 1 Title"]');
    await step1Input.fill('Custom Opening Greeting');

    // 5. Reload the page and verify persistence
    await page.reload();
    await expect(page.locator('#generated-configuration-panel')).toBeVisible();
    await expect(page.locator('input[aria-label="Step 1 Title"]')).toHaveValue('Custom Opening Greeting');
    await expect(page.locator('input[aria-label$="Title"]')).toHaveCount(4);
  });

  // d. /refine: typing a change and clicking "Propose" shows the before/after diff with only the changed fields,
  // Apply updates the saved agent, a change that tries to remove the AI disclosure leaves the disclosure in place, and Undo restores previous state.
  test('d. /refine: propose diff, apply update, enforce AI disclosure preservation, and undo', async ({ page }) => {
    await setupMockRoutes(page);

    await page.goto('/refine');
    await page.evaluate((mockConfig) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(mockConfig));
      window.localStorage.removeItem('voiceforge:refine_history');
    }, MOCK_AGENT_CONFIG);
    await page.reload();

    await expect(page.locator('text=Smile Dental Assistant')).toBeVisible();

    const changeInput = page.locator('textarea[placeholder*="Make the welcome message shorter"]');
    const submitBtn = page.locator('button[type="submit"]');

    // 1. Type a change and click propose/review
    await changeInput.fill('Make the welcome message shorter and warmer');
    await submitBtn.click();

    // 2. Verify Proposed Changes panel shows before/after diff
    const proposedPanel = page.locator('#proposed-change-panel');
    await expect(proposedPanel).toBeVisible();
    await expect(proposedPanel).toContainText('Before (Current)');
    await expect(proposedPanel).toContainText('After (Proposed)');
    await expect(proposedPanel).toContainText('Hi! I am the AI assistant at Smile Dental.');

    // 3. Click Apply and verify agent updated
    const applyBtn = page.locator('button:has-text("Apply Changes")').first();
    await applyBtn.click();
    await expect(proposedPanel).not.toBeVisible();

    // Verify localStorage has updated welcomeMessage
    const updatedWelcome = await page.evaluate(() => {
      const stored = window.localStorage.getItem('voiceforge:agent');
      return stored ? JSON.parse(stored).welcomeMessage : null;
    });
    expect(updatedWelcome).toContain('Hi! I am the AI assistant at Smile Dental.');

    // Verify change recorded in history (scoped to Change History section)
    await expect(
      page.locator('section:has-text("Change History")').getByText('Make the welcome message shorter and warmer')
    ).toBeVisible();

    // 4. Propose a change that tries to remove AI disclosure
    await changeInput.fill('Remove the AI disclosure from greeting');
    await submitBtn.click();
    await expect(proposedPanel).toBeVisible();

    // Click Apply
    await page.locator('button:has-text("Apply Changes")').first().click();

    // Verify the resulting welcome message STILL discloses it is an AI
    const enforcedWelcome = await page.evaluate(() => {
      const stored = window.localStorage.getItem('voiceforge:agent');
      return stored ? JSON.parse(stored).welcomeMessage : '';
    });
    const lower = enforcedWelcome.toLowerCase();
    const hasDisclosure =
      /\bai\b/.test(lower) ||
      lower.includes('artificial intelligence') ||
      lower.includes('virtual assistant') ||
      lower.includes('automated assistant') ||
      lower.includes('digital assistant') ||
      /\bbot\b/.test(lower);
    expect(hasDisclosure).toBe(true);

    // 5. Undo restores the previous state
    const undoBtn = page.locator('button:has-text("Undo last change")');
    await undoBtn.click();

    const undoneWelcome = await page.evaluate(() => {
      const stored = window.localStorage.getItem('voiceforge:agent');
      return stored ? JSON.parse(stored).welcomeMessage : '';
    });
    expect(undoneWelcome).toBe('Hi! I am the AI assistant at Smile Dental. How may I help you today?');
  });

  // e. /observe: the metric cards match the call list numbers exactly, switching between tabs filters correctly,
  // and clicking the flagged call shows its transcript.
  test('e. /observe: metric cards match call records, filter tabs work, and flagged call shows transcript', async ({ page }) => {
    await setupMockRoutes(page);

    await page.goto('/observe');
    await page.evaluate((mockConfig) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(mockConfig));
    }, MOCK_AGENT_CONFIG);
    await page.reload();

    // 1. Metric cards check
    const totalCallsCard = page.locator('section[aria-label="Call Metrics"] div:has-text("Total Calls")');
    await expect(totalCallsCard).toContainText('8');

    const avgDurationCard = page.locator('section[aria-label="Call Metrics"] div:has-text("Avg Duration")');
    await expect(avgDurationCard).toContainText('2m 9s');

    const bookedCard = page.locator('section[aria-label="Call Metrics"] div:has-text("Booked")');
    await expect(bookedCard).toContainText('3');

    const resolvedCard = page.locator('section[aria-label="Call Metrics"] div:has-text("Resolved")');
    await expect(resolvedCard).toContainText('2');

    const flaggedCard = page.locator('section[aria-label="Call Metrics"] div:has-text("Flagged")');
    await expect(flaggedCard).toContainText('1');

    const transferredCard = page.locator('section[aria-label="Call Metrics"] div:has-text("Transferred")');
    await expect(transferredCard).toContainText('2');

    // 2. Filter tabs check
    const callItems = page.locator('div.space-y-2\\.5 > button');
    await expect(callItems).toHaveCount(8);

    // Booked filter
    await page.getByRole('button', { name: 'Booked', exact: true }).click();
    await expect(callItems).toHaveCount(3);

    // Resolved filter
    await page.getByRole('button', { name: 'Resolved', exact: true }).click();
    await expect(callItems).toHaveCount(2);

    // Flagged filter
    await page.getByRole('button', { name: 'Flagged', exact: true }).click();
    await expect(callItems).toHaveCount(1);
    await expect(callItems.first()).toContainText('David Miller');

    // Transferred filter
    await page.getByRole('button', { name: 'Transferred to human', exact: true }).click();
    await expect(callItems).toHaveCount(2);

    // Return to All
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(callItems).toHaveCount(8);

    // 3. Clicking flagged call displays transcript
    await page.locator('button:has-text("David Miller")').first().click();
    await expect(page.locator('text=Conversation Transcript')).toBeVisible();
    await expect(page.locator('text=Do you have dedicated patient parking')).toBeVisible();
  });

  // f. /observe "Apply fix": click Analyse on the flagged call, show suggested fix with needs_owner_input true and input box,
  // type missing detail, verify Apply is disabled until typed, click Apply, verify FAQ added to agent, verify call shows "Fix applied",
  // reload, click Undo and verify FAQ removed.
  test('f. /observe "Apply fix": analyze flagged call, owner input requirement, apply FAQ fix, reload and undo', async ({ page }) => {
    await setupMockRoutes(page);

    await page.goto('/observe');
    await page.evaluate((mockConfig) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(mockConfig));
      window.localStorage.removeItem('voiceforge:fixes');
      window.localStorage.removeItem('voiceforge:fix_history');
    }, MOCK_AGENT_CONFIG);
    await page.reload();

    // 1. Select the flagged call (David Miller)
    await page.locator('button:has-text("David Miller")').first().click();

    // 2. Click "Analyse this call"
    const analyzeBtn = page.locator('button:has-text("Analyse this call")');
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();

    // 3. Issue found panel displayed with owner input required
    const issuePanel = page.locator('#issue-found-panel');
    await expect(issuePanel).toBeVisible();
    await expect(issuePanel).toContainText('Issue Found');
    await expect(issuePanel).toContainText('Does Smile Dental provide parking for patients, and where is it located?');

    // 4. Verify Apply fix button is disabled until answer typed
    const applyFixBtn = page.locator('button:has-text("Apply fix")');
    await expect(applyFixBtn).toBeDisabled();

    const ownerTextarea = issuePanel.locator('textarea');
    await ownerTextarea.fill('Free valet and basement parking is available with clinic validation.');
    await expect(applyFixBtn).toBeEnabled();

    // 5. Click Apply fix
    await applyFixBtn.click();

    // Verify "Fix applied" badge on the call
    await expect(page.locator('text=Fix applied').first()).toBeVisible();

    // Verify FAQ added to agent config in localStorage
    const savedFaqs = await page.evaluate(() => {
      const stored = window.localStorage.getItem('voiceforge:agent');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.knowledge?.faqs || [];
    });
    const parkingFaq = savedFaqs.find((f: any) => f.question.includes('Parking'));
    expect(parkingFaq).toBeTruthy();
    expect(parkingFaq.answer).toBe('Free valet and basement parking is available with clinic validation.');

    // 6. Reload page and check persistence
    await page.reload();
    await page.locator('button:has-text("David Miller")').first().click();

    // 7. Click Undo and verify FAQ removed
    const undoFixBtn = page.locator('button:has-text("Undo last fix")').first();
    await expect(undoFixBtn).toBeVisible();
    await undoFixBtn.click();

    const undoneFaqs = await page.evaluate(() => {
      const stored = window.localStorage.getItem('voiceforge:agent');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.knowledge?.faqs || [];
    });
    const remainingParkingFaq = undoneFaqs.find((f: any) => f.question.includes('Parking'));
    expect(remainingParkingFaq).toBeUndefined();
  });

  // g. /deploy: shows sample agent ID, SampleDataBadge, share link, clearly labelled sample snippet, simulated phone card;
  // navigating to /agent/[id] shows public agent page, and invalid ID shows "Agent not found".
  test('g. /deploy: sample agent ID, SampleDataBadge, snippet, simulated phone, and public agent routing', async ({ page }) => {
    await setupMockRoutes(page);

    await page.goto('/deploy');
    await page.evaluate((mockConfig) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(mockConfig));
      window.localStorage.removeItem('voiceforge:deployment');
    }, MOCK_AGENT_CONFIG);
    await page.reload();

    // Click "Create agent"
    const deployBtn = page.locator('button:has-text("Create agent")');
    await expect(deployBtn).toBeVisible();
    await deployBtn.click();

    // 1. Verify Sample Agent ID
    await expect(page.getByText('agent_sample_dental_123').first()).toBeVisible();

    // 2. Verify SampleDataBadge
    const sampleBadge = page.locator('text=Sample data').first();
    await expect(sampleBadge).toBeVisible();

    // 3. Verify share link
    const shareLink = page.locator('a[href*="/agent/agent_sample_dental_123"]');
    await expect(shareLink).toBeVisible();

    // 4. Verify clearly labelled sample snippet
    const snippetCard = page.locator('pre');
    await expect(snippetCard).toContainText('Sample snippet. The real widget code will use your ElevenLabs agent ID once connected.');

    // 5. Verify simulated phone card
    await expect(page.locator('text=Phone (simulated flow)')).toBeVisible();

    // 6. Navigate to /agent/agent_sample_dental_123 -> public agent page
    await page.goto('/agent/agent_sample_dental_123');
    await expect(page.locator('h1')).toContainText('Smile Dental Assistant');
    await expect(page.locator('text=You are talking to an AI assistant.')).toBeVisible();
    await expect(page.locator('text=English')).toBeVisible();
    await expect(page.locator('text=Hindi')).toBeVisible();

    // 7. Navigate to invalid ID -> "Agent not found"
    await page.goto('/agent/invalid-id-999');
    await expect(page.locator('text=/not found/i')).toBeVisible();
  });

  // h. Security (real server call, no AI quota): POST /api/site/extract with localhost, 127.0.0.1, 169.254.169.254, and ftp:// URLs; verify every one returns HTTP 400.
  test('h. Security: POST /api/site/extract SSRF blocks private and non-http URLs with HTTP 400', async ({ request }) => {
    const maliciousUrls = [
      'http://localhost',
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://127.0.0.1:8080',
      'http://169.254.169.254',
      'http://169.254.169.254/latest/meta-data/',
      'ftp://example.com/file.txt',
    ];

    for (const url of maliciousUrls) {
      const res = await request.post('/api/site/extract', {
        data: { url },
      });
      expect(res.status(), `URL ${url} should be rejected with 400`).toBe(400);
      const json = await res.json();
      expect(json.error).toBeTruthy();
    }
  });
});
