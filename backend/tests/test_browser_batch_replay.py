"""Intra-run batch replay: the pure validate / gate / fill core.

The highest-ghost-risk feature, so these pin down the two guarantees: (1) sends
are gated (never auto-looped), (2) the template fills correctly so a verified
replay is exact. Edge cases are deliberate, this is the 'no shadow of a doubt' set.
"""

from backend.apps.agents.browser import browser_batch_replay as br


# --- structural validation ---------------------------------------------------
def test_validate_rejects_empty_and_garbage():
    assert br.validate_template([])[0] is False
    assert br.validate_template("nope")[0] is False
    assert br.validate_template([{"action": "fly"}])[0] is False           # unknown action
    assert br.validate_template([{"action": "navigate"}])[0] is False      # missing url
    assert br.validate_template([{"action": "type", "selector": "#q"}])[0] is False  # missing text


def test_validate_accepts_a_well_formed_read_loop():
    ok, why = br.validate_template([
        {"action": "navigate", "url": "https://x.com/search?q={{value}}"},
        {"action": "get_text"},
    ])
    assert ok and why == ""


def test_validate_accepts_all_known_actions():
    steps = [
        {"action": "navigate", "url": "u"},
        {"action": "get_text"},
        {"action": "evaluate", "expression": "1"},
        {"action": "type", "selector": "#q", "text": "{{value}}"},
        {"action": "click", "role": "link", "name": "{{value}}"},
        {"action": "press_key", "key": "Enter"},
        {"action": "scroll", "direction": "down", "amount": 3},
        {"action": "replay_route", "url": "https://x.com/api?q={{value}}"},
    ]
    assert br.validate_template(steps)[0] is True


# --- the send gate (the safety guarantee) -----------------------------------
def test_send_and_submit_clicks_are_gated():
    for name in ["Send", "Send message", "Submit", "Connect", "Post", "Pay now",
                 "Buy", "Place order", "Delete", "Apply", "Follow", "Accept"]:
        safe, why = br.template_safety([
            {"action": "navigate", "url": "u"},
            {"action": "click", "role": "button", "name": name},
        ])
        assert safe is False, f"{name!r} must be gated"
        assert "irreversible" in why or "one at a time" in why


def test_typing_into_a_message_composer_is_gated():
    safe, _ = br.template_safety([
        {"action": "type", "selector": "div.msg-form__contenteditable", "text": "hi {{value}}"},
    ])
    assert safe is False


def test_pure_read_navigate_loop_is_safe():
    safe, why = br.template_safety([
        {"action": "navigate", "url": "https://x.com/in/{{value}}"},
        {"action": "get_text"},
        {"action": "evaluate", "expression": "document.title"},
    ])
    assert safe is True and why == ""


def test_a_benign_click_is_allowed_but_a_send_anywhere_gates_the_whole_thing():
    # clicking a non-send control (e.g. a result link) is fine to loop
    assert br.template_safety([{"action": "click", "role": "link", "name": "View profile"}])[0] is True
    # but ONE send step anywhere makes the whole template unsafe
    assert br.template_safety([
        {"action": "navigate", "url": "u"},
        {"action": "click", "role": "link", "name": "Open"},
        {"action": "click", "role": "button", "name": "Send invite"},
    ])[0] is False


# --- substitution (a verified replay is only as good as the fill) -----------
def test_fill_substitutes_value_everywhere():
    tool, params = br.fill_step({"action": "navigate", "url": "https://x.com/in/{{value}}/about"}, "ada")
    assert (tool, params) == ("BrowserNavigate", {"url": "https://x.com/in/ada/about"})

    tool, params = br.fill_step({"action": "type", "selector": "#q", "text": "{{value}} engineer"}, "design")
    assert params == {"selector": "#q", "text": "design engineer"}

    tool, params = br.fill_step({"action": "click", "role": "link", "name": "{{value}}"}, "Ada Lovelace")
    assert tool == "BrowserClickByName" and params == {"role": "link", "name": "Ada Lovelace"}


def test_replay_route_maps_to_the_fast_network_tool():
    tool, params = br.fill_step({"action": "replay_route", "url": "https://x.com/api/p?u={{value}}"}, "ada")
    assert tool == "BrowserReplayRoute" and params == {"url": "https://x.com/api/p?u=ada"}


def test_fill_handles_a_value_with_url_characters():
    # a value with spaces/specials is substituted literally (caller is responsible
    # for encoding); we just don't mangle or drop it
    tool, params = br.fill_step({"action": "navigate", "url": "https://x.com/s?q={{value}}"}, "a b&c")
    assert params["url"] == "https://x.com/s?q=a b&c"


def test_fill_template_runs_every_step_per_value():
    steps = [{"action": "navigate", "url": "u/{{value}}"}, {"action": "get_text"}]
    filled = br.fill_template(steps, "x")
    assert [t for t, _ in filled] == ["BrowserNavigate", "BrowserGetText"]


def test_is_readonly_template():
    assert br.is_readonly_template([{"action": "navigate", "url": "u"}, {"action": "get_text"}])
    assert not br.is_readonly_template([{"action": "type", "selector": "#q", "text": "x"}])
