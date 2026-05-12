"""Shared retry/fallback helper for Groq API calls.

Groq's free tier has a tokens-per-minute (TPM) limit. When several agents
fire in parallel they can collectively exceed it. The error message tells
us how many seconds to wait. We retry once after that delay; if it still
fails we return a graceful fallback message instead of crashing the run.
"""

import asyncio
import re
from groq import RateLimitError


async def call_groq_with_retry(
    client,
    *,
    model: str,
    messages: list,
    max_tokens: int,
    lang: str = "de",
    agent_name: str = "Groq",
) -> str:
    last_error: str = ""

    for attempt in range(2):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content

        except RateLimitError as e:
            msg = str(e)
            last_error = msg
            m = re.search(r"try again in ([\d.]+)s", msg)
            wait_s = min(float(m.group(1)) + 0.5, 30.0) if m else 8.0

            if attempt == 0:
                await asyncio.sleep(wait_s)
                continue

            return (
                f"⚠️ {agent_name}: TPM-Rate-Limit erreicht – bitte ~1 Minute warten und erneut versuchen."
                if lang == "de" else
                f"⚠️ {agent_name}: TPM rate limit reached – wait ~1 minute and retry."
            )

        except Exception as e:
            last_error = str(e)[:200]
            return (
                f"⚠️ {agent_name}-Fehler: {last_error}"
                if lang == "de" else
                f"⚠️ {agent_name} error: {last_error}"
            )

    return last_error or ""
