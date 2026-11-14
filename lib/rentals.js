export const tentCodes = ['SNOW-PEAK', 'LANDNEST-DOME', 'VAULT-TARP', 'LANDNEST-SHELTER', 'LANDLOCK', 'SNOW-PEAK-TARP']

export function isTent(row) {
  return row.kind === 'gear' && Boolean(row.is_tent)
}

export function isRentalStay(row) {
  return row.kind === 'room' || isTent(row)
}
