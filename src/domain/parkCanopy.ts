/**
 * Tree canopies are elevated, walkable platforms in the flat 2D park: a dog
 * standing on one draws above ground dogs and casts no grass shadow or paw dots.
 *
 * The platform is the drawn CROWN, not the ground shadow: in a tree's own
 * coordinates the crown spans about x -113..121, y -169..-4, so the walkable
 * ellipse is centred on it and kept inside it. A test reads the scenery and
 * fails if the trees or the crown drift from these numbers.
 */
export const TREES:readonly {id:string;x:number;y:number;s:number}[]=[
  {id:'t1',x:-270,y:-210,s:1.1},
  {id:'t2',x:310,y:-75,s:1.4},
  {id:'t3',x:-315,y:320,s:1.2},
  {id:'t4',x:280,y:370,s:1.0},
];
/** Crown ellipse in a tree's own coordinates (inside the drawn crown). */
export const CROWN={cx:4,cy:-86,rx:100,ry:70} as const;
/** Leaving a canopy takes a slightly larger rim than entering one, so a dog
 * pausing on the edge keeps its state instead of flipping every frame (which
 * would strobe render order, paw dots and grass shadow). A fixed margin alone
 * only moves the flip point; the memory (`current`) is what stops it. */
export const CANOPY_HYSTERESIS=0.06;
/** Which canopy a park point stands on (world units, `unit` = park scale), or
 * null. Pass the canopy the dog was on last frame as `current` to get hysteresis. */
export const canopyAt=(px:number,py:number,unit:number,current:string|null=null):string|null=>{
  for(const t of TREES){
    const k=t.s*unit,dx=(px-t.x*unit)/k-CROWN.cx,dy=(py-t.y*unit)/k-CROWN.cy;
    if((dx/CROWN.rx)**2+(dy/CROWN.ry)**2<(t.id===current?1+CANOPY_HYSTERESIS:1))return t.id;
  }
  return null;
};
