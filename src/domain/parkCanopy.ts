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
  {id:'t1',x:-270,y:-210,s:.9},
  {id:'t2',x:310,y:-75,s:1.15},
  {id:'t3',x:-315,y:320,s:1.05},
  {id:'t4',x:280,y:370,s:.85},
];
/** Crown ellipse in a tree's own coordinates (inside the drawn crown). */
export const CROWN={cx:4,cy:-86,rx:100,ry:70} as const;
/** Which canopy a park point stands on (world units, `unit` = park scale), or null. */
export const canopyAt=(px:number,py:number,unit:number):string|null=>{
  for(const t of TREES){
    const k=t.s*unit,dx=(px-t.x*unit)/k-CROWN.cx,dy=(py-t.y*unit)/k-CROWN.cy;
    if((dx/CROWN.rx)**2+(dy/CROWN.ry)**2<1)return t.id;
  }
  return null;
};
