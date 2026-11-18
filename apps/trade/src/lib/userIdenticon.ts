export interface IdenticonCell {
  x: number;
  y: number;
  opacity: number;
}

export interface IdenticonPattern {
  palette: number;
  cells: IdenticonCell[];
}

const PIXEL_OPACITIES = [1, 0.76, 0.54] as const;

export function createIdenticon(identity: string): IdenticonPattern {
  const normalized = identity.trim().toLowerCase() || "user";
  let seed = 2_166_136_261;

  for (const character of normalized) {
    seed = Math.imul(seed ^ (character.codePointAt(0) ?? 0), 16_777_619);
  }
  seed >>>= 0;

  let state = seed || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
  const cells: IdenticonCell[] = [];

  for (let y = 0; y < 8; y += 1) {
    let rowFilled = false;

    for (let x = 0; x < 4; x += 1) {
      if (random() < 0.42) continue;

      const opacity = PIXEL_OPACITIES[Math.floor(random() * PIXEL_OPACITIES.length)];
      cells.push({ x, y, opacity }, { x: 7 - x, y, opacity });
      rowFilled = true;
    }

    if (!rowFilled) {
      const x = Math.floor(random() * 4);
      const opacity = PIXEL_OPACITIES[Math.floor(random() * PIXEL_OPACITIES.length)];
      cells.push({ x, y, opacity }, { x: 7 - x, y, opacity });
    }
  }

  return { palette: seed % 4, cells };
}
