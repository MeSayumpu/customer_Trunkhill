export const tentCodes = ['SNOW-PEAK', 'LANDNEST-DOME', 'VAULT-TARP', 'LANDNEST-SHELTER', 'LANDLOCK', 'SNOW-PEAK-TARP']

// SQL ORDER BY for item lists (inventory aliased as i): plots, then rooms, then rentals as the rental menu shows
// them — tents/tarps before other equipment, each in the order the admin arranged.
export const itemOrder = "FIELD(i.kind,'plot','room','gear'),i.is_tent DESC,i.sort_order,i.code"

export function isTent(row) {
  return row.kind === 'gear' && Boolean(row.is_tent)
}

export function isRentalStay(row) {
  return row.kind === 'room' || isTent(row)
}
