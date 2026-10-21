import { SYNC_TARGETS } from './admin-core.js';

/**
 * The live site's half of the admin API: Vercel's filesystem is read-only and thrown away per
 * request, so a save becomes a commit to the repository through the GitHub REST API, and the
 * Vercel build that commit triggers puts it on the site about a minute later. Syncs dispatch the
 * game's GitHub Actions sync workflow, which has no schedule of its own.
 *
 * Needs GITHUB_TOKEN: a fine-grained token for this one repository with Contents and Actions
 * read/write.
 */

const API = 'https://api.github.com';

function config() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPO must be set');
  return { token, repo, branch: process.env.GITHUB_BRANCH || 'main' };
}

async function gh(path, { method = 'GET', body, accept } = {}) {
  const { token } = config();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'my-portfolio-admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function ghJson(path, options) {
  const res = await gh(path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`GitHub ${options?.method || 'GET'} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const contentsPath = (repoPath) => {
  const { repo, branch } = config();
  return `/repos/${repo}/contents/${repoPath}?ref=${encodeURIComponent(branch)}`;
};

/** A file's text and blob sha, or null when it does not exist. */
async function readFile(repoPath) {
  const res = await gh(contentsPath(repoPath));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read of ${repoPath} failed (${res.status})`);
  const meta = await res.json();

  // The contents endpoint stops inlining files over 1 MB; the blob endpoint goes to 100 MB.
  let base64 = meta.content;
  if (!base64) {
    const { repo } = config();
    const blob = await ghJson(`/repos/${repo}/git/blobs/${meta.sha}`);
    base64 = blob.content;
  }
  return { text: Buffer.from(base64, 'base64').toString('utf-8'), sha: meta.sha };
}

/**
 * Commits one file. Without `sha` it overwrites whatever is there (last write wins, like saving
 * over the file locally); with one, GitHub refuses if the file moved on since, which is reported
 * back as a conflict instead of silently dropping a bot sync's commit.
 */
async function commitFile(repoPath, base64, message, sha) {
  const { repo, branch } = config();
  let currentSha = sha;
  if (!currentSha) {
    const res = await gh(contentsPath(repoPath));
    if (res.ok) currentSha = (await res.json()).sha;
  }
  const res = await gh(`/repos/${repo}/contents/${repoPath}`, {
    method: 'PUT',
    body: { message, content: base64, branch, ...(currentSha ? { sha: currentSha } : {}) },
  });
  if (res.status === 409) return { conflict: true };
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub write of ${repoPath} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return { conflict: false };
}

export const githubStorage = {
  async read(name) {
    const file = await readFile(`src/data/${name}.json`);
    if (!file) throw new Error(`src/data/${name}.json not found`);
    return { data: JSON.parse(file.text), version: file.sha };
  },

  async write(name, data, { ifMatch } = {}) {
    const text = JSON.stringify(data, null, 2) + '\n';
    return commitFile(
      `src/data/${name}.json`,
      Buffer.from(text, 'utf-8').toString('base64'),
      `content: update ${name} via admin`,
      ifMatch,
    );
  },

  async upload(safeName, base64) {
    await commitFile(`public/uploads/${safeName}`, base64, `content: upload ${safeName} via admin`);
  },
};

/** Save commits start with this; vercel.json's ignoreCommand skips building them. */
const CONTENT_PREFIX = 'content:';

/** The newest deployment GitHub has a record of, and the newest one that finished. */
async function deploymentState() {
  const { repo } = config();
  const deployments = await ghJson(`/repos/${repo}/deployments?environment=Production&per_page=10`);
  let latestState = null;
  for (const [i, deployment] of deployments.entries()) {
    const [status] = await ghJson(`/repos/${repo}/deployments/${deployment.id}/statuses?per_page=1`);
    if (i === 0) latestState = status?.state ?? null;
    if (status?.state === 'success') return { liveSha: deployment.sha, latestState };
  }
  return { liveSha: null, latestState };
}

/**
 * Admin saves land as commits that Vercel deliberately does not build, so a batch of edits goes
 * live in one deploy rather than one per save. Publishing is that deploy.
 */
export const publisher = {
  /** How many saves are on `main` but not yet on the site. */
  async status() {
    const { repo, branch } = config();
    const { liveSha, latestState } = await deploymentState();
    if (!liveSha) return { pending: null, building: false };
    const compare = await ghJson(`/repos/${repo}/compare/${liveSha}...${encodeURIComponent(branch)}`);
    const pending = compare.commits.filter((c) => c.commit.message.startsWith(CONTENT_PREFIX)).length;
    return { pending, building: ['pending', 'queued', 'in_progress'].includes(latestState) };
  },

  /**
   * Puts an empty "publish:" commit on top -- the ignoreCommand would skip a build whose newest
   * commit is a save -- then calls the deploy hook if one is configured. The commit alone deploys
   * whenever Vercel's GitHub integration picks it up; the hook is there for when it doesn't.
   */
  async publish() {
    const { repo, branch } = config();
    const { pending } = await this.status().catch(() => ({ pending: null }));
    const message =
      pending > 0 ? `publish: ${pending} admin change${pending === 1 ? '' : 's'}` : 'publish: admin';

    // Retried once: a sync workflow can push between reading the branch and moving it.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const ref = await ghJson(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
      const head = await ghJson(`/repos/${repo}/git/commits/${ref.object.sha}`);
      const commit = await ghJson(`/repos/${repo}/git/commits`, {
        method: 'POST',
        body: { message, tree: head.tree.sha, parents: [head.sha] },
      });
      const moved = await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: { sha: commit.sha, force: false },
      });
      if (moved.ok) break;
      if (attempt === 1 || moved.status !== 422) {
        throw new Error(`Moving ${branch} to the publish commit failed (${moved.status})`);
      }
    }

    const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (hook) {
      const res = await fetch(hook, { method: 'POST' });
      if (!res.ok) throw new Error(`Vercel deploy hook failed (${res.status})`);
    }
    return { published: true, pending, hook: Boolean(hook) };
  },
};

const ACTIVE_RUN = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

async function latestRun(workflow) {
  const { repo } = config();
  const body = await ghJson(`/repos/${repo}/actions/workflows/${workflow}/runs?per_page=1`);
  return body.workflow_runs?.[0] ?? null;
}

async function fetchedAt(dataFile) {
  try {
    const file = await readFile(`src/data/${dataFile}`);
    return file ? (JSON.parse(file.text).fetchedAt ?? null) : null;
  } catch {
    return null;
  }
}

export const workflowSync = {
  async list() {
    return Promise.all(
      Object.entries(SYNC_TARGETS).map(async ([id, target]) => {
        const [stamp, run] = await Promise.all([
          fetchedAt(target.steps[0].data),
          latestRun(target.workflow).catch(() => null),
        ]);
        return {
          id,
          label: target.label,
          fetchedAt: stamp,
          running: Boolean(run && ACTIVE_RUN.has(run.status)),
        };
      }),
    );
  },

  /**
   * Starts the workflow and returns at once: a run takes minutes and commits on its own, and the
   * site picks the result up in the build that commit triggers.
   */
  async run(id) {
    const target = SYNC_TARGETS[id];
    if (!target) return { status: 400, body: { error: 'Unknown sync target' } };

    const run = await latestRun(target.workflow).catch(() => null);
    if (run && ACTIVE_RUN.has(run.status)) {
      return { status: 409, body: { error: `${target.label} is already syncing` } };
    }

    const { repo, branch } = config();
    await ghJson(`/repos/${repo}/actions/workflows/${target.workflow}/dispatches`, {
      method: 'POST',
      body: { ref: branch },
    });
    return { status: 202, body: { queued: true, label: target.label } };
  },
};
