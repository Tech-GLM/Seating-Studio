'use strict';
// A teacher-only roster. Repeated names receive distinct IDs, never inferred surnames.
const RAW = {
  '9A':['Isabella','Martin','Lucia','Lucas','Matias','Alejandro','Samuel','David','Emilia','Maria Camila','Juana','Juliana','Pablo','Lorenzo','Juan Sebastian','Maria Jose','Mariana','Juan Jose','Sofia','Maria Del Rosario'],
  '9B':['Antonia','Elena','Samuel','Ana Lucia','Antonia','Santiago','Julieta','Gabriela','Jose Jacobo','Antonia','Mariana','Matías','Valentina','Juana','Salomon','Jacobo','Sofia','Jacobo','Tomas'],
  '9C':['Mariana','Sara Sofia','Juan Sebastián','Alejandro','Isabella','Jeronimo','Matias','Maria Adelaida','Belen','Isabella','Sara','Maria Antonia','Maria Jose','Juan Diego','Mariana','Pablo','Emmanuel','David','Catalina']
};
const GROUPS = Object.fromEntries(Object.entries(RAW).map(([g,names]) => {
  const totals={},seen={}; names.forEach(n => totals[n]=(totals[n]||0)+1);
  return [g,names.map((name,i) => ({id:`${g}-${i+1}`,name,label:totals[name]>1?`${name} · ${seen[name]=(seen[name]||0)+1}`:name}))];
}));
const $ = id => document.getElementById(id);
const KEY='glm-grade9-hexagonal-seating-v2', OLD_KEY='glm-grade9-hexagonal-seating-v1';
const LEGACY_POS = Array.from({length:20},(_,i)=>({x:[22,36,50,64,78][i%5],y:[29,43.5,58,72.5][Math.floor(i/5)]}));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const validInteger=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
// Row 1 is nearest the board (bottom wall). Keep desks away from door approaches.
function gridPositions(rows,cols,count,g){
  const positions=[];
  for(let row=0;row<rows&&positions.length<count;row++){
    const n=Math.min(cols,count-positions.length);
    const y=rows===1?57:76-row*53/(rows-1);
    const max=(g==='9A'&&y>68||g!=='9A'&&y<28)?69:81;
    for(let col=0;col<n;col++)positions.push({x:+(n===1?50:19+(max-19)*col/(n-1)).toFixed(2),y:+y.toFixed(2),id:null});
  }
  return positions;
}
function freshRoom(g){const count=g==='9A'?20:19;return {rows:4,cols:5,manual:false,spots:gridPositions(4,5,count,g)};}
function fresh(){return Object.fromEntries(Object.keys(GROUPS).map(g=>[g,freshRoom(g)]));}
function fromLegacy(value){
  const source=value?.seats||value,rooms=fresh();
  for(const g of Object.keys(GROUPS)){
    const seats=source?.[g],allowed=new Set(GROUPS[g].map(p=>p.id)),seen=new Set();
    if(!Array.isArray(seats)||seats.length!==20)throw Error(`Invalid old seating plan for ${g}.`);
    const count=g==='9A'||seats[19]!==null?20:19;
    rooms[g]={rows:4,cols:5,manual:true,spots:seats.slice(0,count).map((id,i)=>{
      if(id!==null&&(typeof id!=='string'||!allowed.has(id)||seen.has(id)))throw Error(`Invalid or repeated student in ${g}.`);
      if(id)seen.add(id);return {...LEGACY_POS[i],id};
    })};
  }
  return rooms;
}
function validateV2(value){
  if(!value||value.version!==2||!value.rooms||typeof value.rooms!=='object')throw Error('Not a version 2 backup.');
  const rooms={};
  for(const g of Object.keys(GROUPS)){
    const room=value.rooms[g],allowed=new Set(GROUPS[g].map(p=>p.id)),seen=new Set();
    if(!room||!validInteger(room.rows,1,8)||!validInteger(room.cols,1,8)||!Array.isArray(room.spots)||!validInteger(room.spots.length,1,40)||room.spots.length>room.rows*room.cols)throw Error(`Invalid grid for ${g}.`);
    rooms[g]={rows:room.rows,cols:room.cols,manual:Boolean(room.manual),spots:room.spots.map(spot=>{
      const id=spot?.id;
      if(!spot||typeof spot.x!=='number'||typeof spot.y!=='number'||!Number.isFinite(spot.x)||!Number.isFinite(spot.y)||spot.x<5||spot.x>95||spot.y<15||spot.y>85)throw Error(`Invalid desk coordinates for ${g}.`);
      if(id!==null&&(typeof id!=='string'||!allowed.has(id)||seen.has(id)))throw Error(`Invalid or repeated student in ${g}.`);
      if(id)seen.add(id);
      return {x:spot.x,y:spot.y,id};
    })};
  }
  return rooms;
}
let rooms=fresh(),group='9A',selected=null,dragged=null,layoutMode=false,touch=null,layoutDrag=null,skipClick=false,toastTimer,migrated=false;
try{
  const saved=localStorage.getItem(KEY);
  if(saved)rooms=validateV2(JSON.parse(saved));
  else {const previous=localStorage.getItem(OLD_KEY);if(previous){rooms=fromLegacy(JSON.parse(previous));migrated=true;localStorage.setItem(KEY,JSON.stringify({version:2,rooms}));}}
}catch(error){console.warn('Could not restore seating plan:',error);}
function toast(message){const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3500);}
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:2,rooms}));}catch(error){toast('Browser storage unavailable. Export a backup before closing.');}}
function person(id){return GROUPS[group].find(p=>p.id===id)||null;}
function seatOf(id){return rooms[group].spots.findIndex(s=>s.id===id);}
function clearSelection(){selected=null;render();}
function unseat(id){const index=seatOf(id);if(index<0)return;rooms[group].spots[index].id=null;selected=null;save();render();toast('Student returned to the roster.');}
function assign(id,index){
  if(layoutMode||!person(id)||!Number.isInteger(index)||index<0||index>=rooms[group].spots.length)return;
  const spots=rooms[group].spots,origin=seatOf(id),replaced=spots[index].id;
  if(origin===index){clearSelection();return;}
  if(origin>=0)spots[origin].id=replaced||null;
  spots[index].id=id;selected=null;save();render();
  toast(replaced?`${person(id).label} and ${person(replaced).label} swapped spots.`:`${person(id).label} placed at spot ${index+1}.`);
}
function deskClick(index){
  if(layoutMode){toast('Drag a spot to move it. Switch off Move desks to assign names.');return;}
  const occupant=rooms[group].spots[index].id;
  if(selected){if(selected===occupant)clearSelection();else assign(selected,index);}
  else if(occupant){selected=occupant;render();}else toast('Choose a name from the roster first.');
}
function endDrag(){dragged=null;document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));}
function startDrag(e,id){if(layoutMode||!id){e.preventDefault();return;}dragged=id;e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';}
function setupStudentTouch(el,id){
  el.addEventListener('pointerdown',e=>{if(layoutMode||e.pointerType==='mouse'||!e.isPrimary)return;touch={id,el,pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false,ghost:null};});
  el.addEventListener('pointermove',e=>{
    const d=touch;if(!d||d.el!==el||d.pointer!==e.pointerId)return;
    if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>9){d.moved=true;d.ghost=document.createElement('div');d.ghost.className='touch-ghost';d.ghost.textContent=person(id)?.label||'Student';document.body.append(d.ghost);el.setPointerCapture(e.pointerId);}
    if(d.moved){e.preventDefault();d.ghost.style.left=`${e.clientX+15}px`;d.ghost.style.top=`${e.clientY-20}px`;document.querySelectorAll('.drop-target').forEach(node=>node.classList.remove('drop-target'));document.elementFromPoint(e.clientX,e.clientY)?.closest('.desk')?.classList.add('drop-target');}
  },{passive:false});
  el.addEventListener('pointerup',e=>{
    const d=touch;if(!d||d.el!==el||d.pointer!==e.pointerId)return;
    if(d.moved){const target=document.elementFromPoint(e.clientX,e.clientY),dest=target?.closest('.desk');skipClick=true;
      if(dest)assign(id,Number(dest.dataset.seat));else if(target?.closest('#roster')&&seatOf(id)>=0)unseat(id);else render();setTimeout(()=>skipClick=false,0);
    }
    finishStudentTouch();
  });
  el.addEventListener('pointercancel',finishStudentTouch);
}
function finishStudentTouch(){touch?.ghost?.remove();touch=null;endDrag();}
// Manual spot movement uses pointer events, so mouse, touchscreen and stylus work alike.
function constrain(x,y){
  y=clamp(y,19,81);
  const left=(y<=50?25-y/2:y/2-25)+7;
  x=clamp(x,left,100-left);
  if((group==='9A'&&y>68)||(group!=='9A'&&y<28))x=Math.min(x,69);
  return {x:+x.toFixed(2),y:+y.toFixed(2)};
}
function collides(index,next){
  const room=rooms[group],dx=Math.min(11.2,68/room.cols)*.85,dy=Math.min(9.6,52/room.rows)*.85;
  return room.spots.some((spot,i)=>i!==index&&Math.abs(spot.x-next.x)<dx&&Math.abs(spot.y-next.y)<dy);
}
function moveSpot(index,next){
  next=constrain(next.x,next.y);
  if(collides(index,next)){toast('Spots would overlap. Try another position.');return false;}
  Object.assign(rooms[group].spots[index],next);rooms[group].manual=true;save();return true;
}
function setupLayoutDrag(button,index){
  button.addEventListener('pointerdown',e=>{
    if(!layoutMode||!e.isPrimary||e.button!==0)return;
    e.preventDefault();const p=rooms[group].spots[index];layoutDrag={button,index,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,origin:{x:p.x,y:p.y},next:{x:p.x,y:p.y},moved:false};
    button.setPointerCapture(e.pointerId);
  });
  button.addEventListener('pointermove',e=>{
    const d=layoutDrag;if(!d||d.button!==button||d.pointer!==e.pointerId)return;
    const bounds=$('room').getBoundingClientRect();if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>3)d.moved=true;
    if(!d.moved)return;
    e.preventDefault();d.next=constrain(d.origin.x+(e.clientX-d.startX)/bounds.width*100,d.origin.y+(e.clientY-d.startY)/bounds.height*100);
    button.classList.add('layout-dragging');button.style.left=d.next.x+'%';button.style.top=d.next.y+'%';
  });
  button.addEventListener('pointerup',e=>{
    const d=layoutDrag;if(!d||d.button!==button||d.pointer!==e.pointerId)return;
    layoutDrag=null;
    if(d.moved){skipClick=true;moveSpot(index,d.next);render();setTimeout(()=>skipClick=false,0);}
  });
  button.addEventListener('pointercancel',()=>{if(layoutDrag?.button===button){layoutDrag=null;render();}});
  button.addEventListener('keydown',e=>{
    if(!layoutMode||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const step=e.shiftKey?2:0.65,p=rooms[group].spots[index];
    const next={x:p.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:p.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)};
    if(moveSpot(index,next)){render();$('desks').querySelector(`[data-seat="${index}"]`)?.focus();}
  });
}
function renderDesks(){
  const root=$('desks'),room=rooms[group];root.replaceChildren();
  $('room').style.setProperty('--desk-width',`min(11.2%, ${68/room.cols}%)`);
  $('room').style.setProperty('--desk-height',`min(9.6%, ${52/room.rows}%)`);
  room.spots.forEach((spot,i)=>{
    const p=spot.id?person(spot.id):null,b=document.createElement('button');b.type='button';
    b.className=`desk${spot.id?' occupied':''}${spot.id&&spot.id===selected?' selected':''}`;
    b.dataset.seat=String(i);b.style.left=spot.x+'%';b.style.top=spot.y+'%';b.draggable=!layoutMode&&Boolean(spot.id);
    b.setAttribute('aria-label',`Spot ${i+1}: ${p?p.label:'empty'}. ${layoutMode?'Use arrow keys to move spot.':'Select to assign or move student.'}`);
    b.title=`Spot ${i+1}${p?' · '+p.label:''}${layoutMode?' · Drag or use arrow keys to move':''}`;
    const num=document.createElement('span'),label=document.createElement('span');num.className='desk-number';num.textContent=String(i+1).padStart(2,'0');label.className='desk-name';label.textContent=p?p.label:'+';b.append(num,label);
    b.addEventListener('click',()=>{if(skipClick){skipClick=false;return;}deskClick(i);});
    b.addEventListener('keydown',e=>{if(!layoutMode&&(e.key==='Delete'||e.key==='Backspace')&&spot.id){e.preventDefault();unseat(spot.id);}if(e.key==='Escape'&&selected)clearSelection();});
    b.addEventListener('dragstart',e=>startDrag(e,spot.id));b.addEventListener('dragend',endDrag);
    b.addEventListener('dragover',e=>{if(!layoutMode&&dragged){e.preventDefault();e.dataTransfer.dropEffect='move';}});
    b.addEventListener('dragenter',()=>{if(!layoutMode&&dragged)b.classList.add('drop-target');});
    b.addEventListener('dragleave',()=>b.classList.remove('drop-target'));
    b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('drop-target');if(dragged)assign(dragged,i);endDrag();});
    if(spot.id&&!layoutMode)setupStudentTouch(b,spot.id);
    setupLayoutDrag(b,i);root.append(b);
  });
}
function renderRoster(){
  const root=$('roster'),search=$('search').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),showAll=$('showAll').checked;
  root.replaceChildren();const visible=GROUPS[group].filter(p=>p.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search)&&(showAll||seatOf(p.id)<0));
  visible.forEach(p=>{
    const n=seatOf(p.id),b=document.createElement('button');b.type='button';b.className=`student${n>=0?' seated':''}${p.id===selected?' selected':''}`;
    b.dataset.studentId=p.id;b.draggable=!layoutMode;b.setAttribute('aria-pressed',String(p.id===selected));
    const avatar=document.createElement('span'),name=document.createElement('span'),where=document.createElement('span');avatar.className='avatar';avatar.textContent=p.name.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase();name.className='student-name';name.textContent=p.label;where.className='student-where';where.textContent=n>=0?'#'+(n+1):'↗';b.append(avatar,name,where);
    b.addEventListener('click',()=>{if(skipClick){skipClick=false;return;}if(layoutMode){toast('Switch off Move desks to assign names.');return;}selected=selected===p.id?null:p.id;render();});
    b.addEventListener('dragstart',e=>startDrag(e,p.id));b.addEventListener('dragend',endDrag);
    if(!layoutMode)setupStudentTouch(b,p.id);root.append(b);
  });
  if(!visible.length){const note=document.createElement('p');note.className='empty-note';note.textContent=search?'No matching students.':'Everyone has a spot. Select “Show seated students too” to move someone.';root.append(note);}
}
function render(){
  const room=rooms[group],occupied=room.spots.filter(p=>p.id).length;
  $('roomGroup').textContent=group;$('room').dataset.group=group;$('placedCount').textContent=String(occupied);$('totalCount').textContent=String(GROUPS[group].length);$('spotTotal').textContent=String(room.spots.length);$('waitingCount').textContent=`${GROUPS[group].length-occupied} left`;
  $('rowsInput').value=room.rows;$('colsInput').value=room.cols;$('spotsInput').value=room.spots.length;
  $('room').classList.toggle('layout-mode',layoutMode);document.querySelector('.roster-panel').classList.toggle('editing',layoutMode);
  $('moveDesksBtn').textContent=`Move desks: ${layoutMode?'on':'off'}`;$('moveDesksBtn').classList.toggle('is-on',layoutMode);$('moveDesksBtn').setAttribute('aria-pressed',String(layoutMode));
  $('layoutHelp').textContent=layoutMode?'Move spots with mouse, finger or stylus; use arrow keys for fine adjustments (Shift = larger step). Turn this mode off to place names.':room.manual?'Custom layout saved for this group. Apply grid or Align to grid to realign spots; names stay at their numbered spots.':'Grid aligned. Rows are numbered from the board toward the back; incomplete rows are centered.';
  $('mapHint').textContent=layoutMode?'Move desk spots—not names. Doors and board are marked on the map.':'Drag a name onto a spot, or select a name and tap a spot.';
  $('selectionHint').textContent=layoutMode?'Move desks mode is on. Turn it off to assign students.':selected?`${person(selected)?.label||'Student'} selected. Choose a spot or press Escape.`:'Select a student, then choose a spot.';
  document.querySelectorAll('.group').forEach(b=>{const active=b.dataset.group===group;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  renderDesks();renderRoster();
}
function applyGrid(rows,cols,count){
  if(!validInteger(rows,1,8)||!validInteger(cols,1,8)||!validInteger(count,1,40)||count>rows*cols){toast('Choose 1–8 rows and columns, and 1–40 spots (no more than rows × columns).');render();return;}
  const old=rooms[group],lost=old.spots.slice(count).filter(s=>s.id).length;
  if(lost&&!confirm(`${lost} assigned student(s) will return to the roster because their numbered spots would be removed. Continue?`)){render();return;}
  const spots=gridPositions(rows,cols,count,group);spots.forEach((s,i)=>s.id=old.spots[i]?.id||null);
  rooms[group]={rows,cols,manual:false,spots};selected=null;save();render();toast(`${count} spots aligned in ${rows} row(s) and ${cols} column(s) for ${group}.`);
}
function exportBackup(){
  const data={app:'GLM Grade 9 Seating Studio',version:2,exportedAt:new Date().toISOString(),rooms};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='grade9-seating-layout-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Backup exported. Keep it in approved school storage.');
}
async function importBackup(file){
  if(!file)return;
  try{
    if(file.size>200000)throw Error('Backup is too large.');
    const data=JSON.parse(await file.text()),incoming=data.version===2?validateV2(data):data.version===1?fromLegacy(data):null;
    if(!incoming)throw Error('Unsupported backup format.');
    if(!confirm('Replace ALL THREE saved classroom layouts and seating plans with this backup?'))return;
    rooms=incoming;selected=null;layoutMode=false;save();render();toast(data.version===1?'Old backup imported. Board now appears at the bottom; check earlier seating positions.':'All three layouts and seating plans restored.');
  }catch(error){toast('Import failed: '+error.message);}finally{$('importInput').value='';}
}
function setup(){
  document.querySelectorAll('.group').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;selected=null;layoutMode=false;finishStudentTouch();layoutDrag=null;$('search').value='';$('showAll').checked=false;render();}));
  $('gridForm').addEventListener('submit',e=>{e.preventDefault();applyGrid(Number($('rowsInput').value),Number($('colsInput').value),Number($('spotsInput').value));});
  $('moveDesksBtn').addEventListener('click',()=>{layoutMode=!layoutMode;selected=null;render();});
  $('resetGridBtn').addEventListener('click',()=>{const r=rooms[group];applyGrid(r.rows,r.cols,r.spots.length);});
  $('search').addEventListener('input',render);$('showAll').addEventListener('change',render);$('clearSelectionBtn').addEventListener('click',clearSelection);
  $('clearBtn').addEventListener('click',()=>{if(!confirm(`Remove all seating assignments for ${group}? Spot positions and other groups will be kept.`))return;rooms[group].spots.forEach(s=>s.id=null);selected=null;save();render();toast(`${group} student assignments cleared; spot layout kept.`);});
  $('printBtn').addEventListener('click',()=>window.print());$('exportBtn').addEventListener('click',exportBackup);$('importBtn').addEventListener('click',()=>$('importInput').click());$('importInput').addEventListener('change',e=>importBackup(e.target.files[0]));
  $('roster').addEventListener('dragover',e=>{if(!layoutMode&&dragged&&seatOf(dragged)>=0)e.preventDefault();});
  $('roster').addEventListener('drop',e=>{e.preventDefault();if(!layoutMode&&dragged&&seatOf(dragged)>=0)unseat(dragged);endDrag();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected)clearSelection();});
  render();if(migrated)toast('Previous plans restored. The board is now at the bottom: verify old seating positions.');
}
setup();
