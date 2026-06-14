import type { OnboardingStep } from './types';
import { S } from '../selectors';

// First-run, invisible to the roadmap: the cursor pops into existence (handled by fadeIn, with
// the orange spark), pauses a beat, then moves to and clicks the New Agent button, which spawns
// the welcome chat. Static, no LLM. The delays give the pop and the move room to breathe.
export const welcomeOpenStep: OnboardingStep = {
  id: 'welcome_open',
  stage: 'get_started',
  index: 0,
  title: 'Welcome',
  description: '',
  ops: [
    { kind: 'delay', ms: 750 },                                   // let the pop + spark settle
    { kind: 'move_to', target: S.newAgentButton },
    { kind: 'delay', ms: 550 },                                   // pause, then click
    { kind: 'click', target: S.newAgentButton, simulate: true },  // spawns the welcome chat
    { kind: 'outro' },
  ],
};
