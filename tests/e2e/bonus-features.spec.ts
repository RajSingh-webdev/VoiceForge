import { test, expect } from '@playwright/test';

const DENTAL_CONFIG = {
  name: 'Smile Dental Clinic Assistant',
  persona: 'Friendly dental receptionist for Smile Dental in Mumbai.',
  goals: ['Greet patients', 'Schedule appointments', 'Provide pricing'],
  flowSteps: [
    { title: 'Greeting', instruction: 'Warmly greet the patient.' },
    { title: 'Booking', instruction: 'Help patient book an appointment.' },
  ],
  welcomeMessage: 'Hello, I am the AI assistant for Smile Dental. How can I help you today?',
  languages: ['English', 'Hindi'],
  voiceSuggestion: 'Warm Indian English',
  guardrails: ['Disclose AI status'],
  tools: [],
};

test.describe('Bonus Features (Simulated Testing, Voice Cloning, Bulk Campaigns)', () => {
  test('Practice Callers (Bonus #5) runs a practice conversation and reports evaluation', async ({
    page,
  }) => {
    await page.goto('/test');
    await page.evaluate((dental) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(dental));
    }, DENTAL_CONFIG);
    await page.reload();

    // Verify collapsed practice callers panel exists
    const panelSummary = page.locator('summary:has-text("Practice with sample callers")');
    await expect(panelSummary).toBeVisible();

    // Expand panel
    await panelSummary.click();

    // Verify friendly scenario chips are available
    await expect(page.locator('text=An upset customer')).toBeVisible();
    await expect(page.locator('text=An urgent medical issue')).toBeVisible();

    // Click "Run practice call"
    const runBtn = page.getByRole('button', { name: /run practice call/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Verify report appears
    await expect(page.locator('text=Practice Call Passed')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Sample Call Dialogue:')).toBeVisible();
  });

  test('Voice Cloning (Bonus #2) enforces legal consent and creates cloned voice', async ({
    request,
  }) => {
    // 1. Without consent, API must return HTTP 400
    const noConsentRes = await request.post('/api/voices/clone', {
      multipart: {
        name: 'Test Voice',
        file: {
          name: 'sample.mp3',
          mimeType: 'audio/mpeg',
          buffer: Buffer.from('fake-audio-bytes'),
        },
      },
    });
    expect(noConsentRes.status()).toBe(400);
    const noConsentBody = await noConsentRes.json();
    expect(noConsentBody.error).toContain('consent');

    // 2. With explicit consent, API creates voice
    const consentRes = await request.post('/api/voices/clone', {
      multipart: {
        name: 'Dr. Smile Brand Voice',
        consent: 'true',
        file: {
          name: 'sample.mp3',
          mimeType: 'audio/mpeg',
          buffer: Buffer.from('fake-audio-bytes'),
        },
      },
    });
    expect(consentRes.status()).toBe(200);
    const consentBody = await consentRes.json();
    expect(consentBody.success).toBe(true);
    expect(consentBody.voice.name).toContain('Dr. Smile Brand Voice');
  });

  test('Bulk Outbound Campaigns (Bonus #9) loads contacts and runs sequential campaign', async ({
    page,
    request,
  }) => {
    // 1. API test
    const apiRes = await request.post('/api/campaigns/outbound', {
      data: {
        contact: {
          id: '1',
          name: 'Rohan Sharma',
          phone: '+91 98201 12345',
          details: 'Dental Cleaning appointment',
          status: 'queued',
        },
        config: DENTAL_CONFIG,
      },
    });
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    expect(apiBody.success).toBe(true);
    expect(apiBody.outcome).toBe('Confirmed');

    // 2. UI test on /deploy
    await page.goto('/deploy');
    await page.evaluate((dental) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(dental));
      window.localStorage.setItem(
        'voiceforge:deployment',
        JSON.stringify({
          agentId: 'agent_sample_dental_123',
          name: 'Smile Dental Clinic Assistant',
          createdAt: new Date().toISOString(),
          isSample: true,
        })
      );
    }, DENTAL_CONFIG);
    await page.reload();

    const campaignSummary = page.locator('summary:has-text("Bulk Outbound Calling Campaign")');
    await expect(campaignSummary).toBeVisible();
    await campaignSummary.click();

    // Click "Load Sample Reminder List"
    const loadSampleBtn = page.getByRole('button', { name: /Load Sample Reminder List/i });
    await expect(loadSampleBtn).toBeVisible();
    await loadSampleBtn.click();

    // Verify contact table displays Rohan Sharma
    await expect(page.locator('text=Rohan Sharma')).toBeVisible();
    await expect(page.locator('text=Ananya Verma')).toBeVisible();
  });
});
