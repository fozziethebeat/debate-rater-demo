## Getting Started

Pre-requisite: setup some backend servers for generating images and chatting
with an LLM.  I built this around my minimal setup at
[surfacechat](https://github.com/surfacedata/surfacechat).  Put the URLs for
these beasts in your `.env` file as such:

```
IMAGE_API_URL=https://image.api.your.url
LLM_API_URL=https://llm.api.your.url
```

Then, install stuff:

```bash
pnpm install
```

Finally run the dev server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see
the result.
