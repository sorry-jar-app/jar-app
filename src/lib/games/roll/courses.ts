/**
 * The three Roll courses, as data.
 *
 * Everything here is in the jar SVG's own 200x250 viewBox, the same coordinates
 * COIN_SLOTS and JAR_BODY_PATH use, so the numbers drop straight into the coin
 * simulation without conversion.
 *
 * The jar interior is x 30..170, y 22..248 with a 42 corner radius. A coin of
 * radius 8 sitting 2 inside the wall therefore has its centre confined to
 * x 40..160 down the straight sides — and, because the goal line sits low
 * enough to be inside the bottom corner arcs, only to about x 51..149 at the
 * line itself. Every safe span below is placed inside that window; a ledge out
 * at the wall would be scenery the coin can never actually reach.
 */

export type Peg = { x: number; y: number; r: number };

/** A span of the goal line that loses the coin. Half-open in neither direction:
 *  the coin's centre crossing anywhere in x0..x1 is a loss. */
export type Trap = { x0: number; x1: number };

export type Course = {
  name: string;
  pegs: Peg[];
  traps: Trap[];
  /**
   * The top surface of the floor the coin is trying to land on. The round ends
   * the moment the coin's underside touches it — clear of a trap is a win —
   * which is why it is a surface and not a tripwire: the coin freezes resting
   * on the ledge rather than halfway through it.
   */
  goal: number;
};

/** The playing coin. Smaller than a jar coin so there is something to thread. */
export const COIN_R = 8;

/** Where the coin is dropped from, on every course. */
export const START = { x: 100, y: 38 } as const;

/**
 * The floor surface, 238, which puts the coin's centre at 230 when it lands.
 *
 * That is as low as the line can usefully go: at y 230 the jar's bottom corner
 * arcs have already narrowed the reachable centres to x 51..149, and any lower
 * the outer ledges become scenery the coin cannot get to.
 */
export const GOAL_Y = 238;

/**
 * Three courses, each meaner than the last.
 *
 * The escalation is in the ledges, not the clutter: 36 units of safe landing
 * on the first, 28 on the second, 18 on the third, against a coin 16 wide.
 * The pegs then decide how much choice you get on the way down — the first
 * course has one fork, the last has four.
 *
 * Every peg-to-peg and peg-to-wall gap is wider than the coin, so there is
 * nowhere to wedge permanently; the worst case is a pause that a tilt frees.
 */
export const COURSES: Course[] = [
  {
    name: 'Room to Spare',
    goal: GOAL_Y,
    // One fork at the top, two low pegs to break a straight fall. Miss the
    // middle and almost anywhere is fine.
    pegs: [
      { x: 103, y: 94, r: 11 },
      { x: 64, y: 156, r: 10 },
      { x: 140, y: 156, r: 10 },
    ],
    traps: [{ x0: 82, x1: 118 }],
  },
  {
    name: 'Less Room',
    goal: GOAL_Y,
    // The drop lands on the nose of the top peg, and the ledges have moved
    // apart, so the fork at the top is the shot you are actually taking.
    pegs: [
      { x: 97, y: 74, r: 10 },
      { x: 60, y: 122, r: 9 },
      { x: 140, y: 122, r: 9 },
      { x: 104, y: 170, r: 10 },
    ],
    traps: [
      { x0: 72, x1: 100 },
      { x0: 128, x1: 170 },
    ],
  },
  {
    name: 'No Room',
    goal: GOAL_Y,
    // Two ledges barely wider than the coin, with a peg parked over the middle
    // trap so the last bounce is always away from the centre.
    pegs: [
      { x: 96, y: 64, r: 10 },
      { x: 68, y: 108, r: 9 },
      { x: 132, y: 108, r: 9 },
      { x: 82, y: 152, r: 9 },
      { x: 118, y: 152, r: 9 },
      { x: 103, y: 196, r: 10 },
    ],
    traps: [
      { x0: 30, x1: 70 },
      { x0: 88, x1: 116 },
      { x0: 134, x1: 170 },
    ],
  },
];

/** True when landing with the coin's centre at this x is lost. */
export function inTrap(course: Course, x: number): boolean {
  return course.traps.some((t) => x >= t.x0 && x <= t.x1);
}

/**
 * The safe spans of a course's goal line, as the drawing needs them: the gaps
 * left over between the traps, clipped to the jar's inside edge.
 */
export function ledges(course: Course): Trap[] {
  const sorted = [...course.traps].sort((a, b) => a.x0 - b.x0);
  const out: Trap[] = [];
  let cursor = 32;
  for (const t of sorted) {
    if (t.x0 > cursor) out.push({ x0: cursor, x1: Math.min(t.x0, 168) });
    cursor = Math.max(cursor, t.x1);
  }
  if (cursor < 168) out.push({ x0: cursor, x1: 168 });
  return out.filter((s) => s.x1 - s.x0 > 0.5);
}
