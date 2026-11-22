import { dashboardParkingGroups } from './dashboardParkingLayout'
import { slotKey } from './parkingMapJson'
import type { PreviewSlot } from './parkingMapPreview'
import { emptyParkingLayout, type LayoutShape } from './parkingLayout'

/** Use the Dashboard's physical slot groups, preserving the current slot data. */
export function createDashboardLayout(slots: PreviewSlot[]) {
  const layout = emptyParkingLayout()
  let sequence = 0
  const shape = (
    type: LayoutShape['type'],
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    text = '',
    opacity = 1,
  ) => {
    layout.shapes.push({
      id: `dashboard-${sequence++}`,
      type,
      x,
      y,
      width,
      height,
      color,
      text,
      opacity,
      reverse: false,
    })
  }
  const text = (
    value: string,
    x: number,
    y: number,
    width: number,
    height = 18,
    color = '#586477',
  ) => shape('text', x, y, width, height, color, value)
  const line = (x: number, y: number, width: number, height = 0, color = '#ffffff') =>
    shape('line', x, y, width, height, color)
  shape('rectangle', 12, 24, 976, 596, '#e8e3d9')
  text('PARKING FLOOR PLAN', 350, 40, 300, 28, '#334155')
  // Driving aisles sit between the same parking islands as the Dashboard.
  for (const y of [170, 305, 465]) {
    shape('rectangle', 34, y, 925, 48, '#c7c5bf')
    for (let x = 125; x < 910; x += 85) line(x, y + 24, 35, 0, '#f8fafc')
  }
  shape('rectangle', 34, 110, 54, 405, '#c7c5bf')
  shape('rectangle', 924, 110, 35, 405, '#c7c5bf')
  text('OUT ↑', 30, 82, 60, 18, '#b45309')
  text('IN →', 100, 82, 52, 18, '#15803d')
  text('UP ↑', 35, 428, 45, 16)
  text('DOWN ↓', 365, 428, 80, 16)
  for (const x of [180, 460, 790]) text('→', x, 180, 42, 30, '#c2413b')
  for (const x of [180, 460, 790]) text('←', x, 315, 42, 30, '#c2413b')
  text('↓', 926, 245, 25, 30, '#c2413b')
  text('↑', 46, 245, 25, 30, '#c2413b')
  text('←', 795, 475, 42, 30, '#c2413b')
  text('F', 715, 540, 20, 20)
  for (const [label, y] of [
    ['A', 137],
    ['B', 242],
    ['C', 280],
    ['D', 405],
    ['E', 440],
  ] as const)
    text(label, 963, y, 17)

  const reference = new Map<number, { x: number; y: number; width: number; height: number }>()
  for (const group of dashboardParkingGroups) {
    group.rows.forEach((row, rowIndex) =>
      row.forEach((number, column) => {
        const width = group.compact ? 23 : 25
        reference.set(number, {
          x: group.x + column * (width + 2),
          y: 70 + group.y * 1.1 + rowIndex * 36,
          width,
          height: 32,
        })
      }),
    )
  }
  // Slot identity includes its zone; arbitrary imports are arranged in sequence.
  const standardZones = ['A', 'B', 'C', 'D', 'E', 'F']
  const isReference =
    slots.length === 124 &&
    new Set(slots.map((s) => s.number)).size === 124 &&
    slots.every(
      (s) =>
        reference.has(s.number) &&
        s.zone ===
          standardZones[
            s.number <= 26
              ? 0
              : s.number <= 49
                ? 1
                : s.number <= 72
                  ? 2
                  : s.number <= 94
                    ? 3
                    : s.number <= 104
                      ? 4
                      : 5
          ],
    )
  slots.forEach((slot, index) => {
    const position = reference.get(isReference ? slot.number : index + 1)
    layout.positions[slotKey(slot)] = position
      ? { ...position }
      : {
          x: 40 + ((index - 124) % 24) * 38,
          y: 660 + Math.floor((index - 124) / 24) * 48,
          width: 32,
          height: 36,
        }
  })
  return layout
}
