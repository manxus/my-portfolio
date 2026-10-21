import { SYNC_TARGETS } from './admin-core.js';

/**
 * The live site's half of the admin API: Vercel's filesystem is read-only and thrown away per
 * request, so a save becomes a commit to the repository through the GitHub REST API, and the
 * Vercel build that commit triggers puts it on the site about a minute later. Syncs dispatch the
 * same GitHub Actions workflows the daily cron runs.
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
