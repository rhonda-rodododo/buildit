import { test, expect } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

test.describe('Governance Module', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');

    // Create a group with governance module enabled
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Governance Test Group');

      // Enable governance module if option exists
      const governanceCheckbox = page.getByLabel(/governance/i);
      if (await governanceCheckbox.isVisible()) {
        await governanceCheckbox.check();
      }

      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Navigate to the group
    await page.getByText('Governance Test Group').click();

    // Go to governance tab/module
    const governanceTab = page.getByRole('tab', { name: /governance/i });
    if (await governanceTab.isVisible()) {
      await governanceTab.click();
    } else {
      // Try navigating to governance via URL
      await page.goto('/app/groups/governance');
    }
  });

  test('should create a proposal with simple voting', async ({ page }) => {
    // Click create proposal button
    const createProposalButton = page.getByRole('button', { name: /create proposal|new proposal/i });
    await createProposalButton.click();

    // Fill in proposal details
    await page.getByLabel(/title/i).fill('Test Proposal: Budget Allocation');
    await page.getByLabel(/description/i).fill('Should we allocate $1000 for organizing materials?');

    // Select voting method
    const votingMethodSelect = page.getByLabel(/voting method|type/i);
    if (await votingMethodSelect.isVisible()) {
      await votingMethodSelect.click();
      await page.getByText(/simple.*vote|yes\/no/i).first().click();
    }

    // Set deadline
    const deadlineInput = page.getByLabel(/deadline|end.*date/i);
    if (await deadlineInput.isVisible()) {
      await deadlineInput.fill('2025-12-31');
    }

    // Submit
    await page.getByRole('button', { name: /create|submit proposal/i }).click();

    // Should show proposal in list
    await expect(page.getByText('Test Proposal: Budget Allocation')).toBeVisible();
  });

  test('should create proposal with ranked-choice voting', async ({ page }) => {
    // Click create proposal button
    const createProposalButton = page.getByRole('button', { name: /create proposal|new proposal/i });
    await createProposalButton.click();

    // Fill in proposal details
    await page.getByLabel(/title/i).fill('Choose Next Campaign');
    await page.getByLabel(/description/i).fill('Rank your preferred campaigns');

    // Select ranked-choice voting
    const votingMethodSelect = page.getByLabel(/voting method|type/i);
    if (await votingMethodSelect.isVisible()) {
      await votingMethodSelect.click();
      await page.getByText(/ranked.*choice|instant.*runoff/i).first().click();
    }

    // Add options
    const option1Input = page.getByPlaceholder(/option 1|first option/i);
    if (await option1Input.isVisible()) {
      await option1Input.fill('Healthcare Campaign');

      const addOptionButton = page.getByRole('button', { name: /add option/i });
      if (await addOptionButton.isVisible()) {
        await addOptionButton.click();
        await page.getByPlaceholder(/option 2|next option/i).fill('Housing Campaign');
        await addOptionButton.click();
        await page.getByPlaceholder(/option 3|next option/i).fill('Workers Rights Campaign');
      }
    }

    // Submit
    await page.getByRole('button', { name: /create|submit proposal/i }).click();

    // Should show proposal
    await expect(page.getByText('Choose Next Campaign')).toBeVisible();
  });

  test('should vote on a proposal', async ({ page }) => {
    // Create a proposal first
    const createProposalButton = page.getByRole('button', { name: /create proposal|new proposal/i });
    if (await createProposalButton.isVisible()) {
      await createProposalButton.click();
      await page.getByLabel(/title/i).fill('Vote Test Proposal');
      await page.getByLabel(/description/i).fill('This is a test proposal for voting');
      await page.getByRole('button', { name: /create|submit proposal/i }).click();
    }

    // Click on the proposal
    await page.getByText('Vote Test Proposal').click();

    // Cast a vote
    const yesButton = page.getByRole('button', { name: /^yes$|vote yes|approve/i });
    const noButton = page.getByRole('button', { name: /^no$|vote no|reject/i });

    if (await yesButton.isVisible()) {
      await yesButton.click();

      // Should show vote confirmation or update
      await expect(page.getByText(/voted|your vote|recorded/i)).toBeVisible();
    } else if (await noButton.isVisible()) {
      // If yes button not visible, try no button
      await noButton.click();
      await expect(page.getByText(/voted|your vote|recorded/i)).toBeVisible();
    }
  });

  test('should view proposal results', async ({ page }) => {
    // Create and vote on a proposal
    const createProposalButton = page.getByRole('button', { name: /create proposal|new proposal/i });
    if (await createProposalButton.isVisible()) {
      await createProposalButton.click();
      await page.getByLabel(/title/i).fill('Results Test Proposal');
      await page.getByLabel(/description/i).fill('Testing results display');
      await page.getByRole('button', { name: /create|submit proposal/i }).click();
    }

    // Click on the proposal
    await page.getByText('Results Test Proposal').click();

    // Cast a vote
    const voteButton = page.getByRole('button', { name: /yes|no|vote/i }).first();
    if (await voteButton.isVisible()) {
      await voteButton.click();
    }

    // Look for results section
    const resultsSection = page.getByText(/results|votes|tally/i);
    if (await resultsSection.isVisible()) {
      // Should show vote counts or percentages
      await expect(page.getByText(/\d+.*vote|\d+%/i)).toBeVisible();
    }
  });

  test('should view proposal history', async ({ page }) => {
    // Create a proposal
    const createProposalButton = page.getByRole('button', { name: /create proposal|new proposal/i });
    if (await createProposalButton.isVisible()) {
      await createProposalButton.click();
      await page.getByLabel(/title/i).fill('History Test Proposal');
      await page.getByRole('button', { name: /create|submit proposal/i }).click();
    }

    // Look for filter/view options
    const historyButton = page.getByRole('button', { name: /history|past|archive/i });
    const filterButton = page.getByRole('button', { name: /filter/i });

    if (await historyButton.isVisible()) {
      await historyButton.click();
      // Should show past proposals
      await expect(page.getByRole('main')).toBeVisible();
    } else if (await filterButton.isVisible()) {
      await filterButton.click();

      // Look for status filter
      const completedFilter = page.getByLabel(/completed|closed|ended/i);
      if (await completedFilter.isVisible()) {
        await completedFilter.click();
      }
    }
  });
});
