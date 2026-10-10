import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeFilterState,encodeFilterState} from '../filter-url.mjs';
const context={genres:['Fantasy','Romance','Young Adult','Science Fiction','LGBTQ+','Fiction'],earliest:-750,latest:2026};
const decode=search=>decodeFilterState(search,context);

test('all saved fields survive a shared-link round trip',()=>{
 const state={q:'Le Guin & Butler',require:['Fiction'],include:['Science Fiction','LGBTQ+'],exclude:['Young Adult'],rating:4.2,ratings:400000,from:1900,to:2000,sort:'averageRating',direction:'asc'};
 assert.deepEqual(decode(encodeFilterState(state)),state);
});
test('defaults disappear while unrelated URL parameters remain',()=>{
 assert.equal(encodeFilterState(decode('rating=0&ratings=200000&from=-750&to=2026&sort=ratings&order=desc'),'utm_source=friend&rating=0'),'utm_source=friend');
 assert.equal(encodeFilterState(decode('')),'');
});
test('repeated genres remain separate, case normalizes, and duplicates are removed',()=>{
 const state=decode('require=fantasy&require=Romance&require=Fantasy&include=Science+Fiction&exclude=Missing');
 assert.deepEqual(state.require,['Fantasy','Romance']);
 assert.deepEqual(state.include,['Science Fiction']);
 assert.deepEqual(state.exclude,[]);
});
test('conflicting genre rules resolve to one rule per genre',()=>{
 const state=decode('require=Fiction&include=Fiction&exclude=Fiction');
 assert.deepEqual(state.exclude,['Fiction']);assert.deepEqual(state.require,[]);assert.deepEqual(state.include,[]);
});
test('invalid ratings, thresholds, years, and sorting fall back safely',()=>{
 const state=decode('rating=Infinity&ratings=250000&from=-751&to=2e3&sort=constructor&order=sideways');
 assert.equal(state.rating,0);assert.equal(state.ratings,200000);assert.equal(state.from,null);assert.equal(state.to,null);assert.equal(state.sort,'ratingsCount');assert.equal(state.direction,'desc');
 assert.equal(decode('rating=-1').rating,0);assert.equal(decode('rating=6').rating,0);
 assert.equal(decode('rating=4.24').rating,4.2);
});
test('BCE years work; reversed ranges are ignored',()=>{
 assert.equal(decode('from=-500&to=0').from,-500);assert.equal(decode('from=-500&to=0').to,0);
 assert.equal(decode('from=2000&to=1900').from,null);assert.equal(decode('from=2000&to=1900').to,null);
});
test('every table sort and direction round-trips',()=>{
 for(const sort of ['ratings','rating','reviews','year','title','author','genre'])for(const order of ['asc','desc']){
  const state=decode(`sort=${sort}&order=${order}`);assert.deepEqual(decode(encodeFilterState(state)),state);
 }
});
test('removing the last filter produces a clean URL',()=>{
 const state=decode('exclude=Young+Adult');state.exclude=[];assert.equal(encodeFilterState(state,'exclude=Young+Adult'),'');
});
