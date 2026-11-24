type Quad = [number, number, number, number, number, number, number, number]

export const mockups: { id: string; name: string; quad: Quad; circle?: boolean }[] = [
  { id: 'cafeteria', name: 'Exhibidor en cafetería', quad: [.142, .056, .652, .088, .722, .879, .207, .949] },
  { id: 'restaurante', name: 'Mesa de restaurante', quad: [.345, .178, .672, .283, .605, .883, .281, .808] },
  { id: 'barberia', name: 'Mostrador de barbería', quad: [.326, .147, .671, .225, .658, .817, .324, .85] },
  { id: 'hotel', name: 'Recepción de hotel', quad: [.46, .093, .896, .119, .912, .87, .468, .837] },
  { id: 'tienda', name: 'Vitrina de tienda', quad: [.224, .314, .712, .26, .758, .815, .241, .89] },
  { id: 'servicio-tecnico', name: 'Servicio técnico', quad: [.274, .174, .761, .17, .792, .844, .299, .845] },
  { id: 'placa-pared', name: 'Placa de pared', quad: [.291, .277, .84, .211, .869, .862, .305, .891] },
  { id: 'cartel-enmarcado', name: 'Cartel enmarcado', quad: [.345, .177, .734, .178, .736, .794, .345, .789] },
  { id: 'adhesivo-cristal', name: 'Adhesivo de cristal', quad: [.205, .131, .659, .14, .659, .773, .211, .774], circle: true },
  { id: 'tarjeta-posavasos', name: 'Tarjeta sobre la mesa', quad: [.47, .219, .86, .524, .541, .872, .163, .536] },
]

// La proyección encaja el diseño en las cuatro esquinas de la superficie fotografiada.
const mockupSide = 400
export function homography(quad: Quad, width: number, height: number) {
  const corners = [[0, 0], [mockupSide, 0], [mockupSide, mockupSide], [0, mockupSide]]
  const grid = corners.flatMap(([x, y], i) => {
    const u = quad[i * 2] * width, v = quad[i * 2 + 1] * height
    return [[x, y, 1, 0, 0, 0, -x * u, -y * u, u], [0, 0, 0, x, y, 1, -x * v, -y * v, v]]
  })
  for (let column = 0; column < 8; column++) {
    const best = grid.slice(column).reduce((chosen, row, offset) => Math.abs(row[column]) > Math.abs(grid[chosen][column]) ? column + offset : chosen, column)
    ;[grid[column], grid[best]] = [grid[best], grid[column]]
    const pivot = grid[column][column]
    if (Math.abs(pivot) < 1e-8) return 'none'
    grid[column] = grid[column].map((value) => value / pivot)
    for (let row = 0; row < 8; row++) if (row !== column) {
      const factor = grid[row][column]
      grid[row] = grid[row].map((value, i) => value - factor * grid[column][i])
    }
  }
  const [a, b, c, d, e, f, g, h] = grid.map((row) => row[8])
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].join(',')})`
}
