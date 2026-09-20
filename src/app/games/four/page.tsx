'use client';

/**
 * Four in a row — the two-phone game.
 *
 * Three opponents sit behind one OpponentSource, so the board, the turn logic
 * and the result are written once. Nothing here moves money: a finished round
 * can preselect the loser and open the ordinary /log flow, where a human still
 * presses the button.
 *
 * The wire is deliberately thin — a column number and a round id. 'A' always
 * means the person holding *this* device, on both phones, which is the app's
 * identity convention. So the two boards are mirror images of each other in
 * their labels, and anything carrying a Person over the wire is flipped on
 * receipt. A column number needs no flipping, which is most of why this works.
 */

import { Button, Card, Radio, RadioGroup } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { GameGate } from '@/components/games/GameGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  COLS,
  ROWS,
  at,
  canDrop,
  drop,
  emptyBoard,
  landingRow,
  other,
  outcomeOf,
  type Board,
} from '@/lib/games/four/board';
import type { OpponentKind } from '@/lib/games/opponent';
import { useAiOpponent } from '@/lib/games/useAiOpponent';
import { useLocalOpponent } from '@/lib/games/useLocalOpponent';
import { useRemoteOpponent } from '@/lib/games/useRemoteOpponent';
import { newId } from '@/lib/id';
import { useReducedMotion } from '@/lib/reducedMotion';
import { displayName, initialOf, useStore } from '@/lib/store';
import type { Person } from '@/lib/types';

/** This device's user is always 'A'. Whoever is opposite is always 'S'. */
const ME: Person = 'A';
const THEM: Person = 'S';

const MACHINE = 'The machine';

/**
 * Board geometry in CSS pixels: the gap between two holes, and the frame
 * around them. Neither sets the board's SIZE any more — that comes off the
 * screen, see .sj-field below — and the falling disc measures its own column
 * rather than reading these back, because the pitch is different on every
 * phone now.
 */
const GAP = 5;
const PAD = 8;

const COLUMNS = Array.from({ length: COLS }, (_, i) => i);
/** Row 0 is the floor; the column stacks column-reverse, so this order is it. */
const ROW_ORDER = Array.from({ length: ROWS }, (_, i) => i);

function countDiscs(board: Board): number {
  let n = 0;
  for (const cell of board) if (cell) n++;
  return n;
}

/**
 * Whose turn it is, read off the board rather than tracked alongside it. One
 * fewer thing that can drift out of step with the position — which matters
 * when the position is also being rebuilt from messages on another phone.
 */
function turnOf(board: Board, starter: Person): Person {
  return countDiscs(board) % 2 === 0 ? starter : other(starter);
}

function FourPageScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const reduced = useReducedMotion();

  const jar = state.jar;
  const themName = displayName(state, THEM);

  const [kind, setKind] = useState<OpponentKind>('ai');
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [starter, setStarter] = useState<Person>(ME);
  /** Bumped per round, so an identical result still reaches the live region. */
  const [roundNo, setRoundNo] = useState(0);
  /** No round to play yet — the other phone has not handed one over. */
  const [pending, setPending] = useState(true);
  const [theyLeft, setTheyLeft] = useState(false);
  const [lastDrop, setLastDrop] = useState<{ col: number; row: number } | null>(null);

  const boardRef = useRef<Board>(emptyBoard());
  const starterRef = useRef<Person>(ME);
  const roundRef = useRef('');
  /** Who opened the round now on the board, so a rematch can alternate it. */
  const myStarterRef = useRef<Person>(THEM);

  const remote = useRemoteOpponent(jar?.jarId ?? null, jar?.meId ?? null, jar?.partnerId ?? null, themName);
  const local = useLocalOpponent(themName);
  // Easy, on purpose. The solver still takes a win and still refuses a loss, so
  // it is not a pushover; it is just beatable on a sofa, which a wall is not.
  const machine = useAiOpponent(MACHINE, 'easy');

  const source = kind === 'remote' ? remote : kind === 'local' ? local : machine;
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  /**
   * Which phone hands out rounds. Both compute the same answer from the same
   * two ids, and each sees itself on the opposite side of the comparison, so
   * exactly one of them is host and neither has to ask.
   */
  const isHost = !jar?.partnerId || !jar.meId ? true : jar.meId < jar.partnerId;
  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const remoteReady = Boolean(jar?.partnerId) && remote.present;

  /* ── the round ─────────────────────────────────────────────────────────── */

  const startRound = useCallback((nextStarter: Person, id: string, announce: boolean) => {
    roundRef.current = id;
    starterRef.current = nextStarter;
    myStarterRef.current = nextStarter;
    boardRef.current = emptyBoard();
    setBoard(boardRef.current);
    setStarter(nextStarter);
    setRoundNo((n) => n + 1);
    setLastDrop(null);
    setTheyLeft(false);
    setPending(false);
    // The machine needs the round id to answer on; the other phone needs the
    // whole thing. The pass-the-phone source echoes it straight back, which the
    // handler below recognises as its own and ignores.
    if (announce) {
      sourceRef.current.send({ t: 'newRound', from: 'me', round: id, starter: nextStarter });
    }
  }, []);

  const clearBoard = useCallback(() => {
    roundRef.current = '';
    boardRef.current = emptyBoard();
    setBoard(boardRef.current);
    setLastDrop(null);
    setTheyLeft(false);
  }, []);

  const applyMove = useCallback((col: number) => {
    const prev = boardRef.current;
    if (outcomeOf(prev).kind !== 'playing') return;
    const row = landingRow(prev, col);
    const next = drop(prev, col, turnOf(prev, starterRef.current));
    if (!next || row < 0) return;
    boardRef.current = next;
    setBoard(next);
    setLastDrop({ col, row });
  }, []);

  /* ── the opponent ──────────────────────────────────────────────────────── */

  useEffect(() => {
    return source.subscribe((msg) => {
      switch (msg.t) {
        case 'hello':
          if (!isHostRef.current) break;
          // A round already open with nothing in it will do for them.
          if (roundRef.current && countDiscs(boardRef.current) === 0) break;
          startRound(ME, newId(), true);
          break;
        case 'newRound': {
          // Our own echo back off the pass-the-phone source: already adopted.
          if (msg.round === roundRef.current) break;
          // Both phones can press "Go again", and inside one round trip both
          // will. Last-write-wins leaves each holding the OTHER's id, so every
          // move afterwards fails the staleness guard below and the game stops
          // dead with no error and, for whichever phone is not on turn, no
          // control left to recover with. So when our own round is still
          // untouched, the lower id wins: both sides compare the same pair and
          // reach the same answer without another exchange.
          const mine = roundRef.current;
          if (mine && countDiscs(boardRef.current) === 0 && mine < msg.round) break;
          // Their frame, not ours. They said who starts from where they sit.
          startRound(other(msg.starter), msg.round, false);
          break;
        }
        case 'move':
          // A straggler from a round that has already been packed away.
          if (msg.round !== roundRef.current) break;
          applyMove(msg.col);
          break;
        case 'bail':
          setTheyLeft(true);
          break;
      }
    });
  }, [source, startRound, applyMove]);

  /** Set only by "carry on", the one case where a board outlives its opponent. */
  const keepBoard = useRef(false);

  /** A new opponent gets a new board. Nobody inherits somebody else's position. */
  useEffect(() => {
    if (keepBoard.current) {
      keepBoard.current = false;
      // Carrying on: the machine takes over the position as it stands and only
      // needs to know which round it is answering on.
      sourceRef.current.send({
        t: 'newRound',
        from: 'me',
        round: roundRef.current,
        starter: starterRef.current,
      });
      setPending(false);
      return;
    }
    if (kind === 'remote') {
      // The round comes from whichever phone is host; until it lands there is
      // nothing to play.
      clearBoard();
      setPending(true);
      return;
    }
    startRound(ME, newId(), true);
  }, [kind, startRound, clearBoard]);

  /**
   * Presence is the handshake. The host hands out a round the moment the other
   * phone shows up; a guest that arrives to find the host already here says
   * hello, because nobody's presence changed to announce it.
   */
  useEffect(() => {
    if (kind !== 'remote' || !remote.present) return;
    if (isHost) startRound(ME, newId(), true);
    else sourceRef.current.send({ t: 'hello', from: 'me', user: jar?.meId ?? '' });
  }, [kind, remote.present, isHost, jar?.meId, startRound]);

  useEffect(() => {
    if (kind !== 'remote' || remote.present) return;
    setTheyLeft(true);
  }, [kind, remote.present]);

  /* ── reading the position ──────────────────────────────────────────────── */

  const outcome = outcomeOf(board);
  const win = outcome.kind === 'win' ? outcome.win : null;
  const over = outcome.kind !== 'playing';
  const played = countDiscs(board);
  const turn = turnOf(board, starter);
  const myTurn = turn === ME;
  const winCells = new Set(win ? win.cells.map(([c, r]) => c * ROWS + r) : []);
  const waiting = !over && !theyLeft && (pending || (kind !== 'local' && !myTurn));
  /** Nothing to start over from: no round yet, or a board nobody has touched. */
  const cannotRestart = pending || played === 0;

  // The machine is handed the position after the other side moves and answers
  // through subscribe(), exactly as a person would.
  useEffect(() => {
    const think = source.think;
    if (!think || pending || theyLeft || over || turn === ME) return;
    think(board, THEM);
    // Leaving this position — a new round, a new opponent — calls off the
    // search with it. Without the cleanup the reply arrives for a board that
    // no longer exists.
    return () => source.cancel?.();
  }, [source, board, turn, pending, theyLeft, over]);

  /* ── the falling disc ──────────────────────────────────────────────────── */

  const dropped = useRef<HTMLSpanElement | null>(null);
  const dropAnim = useRef<Animation | null>(null);
  const setDropRef = useCallback((el: HTMLSpanElement | null) => {
    // Assign only. React detaches the previous disc's ref in the same commit,
    // and in tree order that can land after the new one has attached.
    if (el) dropped.current = el;
  }, []);

  useEffect(() => {
    const el = dropped.current;
    if (!el || !lastDrop) return;
    el.style.opacity = '';
    if (reduced) return;

    const hole = el.getBoundingClientRect();
    // The pitch — one hole plus one gap — comes off the live column, never off
    // a constant: the board is a different size on every screen now, and a
    // disc animated over a remembered pitch falls the wrong distance.
    const column = el.closest('[data-column]')?.getBoundingClientRect();
    if (!hole.height || !column) return;
    const pitch = (column.height - hole.height) / (ROWS - 1);
    if (!Number.isFinite(pitch) || pitch <= 0) return;
    // It falls the length of the column it is actually landing in, so a disc on
    // the floor takes longer to get there than one on the top row.
    const fall = (ROWS - lastDrop.row) * pitch;

    dropAnim.current = el.animate(
      [
        {
          transform: `translateY(${-fall}px)`,
          opacity: 0,
          easing: 'cubic-bezier(.55,.085,.68,.53)',
        },
        { transform: 'translateY(0)', opacity: 1, offset: 0.82 },
        { transform: `translateY(${-Math.min(7, fall * 0.05)}px)`, offset: 0.91 },
        { transform: 'translateY(0)' },
      ],
      { duration: 130 + fall * 0.85 },
    );

    return () => {
      dropAnim.current?.cancel();
      dropAnim.current = null;
    };
  }, [lastDrop, reduced]);

  /* ── playing ───────────────────────────────────────────────────────────── */

  function dropIn(col: number) {
    if (pending || over || theyLeft) return;
    if (kind !== 'local' && !myTurn) return;
    if (!canDrop(boardRef.current, col)) return;

    source.send({ t: 'move', from: 'me', round: roundRef.current, col });
    // The pass-the-phone source echoes every send back, and that echo is what
    // applies the move. The other two never echo, so it is applied here.
    if (kind !== 'local') applyMove(col);
  }

  function pick(next: OpponentKind) {
    if (next === kind) return;
    if (kind === 'remote' && !over && played > 0) {
      source.send({ t: 'bail', from: 'me', round: roundRef.current, why: 'left' });
    }
    setKind(next);
  }

  function carryOn() {
    // The machine inherits the board rather than starting a fresh one — the
    // position was the interesting part, and it is still on the screen.
    keepBoard.current = true;
    setTheyLeft(false);
    setKind('ai');
  }

  function goAgain() {
    // Whoever opened the last round does not open this one. A fresh opponent
    // gets the plain ME opening; only a rematch alternates.
    startRound(other(myStarterRef.current), newId(), true);
  }

  /* ── the result ────────────────────────────────────────────────────────── */

  const nameOf = (who: Person) => (who === THEM && kind === 'ai' ? MACHINE : displayName(state, who));

  const winner = win ? win.who : null;
  const loser = win ? other(win.who) : null;

  /**
   * The database refuses a fine on somebody who is not in the jar, and the
   * refusal surfaces as a sync failure rather than as anything a person could
   * act on. So: never offer it. The machine, obviously, cannot be fined either.
   */
  const fineable =
    loser !== null &&
    (loser === ME || (kind !== 'ai' && (!jar || jar.partnerId !== null)));

  let resultLine = '';
  if (outcome.kind === 'draw') resultLine = 'Forty-two discs, and nothing to show for it.';
  else if (kind === 'ai') resultLine = winner === ME ? 'The machine took it well.' : 'It had nothing else on.';
  else resultLine = 'Four in a row. No appeals.';

  let turnLine = '';
  if (over || theyLeft) turnLine = '';
  // `pending` is still true on the first painted frame for every opponent,
  // because the effect that opens the round runs after the commit. Saying
  // "Waiting on Them…" over a dead board invents a wait that is not happening,
  // and for a solo player names a partner who does not exist.
  else if (pending) turnLine = kind === 'remote' ? `Waiting on ${themName}…` : '';
  else if (kind === 'local') turnLine = `${nameOf(turn)} to drop.`;
  else if (myTurn) turnLine = 'Your turn.';
  else if (kind === 'ai') turnLine = 'Thinking…';
  else turnLine = `Waiting on ${themName}…`;

  const whyNoPhone = jar?.partnerId
    ? `${themName} is not on this screen. The machine always is.`
    : 'No other phone is signed in to this jar. The machine, or your own thumb.';

  function fineTheLoser() {
    if (!loser) return;
    // Clear first: a draft abandoned earlier would otherwise arrive at /log
    // with its CTA already live.
    dispatch({ type: 'draft/reset' });
    dispatch({ type: 'draft/patch', patch: { who: loser } });
    router.push('/log');
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Four in a row" backTo="/games" tight />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
      >
        {/* Three opponents, one choice, so it is a radio group — the same
            reading History settled on. A single-select ToggleButtonGroup calls
            itself a radiogroup and is a toolbar underneath: three tab stops,
            and an arrow key that moves focus without moving the selection.
            Centred, because the group wraps to a second line on a narrow
            phone and a wrapped row should still sit under the first. */}
        <RadioGroup
          aria-label="Who you are playing"
          orientation="horizontal"
          style={{ width: '100%', justifyContent: 'center' }}
          value={kind}
          onChange={(next) => {
            if (next === 'remote' || next === 'local' || next === 'ai') pick(next);
          }}
        >
          <Radio value="remote" isDisabled={!remoteReady}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Other phone
            </Radio.Content>
          </Radio>
          <Radio value="local">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              This phone
            </Radio.Content>
          </Radio>
          <Radio value="ai">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              The machine
            </Radio.Content>
          </Radio>
        </RadioGroup>

        {!remoteReady && (
          <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 270 }}>
            {whyNoPhone}
          </p>
        )}

        <p
          role="status"
          aria-live="polite"
          className="text-muted"
          style={{ fontSize: 13, margin: 0, minHeight: 18 }}
        >
          {turnLine}
        </p>

        {/* The board is the screen: .sj-field takes every pixel between the
            turn line and the result, and the board fills it.

            container-type is this game's one addition to the field, and it is
            here rather than in layout.css because only a board made of divs
            needs it. The other four draw an SVG, which carries its own ratio
            and is sized by the rules already in the stylesheet; a div has none,
            so this board reads the field's own height — 100cqh — and takes the
            narrower of "as wide as the field" and "as wide as that height
            allows". Holes stay round either way, which is the thing that goes
            wrong if you let max-height do the work instead. */}
        <div className="sj-field sj-field--wide" style={{ containerType: 'size' }}>
          <div
            role="group"
            aria-label="Four in a row board"
            aria-busy={waiting}
            style={{
              width: '100%',
              // COLS holes across and ROWS down is COLS/ROWS wide for a given
              // height; the 6px is the frame and the odd gap out. Written as a
              // max-width rather than a clamp so a browser with no container
              // units drops this one declaration and still gets a full-width
              // board instead of none.
              maxWidth: `max(180px, calc((100cqh - 6px) * ${COLS} / ${ROWS}))`,
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: GAP,
              padding: PAD,
              background: 'var(--surface)',
              border: '1px solid var(--separator)',
              // The same glass the cards are made of, off the theme's own
              // blur, so the board belongs to the screen it sits on.
              backdropFilter: 'blur(var(--glass-blur, 20px))',
              WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
              borderRadius: 24,
              overflow: 'hidden',
            }}
          >
            {COLUMNS.map((col) => {
              const open = landingRow(board, col);
              const shut = pending || over || theyLeft || open < 0 || (kind !== 'local' && !myTurn);

              // Read bottom-up, the way the discs stack. The discs themselves
              // carry no text, so without this the only thing a screen reader
              // can learn is how full a column is — never whose discs are in
              // it, which makes the position unreadable and the game
              // unplayable however well the result is announced.
              const stack: string[] = [];
              for (let row = 0; row < ROWS; row++) {
                const cell = at(board, col, row);
                if (!cell) break;
                stack.push(cell === ME ? 'yours' : `${nameOf(THEM)}'s`);
              }
              const contents = stack.length ? stack.join(', ') : 'empty';

              return (
                <button
                  key={col}
                  type="button"
                  // onClick, not onPress: this is a plain button drawing a
                  // column of holes, not a kit component.
                  data-column={col}
                  aria-label={`Column ${col + 1}: ${contents}`}
                  // aria-disabled, not disabled: the browser blurs a focused
                  // element the moment it is disabled, and every drop shuts all
                  // seven columns while the other side answers. A keyboard
                  // player was losing focus to <body> once per move and having
                  // to tab back through the whole screen. dropIn already
                  // refuses on every one of these conditions.
                  aria-disabled={shut || undefined}
                  onClick={() => dropIn(col)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    gap: GAP,
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: shut ? 'default' : 'pointer',
                  }}
                >
                  {ROW_ORDER.map((row) => {
                    const cell = at(board, col, row);
                    const isNew = lastDrop?.col === col && lastDrop.row === row;
                    const dim = win !== null && !winCells.has(col * ROWS + row);

                    return (
                      <span
                        key={row}
                        style={{
                          position: 'relative',
                          width: '100%',
                          flex: 'none',
                          aspectRatio: '1',
                          borderRadius: '50%',
                          // An empty hole is the play field's own wash, which
                          // reads as a well cut into the frame in both modes:
                          // darker than the surface in light, lighter in dark.
                          background: 'var(--field-wash)',
                        }}
                      >
                        {cell && (
                          <span
                            ref={isNew ? setDropRef : undefined}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: '50%',
                              // The two people, in the two colours they
                              // carry everywhere else in the app. No word ever
                              // sits on a disc, so these are bare fills.
                              background: cell === ME ? 'var(--who-a)' : 'var(--who-s)',
                              boxShadow: winCells.has(col * ROWS + row)
                                ? 'inset 0 0 0 3px var(--background)'
                                : undefined,
                              opacity: dim ? 0.38 : isNew && !reduced ? 0 : undefined,
                              transition: 'opacity .25s ease',
                            }}
                          />
                        )}
                      </span>
                    );
                  })}
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 78,
            width: '100%',
          }}
        >
          {over ? (
            <Card key={`${roundNo}-${played}`} style={{ width: '100%' }}>
              <Card.Content
                style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
              >
                {winner && !(kind === 'ai' && winner === THEM) && (
                  <Avatar person={winner} initial={initialOf(nameOf(winner))} size={34} />
                )}
                <div>
                  <Card.Title>
                    {winner ? `${nameOf(winner)} wins` : 'Nobody wins'}
                  </Card.Title>
                  <Card.Description>{resultLine}</Card.Description>
                </div>
              </Card.Content>
            </Card>
          ) : (
            theyLeft && (
              <Card key={`left-${roundNo}`} style={{ width: '100%' }}>
                <Card.Content style={{ textAlign: 'left' }}>
                  <Card.Description>
                    {themName} has left the game. The machine has nowhere to be.
                  </Card.Description>
                </Card.Content>
              </Card>
            )
          )}
        </div>
      </div>

      <div className="sj-footer">
        {theyLeft && !over ? (
          <Button fullWidth size="lg" onPress={carryOn}>
            Carry on against the machine
          </Button>
        ) : over ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {fineable && loser && (
              <Button fullWidth size="lg" onPress={fineTheLoser}>
                Log a fine on {nameOf(loser)}
              </Button>
            )}
            <Button
              fullWidth
              size="lg"
              variant={fineable ? 'secondary' : 'primary'}
              onPress={goAgain}
            >
              Go again
            </Button>
          </div>
        ) : (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            // aria-disabled, not isDisabled — and through render(), because the
            // kit's Button overwrites an aria-disabled handed to it as a prop.
            // Pressing this is what empties the board, which is the condition
            // that shuts it: a real `disabled` would blur the control the
            // player has just pressed and drop focus to the top of the screen.
            // The handler refuses on the same condition.
            render={(props) => <button {...props} aria-disabled={cannotRestart || undefined} />}
            onPress={() => {
              if (!cannotRestart) goAgain();
            }}
          >
            Start over
          </Button>
        )}
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          Playing is free. The fine is still yours to log.
        </p>
      </div>
    </div>
  );
}

/** Locked until the jar is worth enough — see lib/games/catalogue. */
export default function Page() {
  return (
    <GameGate href="/games/four">
      <FourPageScreen />
    </GameGate>
  );
}
