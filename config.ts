import 'dotenv/config';

const DEFAULT_README_TEMPLATE = `
Five bullets of what I accomplished last week:

{content}

<sup>This summary is generated by [github-5-bullet-points](https://github.com/ngxson/github-5-bullet-points)</sup>
`.trim();

export const CONFIG = {
  githubUsername: process.env.GITHUB_USERNAME || process.env.GITHUB_ACTOR,
  githubPATWrite: process.env.GH_PAT_WRITE,

  oaiCompatUrl: process.env.OAI_COMPAT_URL,
  oaiCompatToken: process.env.OAI_COMPAT_TOKEN,
  oaiCompatExtraBody: JSON.parse(process.env.OAI_COMPAT_EXTRA_BODY || '{}'),
  oaiCompatExtraHeaders: JSON.parse(process.env.OAI_COMPAT_EXTRA_HEADERS || '{}'),

  readmeTemplate: process.env.README_TEMPLATE || DEFAULT_README_TEMPLATE,

  blacklistedRepos: new Set((process.env.BLACKLISTED_REPOS || '').split(/,\n/)),
  allowPrivateRepo: process.env.ALLOW_PRIVATE_REPO === 'yes_i_know_that_it_is_insecure_but_i_want_to_use_it_anyway',
};

if (!CONFIG.githubUsername) {
  throw new Error('GITHUB_USERNAME is required');
}

if (!CONFIG.githubPATWrite) {
  throw new Error('GH_PAT_WRITE is required');
}

if (!CONFIG.oaiCompatUrl) {
  throw new Error('OAI_COMPAT_URL is required');
}

if (!CONFIG.oaiCompatToken) {
  throw new Error('OAI_COMPAT_TOKEN is required');
}
