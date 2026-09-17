---
id: ai-features
number: 14
title: AI Features
group: DELIVER
---

PixelDeck can use an AI model you supply to do two jobs: **translate the text
on your screenshots**, and **redraw a screenshot with its text in another
language**. Both are optional. The editor is complete without a key — AI only
removes the typing.

Your key is stored in your browser (or in the app's local storage on desktop
and Android) and is sent **straight to the provider you chose**. It never
passes through a PixelDeck server, because there isn't one.

## What a key gets you

**Translate one text layer.** In the Localization view, each text layer has a
translate button. The model receives the source text, the target language, and
a description of the design it sits in — the app name, the slide's purpose, the
other text on that slide. That context is why it returns "Track every rupee"
rather than a literal rendering that no one would write on a store listing.
Bold and coloured runs inside a sentence survive the round trip: they are sent
as tags and mapped back onto the translated words.

**Translate everything at once.** *Translate all* sends every untranslated
layer for a locale in one request and applies the result as **a single undo
step**, so one Ctrl+Z puts the whole language back if you do not like it.

**Redraw a screenshot in another language.** A phone or image layer can be sent
to an image-editing model with the instruction to reproduce it with its visible
text localized. This needs a model that can *edit images*, not merely read
them — `gpt-image-*` on OpenAI, an image-capable Gemini model on Google. A
text-only model is rejected before the request is made, so you are not charged
for a call that could not have worked.

**Test the connection.** Settings → AI has a test button that makes the
smallest possible real request. Use it after pasting a key: it is the quickest
way to tell a wrong key from a wrong model from a blocked network.

## Choosing a provider

| Provider | Key from | Good for |
| --- | --- | --- |
| **OpenAI** | platform.openai.com/api-keys | The default. `gpt-4o-mini` translates well and costs very little; `gpt-image-1` for redrawing screenshots. |
| **OpenRouter** | openrouter.ai/keys | One key, many models — Claude, GPT, Gemini and open models behind a single account. Easiest if you want to compare. |
| **Google Gemini** | aistudio.google.com/app/apikey | A generous free tier. Pick an image-capable model if you want screenshot redrawing. |
| **Custom** | your own endpoint | Anything that speaks the OpenAI Chat Completions API — a local model, a company gateway, another vendor. Paste the base URL and your key. |

## Setting it up

1. Open **Settings → AI**.
2. Pick the provider. The panel shows where to get a key for that one.
3. Paste the key. It is saved as you type, locally.
4. Pick a model. The list is fetched from the provider with your key, so it
   shows what your account can actually reach — not a guess.
5. Press **Test connection**. A green result means translation is ready.
6. Go to **Localization**, add a language, and translate a layer or press
   *Translate all*.

## What it costs

You pay your provider directly, at their rates. Translation is small: a store
listing is a few hundred words, so a whole project in a new language is
typically a fraction of a cent on a cheap model. Image redrawing is the
expensive one — it is a full image generation per screenshot, so try it on one
slide before running it across a set.

## When something goes wrong

The error the panel shows is the provider's own message plus what to do about
it. The usual ones:

- **"API key not valid"** — the key was mistyped, or it belongs to a different
  provider. A Gemini key starts `AIza`, an OpenAI key `sk-`, OpenRouter `sk-or-`.
- **"Your API key was reported as leaked"** — Google disables a key that has
  appeared publicly. Delete it in AI Studio and create a new one. Never paste a
  key into a chat, an issue or a screenshot.
- **"Requests from referer … are blocked"** — the key has an HTTP-referrer
  restriction. Either remove the restriction or use an unrestricted key; the
  app calls the provider from the device, so there is no fixed referrer.
- **404 on the model** — the model id is not available to your account. Reopen
  the model list and pick one it returns.
- **429** — you are over your quota or rate limit. Wait, or add billing.
- **A network error on Android** — requests go through the native HTTP layer to
  avoid WebView CORS limits; if it still fails, check the device is online and
  that no VPN or filter is blocking the provider's domain.

## Keeping the key safe

- It is stored locally, in this app, on this device. Clearing site data removes it.
- It is never written into a project file, a template or an export, so sharing
  a `.json` project does not share your key.
- If you think a key has been seen by anyone else, revoke it at the provider
  and issue a new one. That costs nothing and is always the right move.
