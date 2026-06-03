"""
Intra-run batch replay: do a mechanical sub-flow ONCE, then replay it for many
inputs without re-screenshotting/re-analyzing each time.

The case (the user's): the agent searches LinkedIn and reads person A's profile,
realizes it must do the same for B, C, D... Instead of the full
screenshot->analyze->decide loop per person, it hands us the step template (with
{{value}} where the input varies) + the list of values, and we replay it per
value at machine speed: zero screenshots, zero LLM turns.

Held to extreme rigor because this is the HIGHEST ghost-risk feature, per-item
pages vary (profile A has "Message", B is connect-only, C hits a wall), so blind
replay would click the wrong thing and claim success it didn't earn:

1. VERIFY EVERY STEP, FALL BACK NEVER GHOST. Each step's result is checked; the
   instant an item's page doesn't match the template (any step errors), that
   item is abandoned and reported as needs-manual, the loop never pretends.
   Honest tally always: "did N of M; these need you."

2. SENDS ARE GATED, READS ARE FREE. Read/search/navigate loops are safe and run
   freely. Any irreversible step (click "Send"/"Submit"/"Connect"/"Pay"/..., or
   typing into a message composer) makes the whole template unsafe to auto-replay,
   we refuse and tell the agent to do those one at a time with confirmation. A
   ghost in a send-loop isn't slow, it's wrong messages, so we don't allow it.

3. NETWORK-FIRST WHERE POSSIBLE. A step can be a `replay_route` (hit a captured
   API endpoint with the value substituted) instead of clicking the UI, the fast,
   reliable tier the audit found we use ~0% of the time. A read-loop over an
   endpoint is dramatically faster than navigating N pages.

This module is the PURE, browser-free core (validate / gate / fill); the execute+
verify+report loop lives in browser_agent where the executor is.
"""

import re

PLACEHOLDER = "{{value}}"

# Agent-facing step action -> (tool_name, the param keys it carries).
_STEP_TOOLS: dict[str, tuple[str, tuple[str, ...]]] = {
    "navigate":     ("BrowserNavigate",    ("url",)),
    "get_text":     ("BrowserGetText",     ()),
    "evaluate":     ("BrowserEvaluate",    ("expression",)),
    "type":         ("BrowserType",        ("selector", "text")),
    "click":        ("BrowserClickByName", ("role", "name")),
    "press_key":    ("BrowserPressKey",    ("key",)),
    "scroll":       ("BrowserScroll",      ("direction", "amount")),
    "replay_route": ("BrowserReplayRoute", ("url",)),  # the fast network tier
}

# Reads/navigation don't mutate anything irreversible; safe to loop freely.
_READONLY_ACTIONS = {"navigate", "get_text", "evaluate", "scroll", "replay_route"}

# Irreversible / outward-facing words on a clicked control. Conservative on
# purpose: we'd rather refuse a borderline loop than auto-send 10 messages.
_SEND_NAME_RE = re.compile(
    r"\b(send|submit|post|publish|connect|invite|follow|like|react|comment|reply|"
    r"share|message|dm|pay|buy|order|checkout|purchase|place\s*order|book|"
    r"confirm|apply|accept|decline|delete|remove|unsend|withdraw|endorse)\b",
    re.I,
)
# A field that reads like a message/comment composer; typing here is part of a send.
_COMPOSE_SEL_RE = re.compile(r"message|compose|comment|msg|reply|editor|body|tweet|post", re.I)


def is_send_step(step: dict) -> bool:
    """True if this step is irreversible / outward-facing, so the whole loop must
    be gated rather than auto-replayed."""
    action = step.get("action")
    if action == "click" and _SEND_NAME_RE.search(str(step.get("name") or "")):
        return True
    if action == "type" and _COMPOSE_SEL_RE.search(str(step.get("selector") or "")):
        return True
    return False


def validate_template(steps) -> tuple[bool, str]:
    """Structural check: non-empty, every step a known action with its required
    fields present. Returns (ok, reason)."""
    if not isinstance(steps, list) or not steps:
        return False, "no steps provided"
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            return False, f"step {i+1} is not an object"
        action = step.get("action")
        spec = _STEP_TOOLS.get(action)
        if not spec:
            return False, f"step {i+1}: unknown action {action!r} (allowed: {', '.join(_STEP_TOOLS)})"
        _, required = spec
        for key in required:
            if step.get(key) in (None, ""):
                return False, f"step {i+1} ({action}) is missing '{key}'"
    return True, ""


def template_safety(steps) -> tuple[bool, str]:
    """True if the template is safe to auto-replay (no irreversible step). On a
    send/submit step, returns (False, reason naming it) so the caller refuses and
    routes those through normal per-item confirmation."""
    for i, step in enumerate(steps):
        if is_send_step(step):
            what = step.get("name") or step.get("selector") or step.get("action")
            return False, (f"step {i+1} looks irreversible/outward-facing ({what!r}); "
                           "do sends/submits one at a time with confirmation, not in a batch")
    return True, ""


def _sub(val, value: str):
    return value if val == PLACEHOLDER else (
        val.replace(PLACEHOLDER, value) if isinstance(val, str) else val
    )


def fill_step(step: dict, value: str) -> tuple[str, dict]:
    """Turn one template step + one value into (tool_name, params) ready for
    execute_browser_tool. Substitutes {{value}} anywhere it appears."""
    action = step["action"]
    tool_name, keys = _STEP_TOOLS[action]
    params = {}
    for k in keys:
        if k in step:
            params[k] = _sub(step[k], value)
    # carry an optional role default for clicks
    if action == "click" and "role" not in params:
        params["role"] = _sub(step.get("role", ""), value)
    return tool_name, params


def fill_template(steps, value: str) -> list[tuple[str, dict]]:
    return [fill_step(s, value) for s in steps]


def is_readonly_template(steps) -> bool:
    """True if every step is a pure read/navigation (no clicks/types at all), the
    safest class of loop."""
    return all(s.get("action") in _READONLY_ACTIONS for s in steps)
