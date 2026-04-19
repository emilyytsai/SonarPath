export const PORTS: Record<string, { name: string; coords: [number, number]; isGreen: boolean; portFeeUSD: number }> = {
  'san-francisco': { name: 'San Francisco', coords: [-122.4194, 37.8044], isGreen: true,  portFeeUSD: 18000 },
  'long-beach':    { name: 'Long Beach',    coords: [-118.2174, 33.7546], isGreen: false, portFeeUSD: 24000 },
  'san-diego':     { name: 'San Diego',     coords: [-117.1700, 32.7338], isGreen: false, portFeeUSD: 20000 },
  'astoria':       { name: 'Astoria, OR',   coords: [-123.8313, 46.1879], isGreen: true,  portFeeUSD: 12000 },
}
