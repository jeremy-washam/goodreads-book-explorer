const sortFields={ratings:'ratingsCount',rating:'averageRating',reviews:'reviewsCount',year:'publicationYear',title:'title',author:'author',genre:'genre'};
const parameters=['q','require','include','exclude','rating','ratings','from','to','sort','order'];
const thresholds=new Set([200000,300000,400000,500000,1000000,2000000,5000000]);
export const defaultDirection=sort=>['title','author','genre'].includes(sort)?'asc':'desc';

export function decodeFilterState(search,{genres=[],earliest,latest}={}){
 const params=new URLSearchParams(search),lookup=new Map(genres.map(g=>[g.toLowerCase(),g]));
 const chosen=new Set();
 const readGenres=key=>[...new Set(params.getAll(key).map(g=>lookup.get(g.trim().toLowerCase())).filter(Boolean))].filter(g=>{
  if(chosen.has(g))return false;chosen.add(g);return true;
 });
 // Each genre has one rule, as in the UI. Exclude wins ambiguous links.
 const exclude=readGenres('exclude'),require=readGenres('require'),include=readGenres('include');
 const numeric=key=>{const raw=params.get(key);return raw!==null&&raw.trim()!==''&&Number.isFinite(Number(raw))?Number(raw):null;};
 const rawRating=numeric('rating'),rawCount=numeric('ratings');
 const rating=rawRating!==null&&rawRating>=0&&rawRating<=5?Math.round(rawRating*10)/10:0;
 const ratings=thresholds.has(rawCount)?rawCount:200000;
 const readYear=key=>{const raw=params.get(key);if(raw===null||!/^[-]?\d+$/.test(raw))return null;const year=Number(raw);return Number.isSafeInteger(year)&&year>=earliest&&year<=latest?year:null;};
 let from=readYear('from'),to=readYear('to');
 if(from!==null&&to!==null&&from>to){from=null;to=null;}
 if(from===earliest)from=null;if(to===latest)to=null;
 const sort=Object.hasOwn(sortFields,params.get('sort'))?sortFields[params.get('sort')]:'ratingsCount';
 const direction=['asc','desc'].includes(params.get('order'))?params.get('order'):defaultDirection(sort);
 return {q:params.get('q')||'',require,include,exclude,rating,ratings,from,to,sort,direction};
}

export function encodeFilterState(state,search=''){
 const params=new URLSearchParams(search);
 parameters.forEach(key=>params.delete(key));
 if(state.q.trim())params.set('q',state.q);
 for(const key of ['require','include','exclude'])[...new Set(state[key])].forEach(g=>params.append(key,g));
 if(state.rating>0)params.set('rating',String(state.rating));
 if(state.ratings!==200000)params.set('ratings',String(state.ratings));
 if(state.from!==null)params.set('from',String(state.from));
 if(state.to!==null)params.set('to',String(state.to));
 const sort=Object.entries(sortFields).find(([,field])=>field===state.sort)?.[0]||'ratings';
 if(sort!=='ratings')params.set('sort',sort);
 if(state.direction!==defaultDirection(state.sort))params.set('order',state.direction);
 return params.toString();
}
