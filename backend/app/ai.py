"""Claude client (Anthropic API or Bedrock) and prompt helpers."""

import json
import os
import re

import anthropic

from .config import USE_BEDROCK, logger, model_for

llm = None
try:
    if USE_BEDROCK:
        llm = anthropic.AnthropicBedrock(
            aws_region=os.getenv("AWS_REGION", "us-east-1")
        )
    elif os.getenv("ANTHROPIC_API_KEY"):
        llm = anthropic.Anthropic()
except Exception:
    logger.exception(
        "AI client could not be initialized; rule-based fallbacks remain available"
    )


def ask(system, messages, max_tokens=1200, task="fast"):
    if llm is None:
        raise RuntimeError("AI provider is not configured")
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    r = llm.messages.create(
        model=model_for(task), max_tokens=max_tokens, system=system, messages=messages
    )
    if not r.content or not getattr(r.content[0], "text", None):
        raise RuntimeError("AI provider returned an empty response")
    return r.content[0].text


def ask_json(system, text, fallback, max_tokens=1200, task="fast"):
    try:
        response = ask(system, text, max_tokens, task)
        match = re.search(r"\{.*\}", response, re.S)
        if not match:
            raise ValueError("AI response did not contain JSON")
        value = json.loads(match.group())
        if not isinstance(value, dict):
            raise ValueError("AI response JSON was not an object")
        return value
    except Exception as exc:  # network/API errors must not break the workflow
        logger.warning("Using fallback response: %s", exc)
        return fallback
