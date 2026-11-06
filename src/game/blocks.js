// Block + item definitions. Block ids < 100, item ids >= 100.
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, SAND = 5, LOG = 6,
  LEAVES = 7, WATER = 8, PLANKS = 9, GLASS = 10, BRICK = 11, SNOW = 12, BEDROCK = 13,
  COAL_ORE = 14, IRON_ORE = 15, GRAVEL = 16;
export const PICKAXE = 100;
export const SWORD = 101;
export const NT = 32; // tiles in the texture atlas strip

// tex = [top, side, bottom] tile indices in the atlas
export const BLOCKS = [];
function def(id, name, tex, opts = {}) {
  BLOCKS[id] = { id, name, tex: Array.isArray(tex) ? tex : [tex, tex, tex], ...opts };
}
def(GRASS, 'Grass Block', [0, 1, 2], { drop: DIRT });
def(DIRT, 'Dirt', 2);
def(STONE, 'Stone', 3, { drop: COBBLE });
def(COBBLE, 'Cobblestone', 4);
def(SAND, 'Sand', 5);
def(LOG, 'Log', [7, 6, 7]);
def(LEAVES, 'Leaves', 8, { cutout: true });
def(WATER, 'Water', 9, { liquid: true });
def(PLANKS, 'Planks', 10);
def(GLASS, 'Glass', 11, { cutout: true });
def(BRICK, 'Bricks', 12);
def(SNOW, 'Snowy Grass', [13, 14, 2], { drop: DIRT });
def(BEDROCK, 'Bedrock', 15, { unbreakable: true });
def(COAL_ORE, 'Coal Ore', 16);
def(IRON_ORE, 'Iron Ore', 17);
def(GRAVEL, 'Gravel', 18);

// Fast lookup tables
export const OPAQUE = new Uint8Array(256);
export const SOLID = new Uint8Array(256);
export const CUTOUT = new Uint8Array(256);
for (const b of BLOCKS) {
  if (!b) continue;
  CUTOUT[b.id] = b.cutout ? 1 : 0;
  OPAQUE[b.id] = !b.cutout && !b.liquid ? 1 : 0;
  SOLID[b.id] = b.liquid ? 0 : 1;
}

export const ITEMS = {
  [PICKAXE]: { id: PICKAXE, name: 'Pickaxe', tool: true, maxStack: 1 },
  [SWORD]: { id: SWORD, name: 'Sword', tool: true, maxStack: 1 },
};

export const isBlock = (id) => id > 0 && id < 100;
export const itemName = (id) => (id >= 100 ? ITEMS[id].name : BLOCKS[id]?.name ?? '?');
export const maxStack = (id) => (id >= 100 ? ITEMS[id].maxStack : 64);
