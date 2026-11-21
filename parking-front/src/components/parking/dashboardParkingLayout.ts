export interface DashboardParkingGroup {
  id: string
  x: number
  y: number
  rows: number[][]
  compact?: boolean
}

export const dashboardParkingGroups: DashboardParkingGroup[] = [
  { id: 'a-1', x: 112, y: 50, rows: [[1, 2, 3]] },
  { id: 'a-2', x: 220, y: 50, rows: [[4, 5, 6, 7]] },
  { id: 'a-3', x: 338, y: 50, rows: [[8, 9, 10, 11]] },
  { id: 'a-4', x: 460, y: 50, rows: [[12, 13, 14]] },
  { id: 'a-5', x: 566, y: 50, rows: [[15, 16, 17]] },
  { id: 'a-6', x: 668, y: 50, rows: [[18, 19, 20]] },
  { id: 'a-7', x: 770, y: 50, rows: [[21, 22, 23]] },
  { id: 'a-8', x: 868, y: 50, rows: [[24, 25, 26]] },

  {
    id: 'bc-1',
    x: 112,
    y: 137,
    rows: [
      [49, 48, 47],
      [50, 51, 52],
    ],
    compact: true,
  },
  {
    id: 'bc-2',
    x: 218,
    y: 137,
    rows: [
      [46, 45, 44, 43],
      [53, 54, 55, 56],
    ],
    compact: true,
  },
  {
    id: 'bc-3',
    x: 350,
    y: 137,
    rows: [
      [42, 41, 40, 39],
      [57, 58, 59, 60],
    ],
    compact: true,
  },
  {
    id: 'bc-4',
    x: 484,
    y: 137,
    rows: [
      [36, 37, 38],
      [61, 62, 63],
    ],
    compact: true,
  },
  {
    id: 'bc-5',
    x: 598,
    y: 137,
    rows: [
      [35, 34, 33],
      [64, 65, 66],
    ],
    compact: true,
  },
  {
    id: 'bc-6',
    x: 712,
    y: 137,
    rows: [
      [32, 31, 30],
      [67, 68, 69],
    ],
    compact: true,
  },
  {
    id: 'bc-7',
    x: 828,
    y: 137,
    rows: [
      [29, 28, 27],
      [70, 71, 72],
    ],
    compact: true,
  },

  {
    id: 'de-1',
    x: 112,
    y: 293,
    rows: [
      [94, 93, 92],
      [95, 96, 97],
    ],
    compact: true,
  },
  {
    id: 'de-2',
    x: 225,
    y: 293,
    rows: [
      [91, 90, 89, 88],
      [98, 99, 100, 101],
    ],
    compact: true,
  },
  {
    id: 'de-3',
    x: 456,
    y: 284,
    rows: [
      [85, 86, 87],
      [102, 103, 104],
    ],
    compact: true,
  },
  {
    id: 'de-4',
    x: 650,
    y: 284,
    rows: [
      [79, 80, 81],
      [82, 83, 84],
    ],
    compact: true,
  },
  {
    id: 'de-5',
    x: 785,
    y: 284,
    rows: [
      [73, 74, 75],
      [76, 77, 78],
    ],
    compact: true,
  },

  { id: 'f-1', x: 30, y: 430, rows: [[124, 123, 122, 121, 120, 119, 118]] },
  { id: 'f-2', x: 232, y: 430, rows: [[117, 116, 115]] },
  { id: 'f-3', x: 342, y: 430, rows: [[114, 113, 112, 111]] },
  { id: 'f-4', x: 490, y: 430, rows: [[110, 109, 108, 107]] },
  { id: 'f-5', x: 640, y: 430, rows: [[106, 105]] },
]
