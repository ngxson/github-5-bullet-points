import { Octokit } from "octokit";
import { Endpoints } from "@octokit/types";
import { CONFIG } from "../config";
import { createChatCmpl } from "./llm";

type ListUserEvents = Endpoints["GET /users/{username}/events"];

const MAX_CONTENT_LENGTH = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PROMPT = `
Below is a series of Github events by ${CONFIG.githubUsername} in the last week. Please summarize the events in 5 bullet points. Write the response inside a YAML code block. For example:

\`\`\`yaml
- Fix [a bug](https://github.com/kubernetes/kubernetes/issues/5351) related to GRPC on Kubernetes
- Working on [a refactoring PR](https://github.com/uigraph/uigraph/pull/123) for the backend of UIGraph
- Reviewing PRs for type definition in UIGraph: [#125](https://github.com/uigraph/uigraph/pull/125), [#127](https://github.com/uigraph/uigraph/pull/127), etc.
- Discussing on [a new model](https://github.com/thatguy/popchat/discussions/3620) for Popachat
- Investigating [a bug](https://github.com/theworld/ppk/issues/643) related to PPK API
\`\`\`

Each event will be delivered in an user message. After each message, you need to reply nothing (empty response), then wait until user sends the message contains "=== THIS IS THE END OF THE EVENTS ===" to stop the event stream. After that, you need to reply with the summary in YAML format.
`.trim();

async function main() {
  const octokit = new Octokit({
    // auth: CONFIG.githubPAT,
  });

  const now = Date.now();
  const dateOneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const events = await getAllEvents({
    octokit,
    username: CONFIG.githubUsername!,
    since: dateOneWeekAgo,
  });
  console.log(`Total events: ${events.length}`);

  const messages: { role: string; content: string }[] = [
    { role: 'user', content: PROMPT },
    { role: 'assistant', content: '(empty response)' },
  ];

  for (const event of events) {
    const isOK = event.public || CONFIG.allowPrivateRepo;
    if (!isOK) {
      console.log('Skipping private event');
    }
    const text = [
      '=== EVENT ===',
      `Timestamp: ${event.created_at ? isoDateToString(event.created_at) : '(unknown)'}`,
      `Type: ${event.type}`,
      `Actor: ${event.actor.login}`,
      `Repo: ${event.repo.name}`,
    ];
    const { payload: { action, comment, issue, pages } } = event;
    if (action) {
      text.push(`Action: ${action}`);
    }
    if (comment) {
      text.push(`Link: ${comment.html_url}`);
      if (issue) {
        text.push(`Issue title: ${issue.title}`);
        text.push(`Issue creator: ${issue.user?.login}`);
      }
      text.push(`Added comment: ${truncate(comment.body ?? '', MAX_CONTENT_LENGTH)}`);
    } else if (issue) {
      text.push(`Link: ${issue.html_url}`);
      text.push(`Issue creator: ${issue.user?.login}`);
      text.push(`Issue title: ${issue.title}`);
      text.push(`Issue description: ${truncate(issue.body ?? '', MAX_CONTENT_LENGTH)}`);
    }
    for (const page of (pages || [])) {
      text.push(`Link: ${page.html_url}`);
      text.push(`Title: ${page.title}`);
      text.push(`Content: ${truncate(page.summary ?? '', MAX_CONTENT_LENGTH)}`);
    }
    // console.log(text.join('\n'));
    messages.push({ role: 'user', content: text.join('\n') });
    messages.push({ role: 'assistant', content: '(empty response)' });
  }

  messages.push({ role: 'user', content: '=== THIS IS THE END OF THE EVENTS ===' });
  console.log(`Total messages: ${messages.length}`);

  // create a chat summary
  console.log('Creating chat summary...');
  const summary = await createChatCmpl(messages);

  // extract the summary from the response
  const lines = summary.split('</think>').pop()!.split('\n');
  const summaryLines: string[] = [];
  let inSummary = false;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inSummary = !inSummary;
      continue;
    }
    if (inSummary) {
      summaryLines.push(line);
    }
  }

  const summaryText = summaryLines.join('\n').trim();
  const readmeContent = CONFIG.readmeTemplate.replace('{content}', summaryText);
  console.log('\n\n====================\n\n');
  console.log(readmeContent);
  console.log('\n\n====================\n\n');
  const octokitWrite = new Octokit({
    auth: CONFIG.githubPATWrite,
  });
  await pushFile({
    octokit: octokitWrite,
    owner: CONFIG.githubUsername!,
    repo: CONFIG.githubUsername!,
    path: 'README.md',
    content: readmeContent,
  });
  console.log('Done');
}

async function getAllEvents({
  octokit, username, since
}: {
  octokit: Octokit, username: string, since: Date
}): Promise<ListUserEvents["response"]["data"]> {
  const events: ListUserEvents["response"]["data"] = [];
  let page = 1;
  while (true) {
    console.log(`Fetching page ${page}`);
    try {
      const res = await octokit.request(`GET /users/${username}/events`, {
        per_page: 100,
        page,
      }) as ListUserEvents["response"];
      if (res.data.length === 0) {
        break;
      }
      for (const event of res.data) {
        if (event.created_at) {
          const dateCreatedAt = new Date(event.created_at);
          if (dateCreatedAt < since) {
            break;
          }
        }
      }
      events.push(...res.data);
      page++;
      break;
      delay(100);
    } catch (e) {
      if (e.status === 422) {
        console.log('Hit rate limit or page limit, stopping');
        break;
      }
    }
  }
  return events;
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.slice(0, length) + '... (truncated)' : text;
}

function isoDateToString(date: string): string {
  return new Date(date).toString();
}

async function pushFile({
  octokit, owner, repo, path, content
}: {
  octokit: Octokit, owner:string, repo: string, path: string, content: string
}) {
  console.log(`Pushing file to ${owner}/${repo}/${path}`);
  // firstly check if file exists
  let sha: string | undefined = undefined;
  try {
    const file = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    // @ts-ignore
    sha = file.data?.sha;
  } catch (e) {
    // ignored
  }
  const res = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    message: `Update README.md ${new Date().toISOString()}`,
    committer: {
      name: 'machineuser',
      email: 'machineuser@github.com'
    },
    sha,
    content: Buffer.from(content).toString('base64'),
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  console.log(res);
  console.log('File pushed');
}

main();
