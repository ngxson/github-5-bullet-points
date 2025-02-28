# Github 5 bullet points

This repo creates a weekly sum up from your Github activities, in 5 bullet points.

Why? Please search on Google for `Send 5 bullets of what you accomplished last week`

## How to install it?

1. Make sure you created a repo at `https://github.com/{your_username}/{your_username}`. It can be either a blank repo or with an existing README
2. Fork this repo
3. Enable Github Action on your forked repo
4. Go to https://github.com/settings/personal-access-tokens and create a new PAT (personal access token)
  - Token name: `5-bullet-points` (or anything else you want)
  - Resource owner: you (your personal account)
  - Expiration: Recommended to set it to `No expiration`, or if you just want to test it, set to `30 days`
  - Under `Repository access`: `Only select repositories`, then select the repo in step 1
  - `Permissions` --> `Contents` --> Access: `Read and Write`
  - Click on `Generate token`
  - Keep the generated token somewhere safe, will need to use it in later steps
5. Go back to the forked repo, go to Settings --> Secrets and variables --> Actions
6. Create a new **Repository secrets**:
  - Name: `GH_PAT_WRITE`
  - Value: The token from step 4
7. Depending on which LLM inference provider you want to use, follow to guide accordingly:
  - Recommended: use [Hugging Face Inference Provider](https://huggingface.co/blog/inference-providers), create 3 more secrets
    - `OAI_COMPAT_URL`: `https://router.huggingface.co/{provider}`  
      Example: `https://router.huggingface.co/novita`
    - `OAI_COMPAT_TOKEN`: The token created from https://huggingface.co/settings/tokens (remember to check `Make calls to inference providers` when create it)
    - `OAI_COMPAT_EXTRA_BODY`: `{"model":"deepseek/deepseek-r1-distill-qwen-14b"}` (or other models on HF hub)
  - If you wants to use OpenAI:
    - `OAI_COMPAT_URL`: `https://api.openai.com/v1`
    - `OAI_COMPAT_TOKEN`: Your OpenAI key
    - `OAI_COMPAT_EXTRA_BODY`: `{"model":"gpt-4o"}` (or other models)
  - Same for other providers

Optionally: Create a new **Repository variables** (not a secret) to customize the output README file:
- Name: `README_TEMPLATE`
- Value: See example in [config.ts](./config.ts)

Then finally, go to Actions tab in the forked repo --> "Run it" --> "Run workflow" on the right side

## Cronjob

A default cronjob is setup for every Friday at 7pm (GMT+0). You can modify it in `.github/workflows/run-it.yml`
