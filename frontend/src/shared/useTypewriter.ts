import { useEffect, useRef, useState } from 'react';

// RPG-style typewriter hook. Given a growing `fullText` (server keeps
// appending), reveals it character-by-character at a steady cadence
// with tiny pauses after sentence-ending punctuation. Different from a
// pure "as data arrives" stream: smooths bursty upstream cadence into
// a calm, predictable rhythm that reads like Phoenix Wright / Animal
// Crossing dialogue rather than a Twitch raid spam.
//
// Why this lives here instead of inside StreamingBubble: both the
// assistant message bubble AND the tool-call bubble want the same
// typing rhythm, so the loop logic is shared.
//
// The hook keeps a ref-based `displayedLen` counter and only triggers
// React re-renders when that counter advances (one re-render per
// RAF tick at most). The leaf component reads the substring fresh on
// each render. Caller's parent does NOT re-render between ticks
// because nothing leaks out of this hook.

interface TypewriterOptions {
  // Steady-state characters per second. RPG dialogue typically runs
  // 25-60 cps; 70 reads as "fast confident character." If the
  // upstream sends faster than this, we don't drop chars, we lag
  // a bit and catch up between bursts.
  cps?: number;
  // ms to pause after `.`, `!`, `?`, `:` (sentence-ending punctuation).
  sentencePauseMs?: number;
  // ms to pause after `\n\n` (paragraph break).
  paragraphPauseMs?: number;
  // ms after `,` `;`. Smaller; barely perceptible but adds rhythm.
  commaPauseMs?: number;
  // When the gap between displayed and full exceeds this, accelerate
  // catch-up so a long lag doesn't feel "stuck." 200 chars behind
  // means the model emitted a big burst (paragraph, tool result);
  // we'll catch up in roughly 2 seconds at 2x rate instead of 6s.
  catchupThresholdChars?: number;
  catchupMultiplier?: number;
}

const SENTENCE_PUNCT = new Set(['.', '!', '?', ':']);
const COMMA_PUNCT = new Set([',', ';']);

export function useTypewriter(fullText: string, options: TypewriterOptions = {}): string {
  const {
    cps = 65,
    sentencePauseMs = 90,
    paragraphPauseMs = 180,
    commaPauseMs = 35,
    catchupThresholdChars = 200,
    catchupMultiplier = 2.0,
  } = options;

  // Bumping `tick` triggers a re-render so the caller reads the new
  // substring; we never put the substring itself in state because that
  // would allocate a new string on every paint.
  const [, setTick] = useState(0);
  const displayedLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastPaintAtRef = useRef(0);
  const pauseUntilRef = useRef(0);

  // Reset when fullText resets to empty (stream cleared / new turn).
  // We do NOT reset when fullText simply grows; that's the steady-
  // state case the loop handles.
  useEffect(() => {
    if (fullText.length === 0 && displayedLenRef.current > 0) {
      displayedLenRef.current = 0;
      lastPaintAtRef.current = 0;
      pauseUntilRef.current = 0;
      setTick((t) => (t + 1) & 0xffff);
    }
  }, [fullText]);

  useEffect(() => {
    // Nothing to type? Stop the loop.
    if (displayedLenRef.current >= fullText.length) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const step = (now: number) => {
      rafRef.current = null;

      // Honor punctuation pause: if we're inside one, don't advance,
      // but DO reschedule so we wake up after the pause expires.
      if (now < pauseUntilRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const last = lastPaintAtRef.current || now;
      const dt = Math.max(1, now - last);
      lastPaintAtRef.current = now;

      // Catch-up: if we're far behind, paint faster.
      const lag = fullText.length - displayedLenRef.current;
      const effectiveCps = lag > catchupThresholdChars ? cps * catchupMultiplier : cps;

      // How many chars should we have painted given the elapsed ms?
      // Round so 16ms * 65cps = ~1.04 chars rounds to 1, not 0.
      const charsToAdd = Math.max(1, Math.round((dt * effectiveCps) / 1000));
      let next = Math.min(displayedLenRef.current + charsToAdd, fullText.length);

      // Punctuation pause check: if a punctuation char is in the chunk
      // we're about to add, stop AT the punctuation (include it), then
      // arm the pause. Picks the FIRST punctuation in the chunk so a
      // burst-paint doesn't skip over multiple sentence boundaries.
      const chunk = fullText.slice(displayedLenRef.current, next);
      let pauseMs = 0;
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        if (SENTENCE_PUNCT.has(ch)) {
          next = displayedLenRef.current + i + 1;
          pauseMs = sentencePauseMs;
          // Check for paragraph break (.\n\n pattern) to extend pause.
          if (fullText[next] === '\n' && fullText[next + 1] === '\n') {
            pauseMs = paragraphPauseMs;
          }
          break;
        }
        if (COMMA_PUNCT.has(ch)) {
          next = displayedLenRef.current + i + 1;
          pauseMs = commaPauseMs;
          break;
        }
      }

      if (next !== displayedLenRef.current) {
        displayedLenRef.current = next;
        setTick((t) => (t + 1) & 0xffff);
      }
      if (pauseMs > 0) {
        pauseUntilRef.current = now + pauseMs;
      }

      if (displayedLenRef.current < fullText.length) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(step);
    }
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [fullText, cps, sentencePauseMs, paragraphPauseMs, commaPauseMs, catchupThresholdChars, catchupMultiplier]);

  // Read fresh substring on each render. No allocation per RAF tick
  // unless the displayed length actually changed (we only setTick when
  // it does).
  return fullText.slice(0, displayedLenRef.current);
}
