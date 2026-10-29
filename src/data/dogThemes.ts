import type { CSSProperties } from 'react';
interface Theme {name:string;plate:number;ground:string;paper:string;field:string;line:string;ink:string;muted:string;action:string;}
export const DOG_THEMES:Record<string,Theme>={
 'expo-2021':{name:'Forest guardian',plate:294,ground:'#f4f3e4',paper:'#fbfaee',field:'#e1e9d5',line:'#bbc6a9',ink:'#294434',muted:'#526449',action:'#386344'},
 'mali-2022':{name:'Rose companion',plate:55,ground:'#faeeee',paper:'#fff8f5',field:'#f0d9dd',line:'#d9b8bf',ink:'#653b49',muted:'#795760',action:'#945166'},
 'oreo-frenchie':{name:'Lemon explorer',plate:60,ground:'#faf5d9',paper:'#fffbee',field:'#deebed',line:'#b3c4c5',ink:'#24495d',muted:'#506770',action:'#275c73'},
 'paolo-pug':{name:'Biscuit dreamer',plate:11,ground:'#f6eddb',paper:'#fff8ec',field:'#eadbc0',line:'#ccbaa0',ink:'#614c37',muted:'#77624e',action:'#845a2f'},
 'shiba-chai':{name:'Quiet devotion',plate:50,ground:'#f3edf4',paper:'#fdf8f4',field:'#e9e0ed',line:'#cbb9cf',ink:'#563b60',muted:'#725d79',action:'#79527f'},
};
export function dogTheme(id:string):CSSProperties{
 const t=DOG_THEMES[id]||DOG_THEMES['expo-2021'];
 return {'--bg-main':t.ground,'--bg-surface':t.paper,'--bg-elevated':t.ground,'--stage-ground':t.field,'--border-dim':t.line,'--border-strong':t.muted,'--text-main':t.ink,'--text-muted':t.muted,'--text-faint':t.muted,'--accent':t.action,'--accent-hover':t.ink,'--accent-ink':t.paper,'--accent-faint':t.field,'--accent-border':t.line} as CSSProperties;
}
