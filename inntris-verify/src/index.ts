import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadPolicyConfig } from './config';
import { analyzePullRequest } from './analyzer';
import { reportResults } from './reporter';
import { verifyWithInntris, VerifyMode } from './inntris-client';

function parseBool(input: string): boolean {
  return input.toLowerCase() === 'true';
}

async function run(): Promise<void> {
  const eventName = github.context.eventName;
  if (eventName !== 'pull_request') {
    core.setFailed(`This action only supports pull_request events. Received: ${eventName}`);
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GITHUB_TOKEN is required');
    return;
  }

  const mode = core.getInput('mode') as VerifyMode;
  const failOnBlock = parseBool(core.getInput('fail_on_block'));
  const failOnApiError = parseBool(core.getInput('fail_on_api_error'));

  const octokit = github.getOctokit(token);
  const pr = github.context.payload.pull_request;
  if (!pr) {
    core.setFailed('No pull request payload found');
    return;
  }

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: pr.number,
    per_page: 100
  });

  const config = loadPolicyConfig(core.getInput('policy_config'));
  const analysis = analyzePullRequest(files.map((f) => ({ filename: f.filename, patch: f.patch })), config);

  const verify = await verifyWithInntris(analysis, {
    apiUrl: core.getInput('inntris_api_url'),
    apiKey: core.getInput('inntris_api_key'),
    agentId: core.getInput('inntris_agent_id'),
    timeoutSeconds: Number(core.getInput('timeout_seconds') || '10'),
    mode,
    failOnApiError
  });

  await reportResults(analysis, verify, failOnBlock);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  core.setFailed(message);
});
