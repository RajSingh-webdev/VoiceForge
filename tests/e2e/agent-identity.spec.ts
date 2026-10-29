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
  knowledge: {
    business_name: 'Smile Dental Clinic',
    business_type: 'Dental Practice',
    services: ['Checkup', 'Cleaning'],
    prices: [{ item: 'Cleaning', price: '₹1200' }],
    opening_hours: '9am - 7pm',
    contact: '022-26401234',
    faqs: [],
    not_found: [],
  },
};

const NEGOTIATION_CONFIG = {
  name: 'Spark Digital Agency Negotiation Assistant',
  persona: 'Strategic commercial negotiation consultant for Spark Digital Agency.',
  goals: ['Qualify inbound leads', 'Discuss retainer pricing options', 'Handle objections'],
  flowSteps: [
    { title: 'Discovery', instruction: 'Identify prospective client budget and goals.' },
    { title: 'Pricing negotiation', instruction: 'Explain monthly retainers.' },
  ],
  welcomeMessage: 'Hi, I am the AI assistant for Spark Digital Agency. How can I assist your business?',
  languages: ['English'],
  voiceSuggestion: 'Authoritative commercial voice',
  guardrails: ['Do not commit below minimum contract tier'],
  tools: [],
  knowledge: {
    business_name: 'Spark Digital Agency',
    business_type: 'Digital Marketing Agency',
    services: ['SEO', 'PPC Advertising'],
    prices: [{ item: 'Growth Package', price: '$2500/mo' }],
    opening_hours: '9am - 6pm EST',
    contact: 'hello@sparkdigital.example',
    faqs: [],
    not_found: [],
  },
};

test.describe('Agent Identity & Multi-Assistant Separation', () => {
  test('Deploy page isolates Smile Dental and Spark Digital identities', async ({ page }) => {
    // 1. Seed Smile Dental as deployed
    await page.goto('/deploy');
    await page.evaluate(
      ({ dental, dentalDep }) => {
        window.localStorage.setItem('voiceforge:agent', JSON.stringify(dental));
        window.localStorage.setItem('voiceforge:deployment', JSON.stringify(dentalDep));
        window.localStorage.setItem(
          'voiceforge:deployments_map',
          JSON.stringify({
            smiledentalclinicassistant: dentalDep,
          })
        );
      },
      {
        dental: DENTAL_CONFIG,
        dentalDep: {
          agentId: 'agent_dental_unique_456',
          name: 'Smile Dental Clinic Assistant',
          createdAt: new Date().toISOString(),
          isSample: false,
        },
      }
    );
    await page.reload();

    // 2. Verify Smile Dental on /deploy
    await expect(page.locator('text=Your AI assistant is ready!')).toBeVisible();
    await expect(page.locator('text=Smile Dental Clinic Assistant').first()).toBeVisible();

    // Verify Advanced details shows Smile Dental's agent ID
    const detailsSummary = page.locator('summary:has-text("Advanced details")').first();
    await expect(detailsSummary).toBeVisible();
    await detailsSummary.click();
    await expect(page.locator('text=agent_dental_unique_456').first()).toBeVisible();

    // 3. Switch active draft in localStorage to Spark Digital
    await page.evaluate((spark) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(spark));
      window.dispatchEvent(new Event('voiceforge:agent:updated'));
    }, NEGOTIATION_CONFIG);

    // 4. Reload or navigate to /deploy
    await page.goto('/deploy');

    // Spark Digital has NOT been deployed yet.
    // It must NOT show Smile Dental's agent ID (agent_dental_unique_456)
    await expect(page.locator('text=agent_dental_unique_456')).toHaveCount(0);
    await expect(page.locator('text=Spark Digital Agency Negotiation Assistant').first()).toBeVisible();

    // It should display the creation prompt / action
    await expect(
      page.getByRole('button', { name: /create (my |another )?assistant/i })
    ).toBeVisible();

    // 5. Switch back to Smile Dental in localStorage
    await page.evaluate((dental) => {
      window.localStorage.setItem('voiceforge:agent', JSON.stringify(dental));
      window.dispatchEvent(new Event('voiceforge:agent:updated'));
    }, DENTAL_CONFIG);

    await page.goto('/deploy');
    // Smile Dental's deployment is immediately recognized again
    await expect(page.locator('text=Your AI assistant is ready!')).toBeVisible();
    await page.locator('summary:has-text("Advanced details")').first().click();
    await expect(page.locator('text=agent_dental_unique_456').first()).toBeVisible();
  });

  test('Refine sync status does not allow updating Smile Dental with Spark Digital changes', async ({
    page,
  }) => {
    // Setup Smile Dental deployed, but draft is Spark Digital
    await page.goto('/refine');
    await page.evaluate(
      ({ spark, dentalDep }) => {
        window.localStorage.setItem('voiceforge:agent', JSON.stringify(spark));
        window.localStorage.setItem('voiceforge:deployment', JSON.stringify(dentalDep));
      },
      {
        spark: NEGOTIATION_CONFIG,
        dentalDep: {
          agentId: 'agent_dental_unique_456',
          name: 'Smile Dental Clinic Assistant',
          createdAt: new Date().toISOString(),
          isSample: false,
        },
      }
    );
    await page.reload();

    // Because Spark Digital is not deployed, it should not render sync controls for Smile Dental's ID
    await expect(page.locator('text=agent_dental_unique_456')).not.toBeVisible();
  });

  test('API rejects overwriting an existing agent with a mismatched configuration', async ({
    request,
  }) => {
    // Attempting to update an agent with a completely different assistant name
    // (In mock mode or real mode, getAgent or existing store returns name)
    const res = await request.post('/api/agents/update', {
      data: {
        agentId: 'agent_sample_dental_123',
        config: NEGOTIATION_CONFIG,
      },
    });

    // If agent is not found or names mismatch, API must return an error (400 or 404), never 200 overwrite
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
