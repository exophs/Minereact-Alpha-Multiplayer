
import { BlockType } from '../types';

const createCanvasTexture = (
  color: string, 
  noiseFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);

  noiseFn(ctx, 64, 64);

  return canvas.toDataURL();
};

const simpleNoise = (amount: number, alpha: number = 0.1) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = Math.random() * 4 + 1;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    if (Math.random() > 0.5) ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }
};

const plankPattern = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 1; i < 4; i++) {
    ctx.fillRect(0, (h / 4) * i, w, 2);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * w;
    const y = (h / 4) * i;
    ctx.fillRect(x, y, 2, h/4);
  }
  simpleNoise(100, 0.05)(ctx, w, h);
};

const brickPattern = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.fillStyle = 'rgba(0,0,0,0.3)';
   for (let i = 1; i < 4; i++) {
       ctx.fillRect(0, (h/4)*i, w, 2);
   }
   for (let row=0; row<4; row++) {
       const offset = (row % 2) * (w/2);
       ctx.fillRect(offset + w/2 - 1, row*(h/4), 2, h/4);
   }
   simpleNoise(200, 0.1)(ctx, w, h);
}

const craftingTableTop = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    plankPattern(ctx, w, h);
    // Add tools drawing on top
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 10, 10, 44); // Saw
    ctx.fillRect(30, 10, 24, 10); // Hammer head
    ctx.fillRect(40, 20, 4, 34);  // Hammer handle
};

export const textures: Record<string, string> = {
  dirt: createCanvasTexture('#6d4e34', simpleNoise(400, 0.15)),
  grass_top: createCanvasTexture('#54ad40', simpleNoise(300, 0.1)),
  grass_side: (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    ctx.fillStyle = '#6d4e34';
    ctx.fillRect(0, 0, 64, 64);
    simpleNoise(300, 0.1)(ctx, 64, 64);
    
    ctx.fillStyle = '#54ad40';
    ctx.fillRect(0, 0, 64, 20); 
    
    for(let i=0; i<64; i+=4) {
        if(Math.random() > 0.5) {
            ctx.fillRect(i, 20, 4, Math.random() * 10);
        }
    }
    return canvas.toDataURL();
  })(),
  stone: createCanvasTexture('#7d7d7d', simpleNoise(500, 0.15)),
  wood: createCanvasTexture('#5c4033', (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for(let i=0; i<20; i++) {
          ctx.fillRect(Math.random()*w, 0, Math.random()*4, h);
      }
      simpleNoise(100)(ctx, w, h);
  }),
  leaves: createCanvasTexture('#3a7a3a', simpleNoise(600, 0.2)),
  planks: createCanvasTexture('#a07850', plankPattern),
  cobblestone: createCanvasTexture('#606060', brickPattern),
  sand: createCanvasTexture('#d6cf96', simpleNoise(600, 0.1)),
  glass: createCanvasTexture('#ffffff', (ctx, w, h) => {
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = 'rgba(200,250,255,0.3)';
      ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = '#aaddff';
      ctx.lineWidth = 4;
      ctx.strokeRect(0,0,w,h);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(10, 54);
      ctx.lineTo(20, 54);
      ctx.lineTo(54, 20);
      ctx.lineTo(44, 20);
      ctx.fill();
  }),
  water: createCanvasTexture('rgba(40, 90, 210, 0.65)', (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for(let i=0; i<20; i++) {
          ctx.fillRect(Math.random()*w, Math.random()*h, 10, 2);
      }
  }),
  stick: createCanvasTexture('rgba(0,0,0,0)', (ctx, w, h) => {
      ctx.fillStyle = '#5c4033';
      ctx.translate(w/2, h/2);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -28, 8, 56);
      ctx.setTransform(1,0,0,1,0,0);
  }),
  coal: createCanvasTexture('rgba(0,0,0,0)', (ctx, w, h) => {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(32, 32, 20, 0, Math.PI*2);
      ctx.fill();
      simpleNoise(50, 0.3)(ctx, w, h);
  }),
  torch: createCanvasTexture('rgba(0,0,0,0)', (ctx, w, h) => {
      // Stick part
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(28, 24, 8, 40);
      // Fire part
      ctx.fillStyle = '#FFDD00';
      ctx.fillRect(28, 10, 8, 14);
      ctx.fillStyle = '#FF4400';
      ctx.fillRect(30, 14, 4, 6);
  }),
  crafting_table_top: createCanvasTexture('#a07850', craftingTableTop),
  crafting_table_side: createCanvasTexture('#a07850', (ctx, w, h) => {
       plankPattern(ctx,w,h);
       ctx.fillStyle = '#333';
       ctx.fillRect(10, 10, 44, 44);
       ctx.fillStyle = '#555';
       ctx.fillRect(14, 14, 36, 36);
  }),
  bedrock: createCanvasTexture('#333333', (ctx, w, h) => {
      ctx.fillStyle = '#555';
      ctx.fillRect(0,0,w,h);
      // High contrast noise
      simpleNoise(800, 0.4)(ctx, w, h);
      simpleNoise(200, 0.6)(ctx, w, h);
  }),
  skin: createCanvasTexture('#b98e72', simpleNoise(100, 0.05)),
  shirt: createCanvasTexture('#0088AA', simpleNoise(100, 0.1)),
  pants: createCanvasTexture('#333399', simpleNoise(100, 0.1)),
};

export const getTextureForBlock = (type: BlockType): { map: string, mapSide?: string, mapTop?: string, mapBottom?: string } => {
    switch (type) {
        case BlockType.grass:
            return { map: textures.grass_side, mapTop: textures.grass_top, mapBottom: textures.dirt, mapSide: textures.grass_side };
        case BlockType.dirt: return { map: textures.dirt };
        case BlockType.stone: return { map: textures.stone };
        case BlockType.wood: return { map: textures.wood, mapTop: textures.wood, mapBottom: textures.wood };
        case BlockType.leaves: return { map: textures.leaves };
        case BlockType.planks: return { map: textures.planks };
        case BlockType.cobblestone: return { map: textures.cobblestone };
        case BlockType.sand: return { map: textures.sand };
        case BlockType.glass: return { map: textures.glass };
        case BlockType.water: return { map: textures.water };
        case BlockType.stick: return { map: textures.stick };
        case BlockType.coal: return { map: textures.coal };
        case BlockType.torch: return { map: textures.torch };
        case BlockType.crafting_table: return { 
            map: textures.crafting_table_side, 
            mapTop: textures.crafting_table_top, 
            mapBottom: textures.planks 
        };
        case BlockType.bedrock: return { map: textures.bedrock };
        default: return { map: textures.dirt };
    }
}
