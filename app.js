'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const number=new Intl.NumberFormat('en-US'), compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const state={books:[],genres:[],selected:new Set(),required:new Set(),excluded:new Set(),type:'all',checkedDate:'2026-10-05',sort:'ratingsCount',direction:'desc'};
// Hidden genre labels apply only to the current page.
const hiddenGenres=new Set();
try{localStorage.removeItem('goodreads-hidden-genres-v1')}catch{}
const visibleGenres=b=>(b.genres||[]).filter(g=>!hiddenGenres.has(g));
const fallback='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="135"><rect width="90" height="135" fill="#dde3d5"/><path d="M10 0v135M20 20h50M20 115h50" stroke="#b3bea4"/><path d="M32 48h29v39H32zM46 48v39" stroke="#7e906e" fill="none"/></svg>');
const safeURL=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'#';}catch{return '#'}};
const cover=b=>`<img class="cover" src="${esc(b.cover?safeURL(b.cover):fallback)}" alt="" loading="lazy" decoding="async">`;
const genresHTML=(b,all=false)=>{const g=visibleGenres(b);return g.slice(0,all?g.length:2).map(x=>`<span class="genre-pill">${esc(x)}</span>`).join('')+(!all&&g.length>2?`<span class="genre-extra">+${g.length-2}</span>`:'')};
function bookType(b){if(b.genres.includes('Nonfiction'))return 'nonfiction';return b.genres.some(g=>['Fiction','Romance','Fantasy','Science Fiction','Historical Fiction','Literary Fiction','Mystery','Thriller'].includes(g))?'fiction':'unknown';}
let publicationYears=[],yearBounds={min:null,max:null};
const formatYear=year=>year<0?`${Math.abs(year)} BCE`:String(year);
function yearRange(){return {...yearBounds,active:yearBounds.min!==null||yearBounds.max!==null}}
function yearLabel(){const {min,max}=yearRange();return min!==null&&max!==null?`${formatYear(min)}–${formatYear(max)}`:min!==null?`${formatYear(min)} onward`:max!==null?`Through ${formatYear(max)}`:''}
function yearInputError(message=''){
 $('year-error').textContent=message;
 ['year-min','year-max'].forEach(id=>$(id).setAttribute('aria-invalid',String(Boolean(message))));
 updateResetButton();
}
function rebuildYearScale(){
 publicationYears=[...new Set([...state.books.map(b=>b.publicationYear),yearBounds.min,yearBounds.max].filter(Number.isInteger))].sort((a,b)=>a-b);
 ['year-from','year-to'].forEach(id=>$(id).max=String(Math.max(1,publicationYears.length-1)));
}
function renderYearSlider(){
 yearInputError();
 const last=Math.max(1,publicationYears.length-1),from=yearBounds.min===null?0:publicationYears.indexOf(yearBounds.min),to=yearBounds.max===null?last:publicationYears.indexOf(yearBounds.max);
 $('year-from').value=String(from);$('year-to').value=String(to);
 $('year-min').value=String(yearBounds.min??publicationYears[0]);$('year-max').value=String(yearBounds.max??publicationYears[publicationYears.length-1]);
 $('year-from').setAttribute('aria-valuetext',formatYear(yearBounds.min??publicationYears[0]));
 $('year-to').setAttribute('aria-valuetext',formatYear(yearBounds.max??publicationYears[publicationYears.length-1]));
 $('year-selection').style.left=`${100*from/last}%`;$('year-selection').style.right=`${100*(last-to)/last}%`;
}
function clearYears(){yearBounds={min:null,max:null};yearInputError();rebuildYearScale()}
function setYearHandle(id,value){
 const year=publicationYears[value];if(year===undefined)return;
 if(id==='year-from')yearBounds.min=value===0?null:Math.min(year,yearBounds.max??Infinity);
 else yearBounds.max=value===publicationYears.length-1?null:Math.max(year,yearBounds.min??-Infinity);
 yearInputError();changed();
}
function commitYearInputs(){
 const from=$('year-min'),to=$('year-max'),recorded=state.books.map(b=>b.publicationYear).filter(Number.isInteger),earliest=Math.min(...recorded),latest=Math.max(...recorded),min=from.value===''?earliest:Number(from.value),max=to.value===''?latest:Number(to.value);
 if(from.validity.badInput||to.validity.badInput||(min!==null&&!Number.isInteger(min))||(max!==null&&!Number.isInteger(max))){yearInputError('Enter whole years.');return}
 if(min!==null&&max!==null&&min>max){yearInputError('The earliest year must be no later than the latest year.');return}
 if(min<earliest||max>latest){yearInputError(`Use years from ${formatYear(earliest)} to ${formatYear(latest)}.`);return}
 yearBounds={min:min===earliest?null:min,max:max===latest?null:max};yearInputError();rebuildYearScale();changed();
}
function matchingBooks({ignoreAny=false,skipExcluded=null}={}){
 const query=norm($('search').value.trim()),minRating=Number($('min-rating').value),minCount=Number($('min-count').value),years=yearRange();
 return state.books.filter(b=>(state.type==='all'||bookType(b)===state.type)
  &&(!query||norm(`${b.title} ${b.author}`).includes(query))
  &&b.averageRating>=minRating&&b.ratingsCount>=minCount
  &&(!years.active||(b.publicationYear!=null&&(years.min===null||b.publicationYear>=years.min)&&(years.max===null||b.publicationYear<=years.max)))
  &&[...state.required].every(g=>b.genres.includes(g))
  &&![...state.excluded].some(g=>g!==skipExcluded&&b.genres.includes(g))
  &&(ignoreAny||!state.selected.size||b.genres.some(g=>state.selected.has(g))));
}
function assignPopularityRanks(books){
 const ordered=[...books].sort((a,b)=>b.ratingsCount-a.ratingsCount||a.title.localeCompare(b.title));
 ordered.forEach((book,index)=>{book.popularityRank=index>0&&book.ratingsCount===ordered[index-1].ratingsCount?ordered[index-1].popularityRank:index+1});
}
function filterBooks(){return matchingBooks().sort((a,b)=>{let x=state.sort==='genre'?(visibleGenres(a)[0]||''):a[state.sort],y=state.sort==='genre'?(visibleGenres(b)[0]||''):b[state.sort];if(x==null&&y==null)return a.title.localeCompare(b.title);if(x==null)return 1;if(y==null)return -1;const cmp=typeof x==='number'?x-y:String(x).localeCompare(String(y),undefined,{sensitivity:'base'});return (state.direction==='asc'?cmp:-cmp)||a.title.localeCompare(b.title);})}
const genreRules=[['required','Require','Match every required genre'],['selected','Include','Match at least one included genre'],['excluded','Exclude','Remove books with this genre']];
function genreRows(){
 const counts=new Map(),available=new Set(),query=norm($('genre-search').value.trim());
 matchingBooks().forEach(b=>b.genres.forEach(g=>counts.set(g,(counts.get(g)||0)+1)));
 // Keep OR alternatives available even when they are absent from current results.
 matchingBooks({ignoreAny:true}).forEach(b=>b.genres.forEach(g=>available.add(g)));
 const selected=g=>genreRules.some(([key])=>state[key].has(g));
 return [...new Set(state.books.flatMap(b=>b.genres))]
  .filter(g=>!hiddenGenres.has(g)&&(selected(g)||(available.has(g)&&norm(g).includes(query))))
  .map(g=>({genre:g,count:counts.get(g)||0}))
  .sort((a,b)=>b.count-a.count||a.genre.localeCompare(b.genre));
}
function setGenreRule(genre,key){
 const clear=state[key].has(genre);
 genreRules.forEach(([group])=>state[group].delete(genre));
 if(!clear)state[key].add(genre);
}
function renderGenres(){
 const list=$('genres'),scrollTop=list.scrollTop;
 list.innerHTML=genreRows().map(({genre:g,count})=>`<div class="genre-option"><span class="genre-name" title="${esc(g)}">${esc(g)}</span><span class="genre-count">${number.format(count)}</span><div class="genre-actions" role="group" aria-label="${esc(g)} filter">${genreRules.map(([key,label,help])=>`<button type="button" data-genre="${esc(g)}" data-rule="${key}" aria-label="${label} ${esc(g)}" aria-pressed="${state[key].has(g)}" title="${help}">${label}</button>`).join('')}</div><button type="button" class="hide-genre" data-hide-genre="${esc(g)}" aria-label="Hide ${esc(g)} label" title="Hide label">×</button></div>`).join('')||'<p class="field-note">No matching genres.</p>';
 list.scrollTop=scrollTop;
}
function recordedDate(value){const raw=value||state.checkedDate;const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T12:00:00Z':raw);return Number.isNaN(date.getTime())?recordedDate(state.checkedDate):date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'});}
function provenance(b){const date=esc(recordedDate(b.checkedAt));if(b.status==='verified')return `<p>Book page checked ${date}. Counts may include multiple editions.</p>`;const recency=b.metadataCrawlRecency;const timing=recency==='today'?'on the day of collection':recency==='yesterday'?'the day before collection':recency?`${esc(recency.replace(/ ago$/, '').replace(/^last /, '1 '))} before collection`:'at an unreported time';return `<p>Recorded ${date}. Average rating and ratings count come from the Goodreads list snapshot.</p><p>Written reviews and genres: indexed Goodreads page, crawled ${timing}. These figures may be older.</p>${b.metadataSourceUrl?`<a class="source-link" href="${esc(safeURL(b.metadataSourceUrl))}" target="_blank" rel="noopener noreferrer">Review/genre source ↗</a>`:''}`;}

function sortHeading(key,label){const active=state.sort===key;return `<button data-sort="${key}">${label}<span class="sort-indicator" aria-hidden="true">${active?(state.direction==='desc'?'↓':'↑'):'↕'}</span></button>`}
function ariaSort(key){return state.sort===key?` aria-sort="${state.direction==='desc'?'descending':'ascending'}"`:''}
function metric(v,short=false){return v==null?'<span class="missing">Unavailable</span>':esc(short?compact.format(v):number.format(v))}
function renderFilterChips(){
 const chips=genreRules.flatMap(([key,label])=>[...state[key]].map(g=>({label:`${label}: ${g}`,group:key,value:g})));
 if(yearRange().active)chips.push({label:`Published: ${yearLabel()}`,filter:'years'});
 if(Number($('min-rating').value)>0)chips.push({label:`Avg. rating: ${Number($('min-rating').value).toFixed(1)}+`,filter:'rating'});
 if(Number($('min-count').value)>200000)chips.push({label:`Ratings: ${compact.format(Number($('min-count').value))}+`,filter:'count'});
 $('active-filters').innerHTML=chips.map(c=>`<button class="filter-chip ${c.group==='excluded'?'exclude-chip':''}" ${c.group?`data-remove-group="${c.group}" data-remove-value="${esc(c.value)}"`:`data-remove-filter="${c.filter}"`} aria-label="Remove ${esc(c.label)} filter">${esc(c.label)} <span aria-hidden="true">×</span></button>`).join('');
 $('filters-open').classList.toggle('has-filters',chips.length>0);
}
let genreHelpTimer;
function hideGenreHelp(){clearTimeout(genreHelpTimer);$('genre-help-tooltip').hidden=true}
function showGenreHelp(){
 clearTimeout(genreHelpTimer);const tooltip=$('genre-help-tooltip');tooltip.hidden=false;
 const anchor=$('genre-help').getBoundingClientRect(),bounds=tooltip.getBoundingClientRect();
 tooltip.style.left=`${Math.max(12,Math.min(anchor.left,innerWidth-bounds.width-12))}px`;
 tooltip.style.top=`${anchor.bottom+8}px`;
}
const scheduleGenreHelpHide=()=>{clearTimeout(genreHelpTimer);genreHelpTimer=setTimeout(hideGenreHelp,120)};
$('genre-help').addEventListener('pointerenter',showGenreHelp);
$('genre-help').addEventListener('pointerleave',scheduleGenreHelpHide);
$('genre-help').addEventListener('focus',showGenreHelp);
$('genre-help').addEventListener('blur',scheduleGenreHelpHide);
$('genre-help').addEventListener('click',showGenreHelp);
$('genre-help-tooltip').addEventListener('pointerenter',()=>clearTimeout(genreHelpTimer));
$('genre-help-tooltip').addEventListener('pointerleave',scheduleGenreHelpHide);
function positionFilters(){
 const panel=$('filters-popover');if(panel.hidden)return;
 const anchor=$('filters-open').getBoundingClientRect(),margin=12;
 panel.style.maxHeight=`${Math.max(180,window.innerHeight-anchor.bottom-margin*2)}px`;
 panel.style.left=`${Math.max(margin,Math.min(anchor.left,window.innerWidth-panel.offsetWidth-margin))}px`;
 panel.style.top=`${anchor.bottom+8}px`;
}
function closeFilters(restoreFocus=false){
 hideGenreHelp();$('filters-popover').hidden=true;$('filters-open').setAttribute('aria-expanded','false');
 if(restoreFocus)$('filters-open').focus({preventScroll:true});
}
$('filters-open').addEventListener('click',()=>{
 const panel=$('filters-popover');if(!panel.hidden){closeFilters(true);return}
 panel.hidden=false;$('filters-open').setAttribute('aria-expanded','true');positionFilters();panel.focus({preventScroll:true});
});
$('filters-close').addEventListener('click',()=>closeFilters(true));
document.addEventListener('pointerdown',e=>{
 if(!$('filters-popover').hidden&&!e.target.closest('#filters-popover, #filters-open, dialog[open]'))closeFilters();
});
document.addEventListener('keydown',e=>{
 if($('filters-popover').hidden||document.querySelector('dialog[open]'))return;
 if(e.key==='Escape'){e.preventDefault();if(!$('genre-help-tooltip').hidden){hideGenreHelp();return}closeFilters(true)}
 if(e.key==='Tab'){
  const items=[...$('filters-popover').querySelectorAll('button:not(:disabled), input, select')].filter(el=>el.getClientRects().length);
  const first=items[0],last=items[items.length-1];
  if(document.activeElement===$('filters-popover')){e.preventDefault();(e.shiftKey?last:first)?.focus()}
  else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});
window.addEventListener('resize',()=>{hideGenreHelp();positionFilters()});$('filters-popover').addEventListener('scroll',hideGenreHelp);
function updateResetButton(){
 $('show-hidden-labels').hidden=hiddenGenres.size===0;
 $('reset').disabled=!(yearRange().active||state.selected.size||state.required.size||state.excluded.size||hiddenGenres.size||state.type!=='all'||$('search').value.trim()||$('genre-search').value.trim()||$('year-error').textContent||Number($('min-rating').value)>0||Number($('min-count').value)>200000);
}
function render(){renderYearSlider();updateResetButton();hideGenreTooltip();renderGenres();const filtered=filterBooks();$('book-results').setAttribute('aria-busy','false');$('result-count').textContent=`${number.format(filtered.length)} book${filtered.length===1?'':'s'}${filtered.length!==state.books.length?' found':''}`;const sortLabels={ratingsCount:'ratings count',reviewsCount:'written reviews',averageRating:'average rating',title:'title',author:'author',genre:'genre'};$('result-detail').textContent=`${filtered.length!==state.books.length?`Of ${number.format(state.books.length)} in the collection · `:''}Sorted by ${sortLabels[state.sort]} ${state.direction==='desc'?'↓':'↑'}`;document.querySelectorAll('[data-book-type]').forEach(button=>{const active=button.dataset.bookType===state.type;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active)});$('rating-value').textContent=Number($('min-rating').value)?`${Number($('min-rating').value).toFixed(1)}`:'Any';renderFilterChips();
mountVirtualResults(filtered);
}
const tableRow=(b,index)=>`<tr aria-rowindex="${index+1}" data-result-index="${index}"><td class="popularity-rank" aria-label="Overall popularity rank ${b.popularityRank}">${number.format(b.popularityRank)}</td><td aria-describedby="column-book"><div class="book-cell">${cover(b)}<div><a class="book-title" href="${esc(safeURL(b.url))}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a><p class="book-author">${esc(b.author)}${b.publicationYear!=null?` · ${b.publicationYear<0?Math.abs(b.publicationYear)+' BCE':b.publicationYear}`:''}</p></div></div></td><td class="genre-cell" tabindex="0" data-book-genres="${esc(visibleGenres(b).join(', '))}" aria-label="Genres: ${esc(visibleGenres(b).join(', '))}"><span class="table-genres">${esc(visibleGenres(b).join(', '))}</span></td><td class="metric avg" aria-describedby="column-averageRating">${b.averageRating.toFixed(2)}</td><td class="metric" aria-describedby="column-ratingsCount">${metric(b.ratingsCount)}</td><td class="metric" aria-describedby="column-reviewsCount">${metric(b.reviewsCount)}</td></tr>`;
let virtualBooks=[],virtualRange='',virtualFrame=0;
function mountVirtualResults(books){
 const viewport=$('book-results'),scrollTop=viewport.scrollTop;virtualBooks=books;virtualRange='';$('table-header').hidden=false;
 $('table-header').innerHTML=`<div class="table-header-scroll"><table aria-label="Sort books"><colgroup><col style="width:52px"><col style="width:calc(36% - 18.72px)"><col style="width:calc(27% - 14.04px)"><col style="width:calc(11% - 5.72px)"><col style="width:calc(13% - 6.76px)"><col style="width:calc(13% - 6.76px)"></colgroup><thead><tr><th class="rank-heading" aria-label="Overall popularity rank">Rank</th><th id="column-book"${ariaSort('title')}>${sortHeading('title','Book')} <button class="author-sort" data-sort="author" style="width:auto;margin-left:8px;font-size:11px" aria-label="Sort by author">/ Author ${state.sort==='author'?(state.direction==='asc'?'↑':'↓'):''}</button></th><th id="column-genre"${ariaSort('genre')}>${sortHeading('genre','Genre')}</th><th id="column-averageRating" class="metric"${ariaSort('averageRating')}>${sortHeading('averageRating','Avg. rating')}</th><th id="column-ratingsCount" class="metric"${ariaSort('ratingsCount')}>${sortHeading('ratingsCount','Ratings')}</th><th id="column-reviewsCount" class="metric"${ariaSort('reviewsCount')}>${sortHeading('reviewsCount','Written reviews')}</th></tr></thead></table></div>`;syncTableHeader();
 if(!books.length){viewport.innerHTML='<div class="empty-state"><h3>No books match these filters.</h3><p>Adjust your filters or search.</p><button id="empty-reset">Reset filters</button></div>';return}
 viewport.innerHTML=`<div class="table-wrap"><table aria-label="Books" aria-rowcount="${books.length}"><colgroup><col style="width:52px"><col style="width:calc(36% - 18.72px)"><col style="width:calc(27% - 14.04px)"><col style="width:calc(11% - 5.72px)"><col style="width:calc(13% - 6.76px)"><col style="width:calc(13% - 6.76px)"></colgroup><tbody id="virtual-rows"></tbody></table></div>`;
 renderVirtualResults(true,scrollTop);viewport.scrollTop=scrollTop;
}
function renderVirtualResults(force=false,scrollTop=$('book-results').scrollTop){
 if(!virtualBooks.length)return;
 const viewport=$('book-results'),columns=1,rowHeight=86;
 syncTableHeader();
 const totalRows=Math.ceil(virtualBooks.length/columns),overscan=5;
 const firstRow=Math.max(0,Math.min(totalRows-1,Math.floor(Math.max(0,scrollTop)/rowHeight))-overscan);
 const endRow=Math.min(totalRows,firstRow+Math.ceil(viewport.clientHeight/rowHeight)+overscan*2);
 const start=firstRow*columns,end=Math.min(virtualBooks.length,endRow*columns),key=[start,end,rowHeight].join(':');
 if(!force&&key===virtualRange)return;virtualRange=key;hideGenreTooltip();
 const focused=document.activeElement,focusIndex=focused?.closest('[data-result-index]')?.dataset.resultIndex,focusSelector=focused?.matches('.book-title')?'.book-title':focused?.matches('[data-book-genres]')?'[data-book-genres]':null;
 const books=virtualBooks.slice(start,end),top=firstRow*rowHeight,bottom=(totalRows-endRow)*rowHeight;
 const spacer=h=>h?`<tr class="virtual-spacer" aria-hidden="true" style="height:${h}px"><td colspan="6" style="height:${h}px"></td></tr>`:'';$('virtual-rows').innerHTML=spacer(top)+books.map((b,i)=>tableRow(b,start+i)).join('')+spacer(bottom);
 viewport.querySelectorAll('img.cover').forEach(img=>img.addEventListener('error',()=>{img.src=fallback},{once:true}));updateGenreOverflow();
 if(focusIndex!=null&&focusSelector)viewport.querySelector(`[data-result-index="${focusIndex}"] ${focusSelector}`)?.focus({preventScroll:true});
}
function syncTableHeader(){
 const header=document.querySelector('.table-header-scroll');if(!header)return;
 const viewport=$('book-results'),available=Math.max(722,viewport.clientWidth)-52,widths=[52,...[.36,.27,.11,.13,.13].map(fraction=>fraction*available)];
 document.querySelectorAll('.table-header colgroup,.table-wrap colgroup').forEach(group=>[...group.children].forEach((col,index)=>col.style.width=widths[index]+'px'));
 header.style.width=viewport.clientWidth+'px';header.scrollLeft=viewport.scrollLeft;
}
function scheduleVirtualRender(){syncTableHeader();if(!virtualFrame)virtualFrame=requestAnimationFrame(()=>{virtualFrame=0;renderVirtualResults()})}
$('book-results').addEventListener('scroll',scheduleVirtualRender,{passive:true});
$('book-results').addEventListener('keydown',e=>{if(e.target!==e.currentTarget)return;const viewport=e.currentTarget;if(e.key==='Home'||e.key==='End'){e.preventDefault();viewport.scrollTop=e.key==='Home'?0:viewport.scrollHeight}else if(e.key==='PageDown'||e.key==='PageUp'){e.preventDefault();viewport.scrollTop+=(e.key==='PageDown'?1:-1)*viewport.clientHeight}});
new ResizeObserver(scheduleVirtualRender).observe($('book-results'));
function changed(){$('book-results').scrollTop=0;render()}
function reset(){hiddenGenres.clear();state.type='all';$('genre-search').value='';state.required.clear();state.selected.clear();state.excluded.clear();$('search').value='';$('min-rating').value='0';$('min-count').value='200000';clearYears();changed()}
function details(id){const b=state.books.find(x=>String(x.id)===String(id));if(!b)return;const sources=(b.sources||[]).map(s=>typeof s==='string'?s:s.url).filter(Boolean);$('details-content').innerHTML=`<div class="dialog-heading">${cover(b)}<div><h2>${esc(b.title)}</h2><p>${esc(b.author)}${b.publicationYear!=null?` · ${b.publicationYear<0?Math.abs(b.publicationYear)+' BCE':b.publicationYear}`:''}</p></div></div><div>${genresHTML(b,true)}</div><div class="detail-metrics"><div><strong>${b.averageRating.toFixed(2)}</strong><span>Average rating / 5</span></div><div><strong>${metric(b.ratingsCount)}</strong><span>Star ratings</span></div><div><strong>${metric(b.reviewsCount)}</strong><span>Written reviews</span></div></div>${provenance(b)}<a class="source-link" href="${esc(safeURL(b.url))}" target="_blank" rel="noopener noreferrer">View on Goodreads ↗</a>${sources.filter(s=>s!==b.url).length?`<p>Additional sources: ${sources.filter(s=>s!==b.url).map((s,i)=>`<a href="${esc(safeURL(s))}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a>`).join(' · ')}</p>`:''}`;$('details-content').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.src=fallback},{once:true}));$('details-dialog').showModal();}
const genreTooltip=$('genre-tooltip');
let tooltipTarget=null,tooltipTimer;
function hideGenreTooltip(){clearTimeout(tooltipTimer);genreTooltip.hidden=true;tooltipTarget?.removeAttribute('aria-describedby');tooltipTarget=null;}
function genreIsTruncated(target){
 const text=target.querySelector('.table-genres');
 if(text)return text.scrollHeight>text.clientHeight+1||text.scrollWidth>text.clientWidth+1;
 if(target.querySelector('.genre-extra'))return true;
 const bounds=target.getBoundingClientRect();
 return [...target.children].some(child=>{const rect=child.getBoundingClientRect();return child.scrollWidth>child.clientWidth+1||rect.bottom>bounds.bottom+1||rect.right>bounds.right+1});
}
function updateGenreOverflow(){document.querySelectorAll('[data-book-genres]').forEach(target=>{const truncated=genreIsTruncated(target);target.classList.toggle('genres-truncated',truncated);target.tabIndex=truncated?0:-1})}
function showGenreTooltip(target){
 hideGenreTooltip();if(!genreIsTruncated(target))return;tooltipTarget=target;genreTooltip.textContent=target.dataset.bookGenres;
 target.setAttribute('aria-describedby','genre-tooltip');genreTooltip.hidden=false;
 const rect=target.getBoundingClientRect(),tip=genreTooltip.getBoundingClientRect();
 const left=Math.max(8,Math.min(rect.left,innerWidth-tip.width-8));
 const top=rect.bottom+6+tip.height<=innerHeight-8?rect.bottom+6:Math.max(8,rect.top-tip.height-6);
 genreTooltip.style.left=left+'px';genreTooltip.style.top=top+'px';
}
function scheduleTooltipHide(){clearTimeout(tooltipTimer);tooltipTimer=setTimeout(hideGenreTooltip,120);}
$('book-results').addEventListener('pointerover',e=>{const target=e.target.closest('[data-book-genres]');if(target&&target!==tooltipTarget)showGenreTooltip(target)});
$('book-results').addEventListener('pointerout',e=>{const target=e.target.closest('[data-book-genres]');if(target&&!target.contains(e.relatedTarget)&&!genreTooltip.contains(e.relatedTarget))scheduleTooltipHide()});
$('book-results').addEventListener('focusin',e=>{const target=e.target.closest('[data-book-genres]');if(target)showGenreTooltip(target)});
$('book-results').addEventListener('focusout',scheduleTooltipHide);
genreTooltip.addEventListener('pointerenter',()=>clearTimeout(tooltipTimer));
genreTooltip.addEventListener('pointerleave',scheduleTooltipHide);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideGenreTooltip()});
window.addEventListener('scroll',hideGenreTooltip,true);window.addEventListener('resize',()=>{hideGenreTooltip();updateGenreOverflow()});
$('genres').addEventListener('click',e=>{
 const button=e.target.closest('[data-hide-genre]');if(!button)return;
 hiddenGenres.add(button.dataset.hideGenre);render();$('genre-search').focus({preventScroll:true});
});
$('genre-search').addEventListener('input',()=>{renderGenres();updateResetButton()});
$('genres').addEventListener('click',e=>{
 const button=e.target.closest('[data-rule]');if(!button)return;
 const {genre,rule}=button.dataset;setGenreRule(genre,rule);changed();
 [...$('genres').querySelectorAll('[data-rule]')].find(b=>b.dataset.genre===genre&&b.dataset.rule===rule)?.focus({preventScroll:true});
});
['search','min-rating','min-count'].forEach(id=>$(id).addEventListener('input',changed));
['year-min','year-max'].forEach(id=>{$(id).addEventListener('change',commitYearInputs);$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitYearInputs()}})});
['year-from','year-to'].forEach(id=>$(id).addEventListener('input',()=>setYearHandle(id,Number($(id).value))));
// Clicking the track moves the nearest handle; dragging and keyboard input also work.
let yearDrag=null;
function yearAtPointer(e){const r=$('year-slider').getBoundingClientRect();return Math.round(Math.max(0,Math.min(1,(e.clientX-r.left-10)/(r.width-20)))*Math.max(1,publicationYears.length-1))}
$('year-slider').addEventListener('pointerdown',e=>{
 if(e.target.matches('input')||e.button!==0)return;
 const value=yearAtPointer(e),from=Number($('year-from').value),to=Number($('year-to').value);
 yearDrag=Math.abs(value-from)<Math.abs(value-to)?'year-from':'year-to';
 $(yearDrag).focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);setYearHandle(yearDrag,value);e.preventDefault();
});
$('year-slider').addEventListener('pointermove',e=>{if(yearDrag)setYearHandle(yearDrag,yearAtPointer(e))});
['pointerup','pointercancel','lostpointercapture'].forEach(event=>$('year-slider').addEventListener(event,()=>{yearDrag=null}));
$('show-hidden-labels').addEventListener('click',()=>{hiddenGenres.clear();render();($('reset').disabled?$('filters-close'):$('reset')).focus({preventScroll:true})});
$('reset').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();reset()});
$('active-filters').addEventListener('click',e=>{
 const button=e.target.closest('.filter-chip');if(!button)return;
 const index=[...$('active-filters').children].indexOf(button),scrollLeft=$('active-filters').scrollLeft;
 if(button.dataset.removeGroup)state[button.dataset.removeGroup].delete(button.dataset.removeValue);
 else if(button.dataset.removeFilter==='years')clearYears();
 else if(button.dataset.removeFilter==='rating')$('min-rating').value='0';
 else if(button.dataset.removeFilter==='count')$('min-count').value='200000';
 changed();$('active-filters').scrollLeft=scrollLeft;
 ($('active-filters').children[index]||$('active-filters').lastElementChild||$('filters-open')).focus({preventScroll:true});
});
document.querySelector('.results').addEventListener('click',e=>{const sort=e.target.closest('[data-sort]');if(sort){const key=sort.dataset.sort;state.direction=state.sort===key?(state.direction==='asc'?'desc':'asc'):(['title','author','genre'].includes(key)?'asc':'desc');state.sort=key;changed()}if(e.target.id==='empty-reset')reset()});['about-open'].forEach(id=>$(id).addEventListener('click',()=>$('about-dialog').showModal()));document.querySelectorAll('dialog').forEach(d=>{d.querySelector('.dialog-close').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}})});
function renderSources(sources){
 const thresholds={'36647':200000,'35177':500000,'35080':1000000,'103106':2000000,'117944':3000000,'143221':4000000,'143403':5000000,'148633':6000000,'164231':7000000,'179208':8000000,'201869':9000000,'225705':10000000,'230346':11000000};
 const lists=sources.map(s=>typeof s==='string'?{url:s}:s).map(s=>({...s,threshold:thresholds[s.url?.match(/goodreads\.com\/list\/show\/(\d+)/)?.[1]]})).filter(s=>s.threshold).sort((a,b)=>a.threshold-b.threshold);
 $('about-sources').innerHTML=lists.map(s=>{const label=s.threshold===200000?'200,000–499,999':s.threshold===500000?'500,000–999,999':`${number.format(s.threshold)}+`;return `<li><a target="_blank" rel="noopener noreferrer" href="${esc(safeURL(s.url))}">${label} ratings <span aria-hidden="true">↗</span></a></li>`}).join('');
}
async function load(){try{const response=await fetch('books.json',{cache:'no-store'});if(!response.ok)throw Error('Unable to load');const data=await response.json();if(!Array.isArray(data.books))throw Error('Invalid collection');state.books=data.books.map((b,i)=>({...b,id:String(b.id??b.workId??i),genres:Array.isArray(b.genres)?b.genres:[],averageRating:Number(b.averageRating),ratingsCount:Number(b.ratingsCount),publicationYear:Number.isInteger(b.publicationYear)?b.publicationYear:null,reviewsCount:b.reviewsCount==null?null:Number(b.reviewsCount)})).filter(b=>Number.isFinite(b.averageRating)&&Number.isFinite(b.ratingsCount)&&b.ratingsCount>=200000);assignPopularityRanks(state.books);clearYears();state.checkedDate=data.meta?.checkedDate||'2026-10-05';renderSources(data.meta?.sources||[]);render();}catch(error){$('book-results').setAttribute('aria-busy','false');$('result-count').textContent='Books unavailable';$('result-detail').textContent='Please try again.';$('book-results').innerHTML='<div class="empty-state"><h3>Couldn’t load books.</h3><p>Check your connection and try again.</p><button id="retry">Try again</button></div>';$('retry').addEventListener('click',load);}}
load();
