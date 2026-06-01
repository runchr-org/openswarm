import React from 'react';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Modal from '@mui/material/Modal';
import CloseIcon from '@mui/icons-material/Close';
import { ClaudeTokens } from '@/shared/styles/claudeTokens';

function ShrinkingLabel() {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
      <Box component="span" sx={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        bgcolor: 'currentColor',
        animation: 'osw-pulse 1.2s ease-in-out infinite',
        '@keyframes osw-pulse': {
          '0%, 100%': { opacity: 0.4 },
          '50%': { opacity: 1 },
        },
      }} />
      Shrinking
    </Box>
  );
}

interface OversizePopupProps {
  c: ClaudeTokens;
  oversizeQueue: Array<{ path: string; name: string; tokens: number }>;
  summarizingAll: boolean;
  summarizingPath: string | null;
  summarizeOversize: (path: string) => void;
  summarizeAllOversize: () => void;
  detachOversize: (path: string) => void;
  detachAllOversize: () => void;
}

/** Wrapper that delays unmount through MUI Fade so the popup eases out instead
 *  of snap-disappearing. Important because the auto-retry-send fires once the
 *  queue drains; without the fade-out the user sees "popup vanishes" → blank ms
 *  → "their message appears", which feels jumpy. With the fade it's a calm
 *  handoff. Visibility tracked via local `open` so we can decouple it from the
 *  queue-length React render. */
const OversizePopup: React.FC<OversizePopupProps> = ({
  c, oversizeQueue, summarizingAll, summarizingPath,
  summarizeOversize, summarizeAllOversize, detachOversize, detachAllOversize,
}) => {
  const queued = oversizeQueue.length > 0;
  // Remember the last non-empty snapshot so the fade-out renders the same content
  // it had a moment ago, instead of going blank during the transition.
  const lastSnapshot = React.useRef(oversizeQueue);
  if (queued) lastSnapshot.current = oversizeQueue;
  const snap = lastSnapshot.current;
  const n = snap.length;
  if (n === 0) return null;
  const firstName = snap[0].name;
  const headline = n === 1
    ? <><strong>{firstName}</strong> is too big to send.</>
    : <>{n} files are too big to send: <strong>{firstName}</strong>{n > 1 ? <> and {n - 1} other{n > 2 ? 's' : ''}</> : null}.</>;
  const shrinkLabel = n === 1 ? 'Shrink it' : `Shrink all ${n}`;
  const removeLabel = n === 1 ? 'Remove' : `Remove all ${n}`;
  const shrinking = summarizingAll || !!summarizingPath;
  const onShrink = () => (n === 1 ? summarizeOversize(snap[0].path) : summarizeAllOversize());
  const onRemove = () => (n === 1 ? detachOversize(snap[0].path) : detachAllOversize());
  return (
    <Fade in={queued} timeout={{ enter: 200, exit: 220 }} unmountOnExit>
      <Box
        sx={{
          position: 'absolute', left: 8, right: 8, bottom: 'calc(100% + 8px)',
          bgcolor: c.bg.surface, border: `1px solid ${c.border.medium}`,
          boxShadow: c.shadow.md, borderRadius: '12px',
          px: 2, py: 1.25,
          whiteSpace: 'normal',
          zIndex: 5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            color: c.text.primary, fontSize: '0.88rem', lineHeight: 1.45,
            flex: '1 1 auto', minWidth: 0,
          }}>
            {headline}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
            <Box
              component="button"
              disabled={shrinking}
              onClick={onShrink}
              sx={{
                bgcolor: c.accent.primary, color: '#fff',
                border: 'none', borderRadius: '6px',
                px: 1.5, py: 0.7, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease, opacity 0.15s ease',
                '&:hover': { bgcolor: c.accent.hover },
                '&:disabled': { opacity: 0.85, cursor: 'wait', bgcolor: c.accent.primary },
              }}
            >
              {shrinking ? <ShrinkingLabel /> : shrinkLabel}
            </Box>
            <Box
              component="button"
              disabled={shrinking}
              onClick={onRemove}
              sx={{
                bgcolor: 'transparent', color: c.text.secondary,
                border: `1px solid ${c.border.medium}`, borderRadius: '6px',
                px: 1.5, py: 0.7, fontSize: '0.82rem', cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease, color 0.15s ease',
                '&:hover': { bgcolor: c.bg.secondary, color: c.text.primary },
                '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
              }}
            >
              {removeLabel}
            </Box>
          </Box>
        </Box>
        <SlowHint active={shrinking} color={c.text.secondary} />
      </Box>
    </Fade>
  );
};

/** Fade-wrapped error toast. Last-non-null snapshot keeps the message visible
 *  through the exit animation instead of going blank during fade-out. */
const ErrorToast: React.FC<{ c: ClaudeTokens; message: string | null; onClose: () => void }> = ({ c, message, onClose }) => {
  const lastMessage = React.useRef<string | null>(null);
  if (message) lastMessage.current = message;
  const display = lastMessage.current;
  if (!display) return null;
  return (
    <Fade in={!!message} timeout={{ enter: 200, exit: 220 }} unmountOnExit>
      <Box
        sx={{
          position: 'absolute', left: 8, right: 8, bottom: 'calc(100% + 8px)',
          display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: c.bg.surface, border: `1px solid ${c.border.medium}`,
          boxShadow: c.shadow.md, borderRadius: '12px',
          px: 2, py: 1.25,
          whiteSpace: 'normal',
          zIndex: 6,
        }}
      >
        <Box sx={{
          color: c.text.primary, fontSize: '0.88rem', lineHeight: 1.45,
          flex: '1 1 auto', minWidth: 0,
        }}>
          {display}
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: c.text.secondary, flexShrink: 0, '&:hover': { color: c.text.primary } }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Fade>
  );
};

/** Honest "this is taking a sec" hint that fades in only AFTER 10s of waiting.
 *  Silent on fast operations (most cases) so we don't lie about every shrink
 *  being slow; visible only when the user has actually been waiting long enough
 *  to start wondering if it's frozen. */
function SlowHint({ active, color }: { active: boolean; color: string }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!active) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 10000);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <Fade in={show} timeout={250}>
      <Box sx={{ color, fontSize: '0.75rem', mt: 0.5, lineHeight: 1.3, opacity: 0.7 }}>
        This may take up to a minute. Sit tight.
      </Box>
    </Fade>
  );
}

interface Props {
  c: ClaudeTokens;
  lightboxSrc: string | null;
  setLightboxSrc: (src: string | null) => void;
  oversizeQueue: Array<{ path: string; name: string; tokens: number }>;
  summarizingPath: string | null;
  summarizingAll: boolean;
  summarizeOversize: (path: string) => void;
  summarizeAllOversize: () => void;
  detachOversize: (path: string) => void;
  detachAllOversize: () => void;
  currentModelCtx: number;
  summarizeError: string | null;
  setSummarizeError: (v: string | null) => void;
}

export const ChatInputOverlays: React.FC<Props> = ({
  c, lightboxSrc, setLightboxSrc, oversizeQueue, summarizingPath, summarizingAll,
  summarizeOversize, summarizeAllOversize, detachOversize, detachAllOversize,
  currentModelCtx, summarizeError, setSummarizeError,
}) => {
  // Auto-dismiss the error after 6s, matching the Snackbar behavior we replaced.
  React.useEffect(() => {
    if (!summarizeError) return;
    const t = setTimeout(() => setSummarizeError(null), 6000);
    return () => clearTimeout(t);
  }, [summarizeError, setSummarizeError]);
  return (
    <>
      <Modal
        open={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box
          onClick={() => setLightboxSrc(null)}
          sx={{ position: 'relative', outline: 'none', maxWidth: '90vw', maxHeight: '90vh' }}
        >
          <IconButton
            onClick={() => setLightboxSrc(null)}
            sx={{
              position: 'absolute',
              top: -16,
              right: -16,
              bgcolor: c.bg.surface,
              border: `1px solid ${c.border.medium}`,
              color: c.text.secondary,
              width: 32,
              height: 32,
              zIndex: 1,
              '&:hover': { bgcolor: c.bg.secondary },
              boxShadow: c.shadow.md,
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <img
            src={lightboxSrc || ''}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              display: 'block',
            }}
          />
        </Box>
      </Modal>

      {/* Single popup handles ALL over-size files. Fade controls enter/exit so the
          handoff to auto-retry-send feels smooth, not snap-cut. Internal SlowHint
          only fades in after 10s of waiting so we're honest without being noisy. */}
      <OversizePopup
        c={c}
        oversizeQueue={oversizeQueue}
        summarizingAll={summarizingAll}
        summarizingPath={summarizingPath}
        summarizeOversize={summarizeOversize}
        summarizeAllOversize={summarizeAllOversize}
        detachOversize={detachOversize}
        detachAllOversize={detachAllOversize}
      />

      {/* Error toast also fades. 220ms exit keeps it from snap-disappearing on close. */}
      <ErrorToast c={c} message={summarizeError} onClose={() => setSummarizeError(null)} />
    </>
  );
};
