'use strict';

const STORAGE_KEY = 'techglm-classroom-seating-studio-v1';
const MAX_STUDENTS = 60;
const $ = id => document.getElementById(id);
const clamp = (n,a,b) => Math.min(b, Math.max(a,n));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const DEFAULT_FLOOR_POINTS = [
  {x:31,y:31},{x:50,y:31},{x:69,y:31},
  {x:31,y:67},{x:50,y:67},{x:69,y:67},
  {x:22,y:49},{x:78,y:49}
];
const FLOOR_DESCRIPTIONS = ['back left','back center','back right','front left','front center','front right','left center','right center'];

function parseRoster(text){
  const normalized = String(text || '').replace(/\r/g,'\n');
  let parts = normalized.split(/\n|;/);
  if(parts.filter(x=>x.trim()).length <= 1 && normalized.includes(',')) parts = normalized.split(',');
  return parts.map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean).slice(0,MAX_STUDENTS);
}
function rosterLabels(students){
  const totals={}, seen={};
  students.forEach(s => totals[s.name]=(totals[s.name]||0)+1);
  return students.map(s => ({...s,label:totals[s.name]>1?`${s.name} · ${seen[s.name]=(seen[s.name]||0)+1}`:s.name}));
}
function initials(name){
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || '?';
}
function autoGrid(count){
  const spots = clamp(Math.max(1,count),1,MAX_STUDENTS);
  const cols = spots <= 12 ? 4 : spots <= 25 ? 5 : spots <= 36 ? 6 : 7;
  const rows = Math.ceil(spots/cols);
  return {rows,cols,spots};
}
function gridPositions(rows,cols,count){
  const positions=[];
  for(let row=0; row<rows && positions.length<count; row++){
    const n=Math.min(cols,count-positions.length);
    const y=rows===1?53:74-row*(47/(rows-1));
    const left=18, right=(y<34||y>68)?76:82;
    for(let col=0; col<n; col++){
      const x=n===1?50:left+(right-left)*(col/(n-1));
      positions.push({x:+x.toFixed(2),y:+y.toFixed(2),studentId:null});
    }
  }
  return positions;
}
function newCourse(name,names){
  const students=names.map(name=>({id:uid(),name}));
  const g=autoGrid(students.length);
  return {id:uid(),name,students,room:{rows:g.rows,cols:g.cols,manual:false,spots:gridPositions(g.rows,g.cols,g.spots)}};
}
function freshState(){return {version:1,activeCourseId:null,courses:[],floorPoints:DEFAULT_FLOOR_POINTS.slice(0,6).map(p=>({...p}))};}
function normalizeCourse(raw){
  if(!raw || typeof raw!=='object') throw Error('Invalid course.');
  const name=String(raw.name||'').trim(); if(!name) throw Error('Course name is missing.');
  if(!Array.isArray(raw.students)||raw.students.length>MAX_STUDENTS) throw Error(`A course can contain at most ${MAX_STUDENTS} students.`);
  const ids=new Set();
  const students=raw.students.map(s=>{const id=String(s?.id||'');const nm=String(s?.name||'').trim();if(!id||!nm||ids.has(id))throw Error('Invalid student list.');ids.add(id);return {id,name:nm};});
  const room=raw.room; if(!room||!Number.isInteger(room.rows)||!Number.isInteger(room.cols)||room.rows<1||room.rows>10||room.cols<1||room.cols>10||!Array.isArray(room.spots)||room.spots.length<1||room.spots.length>MAX_STUDENTS||room.spots.length>room.rows*room.cols)throw Error('Invalid room layout.');
  const studentIds=new Set(students.map(s=>s.id)), assigned=new Set();
  const spots=room.spots.map(s=>{if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.y)||s.x<8||s.x>92||s.y<18||s.y>82)throw Error('Invalid desk coordinates.');const studentId=s.studentId==null?null:String(s.studentId);if(studentId && (!studentIds.has(studentId)||assigned.has(studentId))) throw Error('Invalid seating assignment.');if(studentId)assigned.add(studentId);return {x:s.x,y:s.y,studentId};});
  return {id:String(raw.id||uid()),name,students,room:{rows:room.rows,cols:room.cols,manual:Boolean(room.manual),spots}};
}
function validateState(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.courses)) throw Error('Unsupported backup.');
  const courses=raw.courses.map(normalizeCourse); const courseIds=new Set(courses.map(c=>c.id)); if(courseIds.size!==courses.length)throw Error('Duplicate course IDs.');
  const points=Array.isArray(raw.floorPoints)?raw.floorPoints:DEFAULT_FLOOR_POINTS.slice(0,6);
  if(points.length<4||points.length>8)throw Error('Floor reference count must be 4–8.');
  const floorPoints=points.map(p=>{if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||p.x<10||p.x>90||p.y<20||p.y>80)throw Error('Invalid floor reference point.');return{x:p.x,y:p.y};});
  return {version:1,activeCourseId:courseIds.has(raw.activeCourseId)?raw.activeCourseId:(courses[0]?.id||null),courses,floorPoints};
}

let state=freshState(), selectedStudentId=null, draggedStudentId=null, layoutMode=false, floorMode=false, moving=null, toastTimer=null, dialogMode='new', editingCourseId=null, skipClick=false;
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)state=validateState(JSON.parse(saved));}catch(error){console.warn(error);state=freshState();}

function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(error){toast('Browser storage is unavailable. Export a backup.');}}
function activeCourse(){return state.courses.find(c=>c.id===state.activeCourseId)||null;}
function studentById(id){return activeCourse()?.students.find(s=>s.id===id)||null;}
function seatIndex(studentId){return activeCourse()?.room.spots.findIndex(s=>s.studentId===studentId) ?? -1;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);}
function setModes(which){layoutMode=which==='layout';floorMode=which==='floor';selectedStudentId=null;moving=null;render();}

function preserveStudents(oldStudents,newNames){
  const buckets=new Map(); oldStudents.forEach(s=>{if(!buckets.has(s.name))buckets.set(s.name,[]);buckets.get(s.name).push(s);});
  return newNames.map(name=>{const bucket=buckets.get(name);return bucket?.length?bucket.shift():{id:uid(),name};});
}
function applyRosterEdit(course,newName,newNames){
  const students=preserveStudents(course.students,newNames); const allowed=new Set(students.map(s=>s.id));
  course.name=newName; course.students=students; course.room.spots.forEach(s=>{if(s.studentId&&!allowed.has(s.studentId))s.studentId=null;});
  if(course.room.spots.length<Math.max(1,students.length)){
    const count=Math.min(MAX_STUDENTS,Math.max(students.length,course.room.spots.length));
    let rows=course.room.rows, cols=course.room.cols;
    while(rows*cols<count && cols<10)cols++; while(rows*cols<count && rows<10)rows++;
    const next=gridPositions(rows,cols,count); course.room.spots.forEach((s,i)=>{if(next[i])next[i].studentId=s.studentId;});
    course.room={rows,cols,manual:false,spots:next};
  }
}

function openCourseDialog(mode){
  dialogMode=mode; const course=activeCourse(); editingCourseId=mode==='edit'?course?.id:null;
  $('dialogKicker').textContent=mode==='edit'?'EDIT COURSE':'NEW COURSE'; $('dialogTitle').textContent=mode==='edit'?'Edit course and roster':'Create a course'; $('saveCourseBtn').textContent=mode==='edit'?'Save changes':'Create course';
  $('courseNameInput').value=mode==='edit'&&course?course.name:''; $('rosterInput').value=mode==='edit'&&course?course.students.map(s=>s.name).join('\n'):''; updateRosterPreview(); $('courseDialog').showModal(); setTimeout(()=>$('courseNameInput').focus(),0);
}
function closeCourseDialog(){$('courseDialog').close();}
function updateRosterPreview(){
  const names=parseRoster($('rosterInput').value), totals={}; names.forEach(n=>totals[n]=(totals[n]||0)+1); const dup=Object.values(totals).filter(n=>n>1).reduce((a,b)=>a+b-1,0);
  $('rosterPreviewCount').textContent=`${names.length} student${names.length===1?'':'s'}`; $('duplicateNotice').textContent=dup?`${dup} repeated-name entr${dup===1?'y':'ies'} will be numbered.`:'';
}

function putStudent(studentId,index){
  const course=activeCourse(); if(!course||!course.students.some(s=>s.id===studentId)||index<0||index>=course.room.spots.length)return;
  const previous=seatIndex(studentId), target=course.room.spots[index].studentId;
  if(previous===index){selectedStudentId=null;render();return;}
  if(previous>=0) course.room.spots[previous].studentId=target||null;
  course.room.spots[index].studentId=studentId; selectedStudentId=null; save(); render();
}
function unseat(studentId){const course=activeCourse(),i=seatIndex(studentId);if(!course||i<0)return;course.room.spots[i].studentId=null;selectedStudentId=null;save();render();toast('Student returned to the roster.');}
function handleDeskClick(index){const course=activeCourse();if(!course||layoutMode||floorMode)return;const occupant=course.room.spots[index].studentId;if(selectedStudentId){if(selectedStudentId===occupant){selectedStudentId=null;render();}else putStudent(selectedStudentId,index);}else if(occupant){selectedStudentId=occupant;render();}else toast('Select a student first.');}

function startPointerMove(event,type,index,node){
  if(event.button!==0||!event.isPrimary)return; const enabled=type==='desk'?layoutMode:floorMode; if(!enabled)return;
  event.preventDefault(); const source=type==='desk'?activeCourse().room.spots[index]:state.floorPoints[index]; moving={type,index,node,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,original:{x:source.x,y:source.y},next:{x:source.x,y:source.y},moved:false};node.setPointerCapture(event.pointerId);
}
function pointerMove(event){const m=moving;if(!m||m.pointer!==event.pointerId)return;if(Math.hypot(event.clientX-m.startX,event.clientY-m.startY)>3)m.moved=true;if(!m.moved)return;event.preventDefault();const rect=$('room').getBoundingClientRect();let x=m.original.x+(event.clientX-m.startX)/rect.width*100,y=m.original.y+(event.clientY-m.startY)/rect.height*100;x=clamp(x,12,86);y=clamp(y,22,78);m.next={x:+x.toFixed(2),y:+y.toFixed(2)};m.node.style.left=m.next.x+'%';m.node.style.top=m.next.y+'%';}
function pointerUp(event){const m=moving;if(!m||m.pointer!==event.pointerId)return;moving=null;if(!m.moved)return;skipClick=true;if(m.type==='desk'){const course=activeCourse();course.room.spots[m.index].x=m.next.x;course.room.spots[m.index].y=m.next.y;course.room.manual=true;}else state.floorPoints[m.index]={...m.next};save();render();setTimeout(()=>skipClick=false,0);}

function renderCourseControls(){
  const select=$('courseSelect');select.replaceChildren(); if(!state.courses.length){const o=document.createElement('option');o.textContent='No courses yet';o.value='';select.append(o);}else state.courses.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;if(c.id===state.activeCourseId)o.selected=true;select.append(o);});
  const has=Boolean(activeCourse()); ['courseSelect','editCourseBtn','deleteCourseBtn','printBtn','exportBtn'].forEach(id=>$(id).disabled=!has && id!=='exportBtn'); $('emptyState').hidden=has; $('planner').hidden=!has;
}
function renderLayout(){const c=activeCourse();if(!c)return;$('rowsInput').value=c.room.rows;$('colsInput').value=c.room.cols;$('spotsInput').value=c.room.spots.length;$('layoutHelp').textContent=`${c.room.rows} × ${c.room.cols} provides ${c.room.rows*c.room.cols} grid cells. ${c.students.length} students are on this roster.`;$('moveDesksBtn').textContent=`Move desks: ${layoutMode?'on':'off'}`;$('moveDesksBtn').setAttribute('aria-pressed',String(layoutMode));$('moveDesksBtn').disabled=floorMode;$('moveFloorBtn').disabled=layoutMode;$('room').classList.toggle('layout-mode',layoutMode);$('room').classList.toggle('floor-mode',floorMode);}
function renderFloor(){
  $('floorCount').value=String(state.floorPoints.length);$('moveFloorBtn').textContent=`Move floor points: ${floorMode?'on':'off'}`;$('moveFloorBtn').setAttribute('aria-pressed',String(floorMode));
  $('floorHelp').textContent=floorMode?'Drag a lettered point or use arrow keys. These markers are shared by every course.':'Place matching removable marks on the real floor. The same A–H positions appear for every course.';
  const layer=$('floorLayer'), key=$('floorKey'); layer.replaceChildren(); key.replaceChildren();
  state.floorPoints.forEach((p,i)=>{const letter=String.fromCharCode(65+i),b=document.createElement('button');b.type='button';b.className='floor-reference';b.style.left=p.x+'%';b.style.top=p.y+'%';b.textContent=letter;b.tabIndex=floorMode?0:-1;b.setAttribute('aria-label',`Floor reference ${letter}, ${FLOOR_DESCRIPTIONS[i]}`);b.addEventListener('pointerdown',e=>startPointerMove(e,'floor',i,b));b.addEventListener('pointermove',pointerMove);b.addEventListener('pointerup',pointerUp);b.addEventListener('pointercancel',()=>{moving=null;render();});b.addEventListener('keydown',e=>{if(!floorMode||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?2:.6,p=state.floorPoints[i];state.floorPoints[i]={x:+clamp(p.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),12,86).toFixed(2),y:+clamp(p.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),22,78).toFixed(2)};save();render();$('floorLayer').children[i]?.focus();});layer.append(b);const k=document.createElement('span');k.innerHTML=`<strong>${letter}</strong> ${FLOOR_DESCRIPTIONS[i]}`;key.append(k);});
}
function renderDesks(){
  const c=activeCourse(),root=$('desks');root.replaceChildren();if(!c)return;
  c.room.spots.forEach((spot,i)=>{const person=spot.studentId?rosterLabels(c.students).find(s=>s.id===spot.studentId):null,b=document.createElement('button');b.type='button';b.className=`desk${person?' occupied':''}${person&&selectedStudentId===person.id?' selected':''}`;b.style.left=spot.x+'%';b.style.top=spot.y+'%';b.dataset.index=i;b.setAttribute('aria-label',`Desk ${i+1}: ${person?person.label:'empty'}`);b.innerHTML=`<span class="desk-number">${String(i+1).padStart(2,'0')}</span><span class="desk-name"></span>`;b.querySelector('.desk-name').textContent=person?person.label:'+';b.draggable=Boolean(person)&&!layoutMode&&!floorMode;b.addEventListener('click',()=>{if(skipClick){skipClick=false;return}handleDeskClick(i);});b.addEventListener('dragstart',e=>{if(!person)return e.preventDefault();draggedStudentId=person.id;e.dataTransfer.setData('text/plain',person.id);});b.addEventListener('dragover',e=>{if(draggedStudentId&&!layoutMode&&!floorMode)e.preventDefault();});b.addEventListener('drop',e=>{e.preventDefault();if(draggedStudentId)putStudent(draggedStudentId,i);draggedStudentId=null;});b.addEventListener('dragend',()=>draggedStudentId=null);b.addEventListener('pointerdown',e=>startPointerMove(e,'desk',i,b));b.addEventListener('pointermove',pointerMove);b.addEventListener('pointerup',pointerUp);b.addEventListener('pointercancel',()=>{moving=null;render();});b.addEventListener('keydown',e=>{if(layoutMode&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?2:.6,s=c.room.spots[i];s.x=+clamp(s.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),12,86).toFixed(2);s.y=+clamp(s.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),22,78).toFixed(2);c.room.manual=true;save();render();$('desks').children[i]?.focus();}else if((e.key==='Delete'||e.key==='Backspace')&&person&&!layoutMode&&!floorMode){e.preventDefault();unseat(person.id);}});root.append(b);});
}
function renderRoster(){
  const c=activeCourse(),root=$('roster');root.replaceChildren();if(!c)return;const labeled=rosterLabels(c.students),query=$('search').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),showAll=$('showAll').checked;
  const visible=labeled.filter(s=>{const seated=seatIndex(s.id)>=0;const match=s.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query);return match&&(showAll||!seated);});
  visible.forEach(s=>{const idx=seatIndex(s.id),b=document.createElement('button');b.type='button';b.className=`student${idx>=0?' seated':''}${selectedStudentId===s.id?' selected':''}`;b.draggable=!layoutMode&&!floorMode;b.innerHTML=`<span class="avatar"></span><span class="student-name"></span><span class="student-where"></span>`;b.querySelector('.avatar').textContent=initials(s.name);b.querySelector('.student-name').textContent=s.label;b.querySelector('.student-where').textContent=idx>=0?`#${idx+1}`:'↗';b.addEventListener('click',()=>{if(layoutMode||floorMode)return;selectedStudentId=selectedStudentId===s.id?null:s.id;render();});b.addEventListener('dragstart',e=>{if(layoutMode||floorMode)return e.preventDefault();draggedStudentId=s.id;e.dataTransfer.setData('text/plain',s.id);});b.addEventListener('dragend',()=>draggedStudentId=null);root.append(b);});
  if(!visible.length){const p=document.createElement('p');p.className='empty-note';p.textContent=query?'No matching students.':c.students.length?'Everyone has a seat. Turn on “Show seated students too” to move someone.':'This course has no students yet. Use “Edit roster”.';root.append(p);}
}
function render(){
  renderCourseControls();const c=activeCourse();if(!c)return;const seated=c.room.spots.filter(s=>s.studentId).length;$('roomCourseName').textContent=c.name;$('placedCount').textContent=seated;$('studentCount').textContent=c.students.length;$('spotCount').textContent=c.room.spots.length;$('waitingCount').textContent=`${Math.max(0,c.students.length-seated)} left`;
  $('selectionHint').textContent=layoutMode?'Desk edit mode is on. Drag desk spots or use arrow keys.':floorMode?'Floor reference edit mode is on.':selectedStudentId?`${studentById(selectedStudentId)?.name||'Student'} selected. Choose a desk.`:'Select a student and choose a desk.';$('mapHint').textContent=layoutMode?'Move desk spots only.':floorMode?'Move A–H floor marks only.':'Select a student or drag a name onto a desk.';
  renderLayout();renderFloor();renderDesks();renderRoster();
}

$('newCourseBtn').addEventListener('click',()=>openCourseDialog('new'));$('emptyNewCourseBtn').addEventListener('click',()=>openCourseDialog('new'));$('editCourseBtn').addEventListener('click',()=>openCourseDialog('edit'));$('dialogCloseBtn').addEventListener('click',closeCourseDialog);$('dialogCancelBtn').addEventListener('click',closeCourseDialog);$('rosterInput').addEventListener('input',updateRosterPreview);
$('courseForm').addEventListener('submit',e=>{e.preventDefault();const name=$('courseNameInput').value.trim(),names=parseRoster($('rosterInput').value);if(!name){toast('Add a course name.');return;}if(names.length>MAX_STUDENTS){toast(`Maximum ${MAX_STUDENTS} students.`);return;}if(dialogMode==='new'){const c=newCourse(name,names);state.courses.push(c);state.activeCourseId=c.id;}else{const c=state.courses.find(x=>x.id===editingCourseId);if(!c)return;applyRosterEdit(c,name,names);}selectedStudentId=null;save();closeCourseDialog();render();toast(dialogMode==='new'?'Course created.':'Course updated.');});
$('courseSelect').addEventListener('change',e=>{state.activeCourseId=e.target.value;selectedStudentId=null;setModes(null);save();render();});
$('deleteCourseBtn').addEventListener('click',()=>{const c=activeCourse();if(!c||!confirm(`Delete “${c.name}” and its local seating plan?`))return;state.courses=state.courses.filter(x=>x.id!==c.id);state.activeCourseId=state.courses[0]?.id||null;selectedStudentId=null;save();render();toast('Course deleted.');});
$('gridForm').addEventListener('submit',e=>{e.preventDefault();const c=activeCourse();if(!c)return;const rows=Number($('rowsInput').value),cols=Number($('colsInput').value),count=Number($('spotsInput').value);if(!Number.isInteger(rows)||rows<1||rows>10||!Number.isInteger(cols)||cols<1||cols>10||!Number.isInteger(count)||count<1||count>MAX_STUDENTS||count>rows*cols){toast('Check rows, columns, and desk spot count.');return;}if(count<c.room.spots.length&&c.room.spots.slice(count).some(s=>s.studentId)&&!confirm('Some occupied desk spots will be removed and those students will return to the roster. Continue?'))return;const next=gridPositions(rows,cols,count);c.room.spots.slice(0,count).forEach((s,i)=>next[i].studentId=s.studentId);c.room={rows,cols,manual:false,spots:next};save();render();toast('Desk grid updated.');});
$('moveDesksBtn').addEventListener('click',()=>setModes(layoutMode?null:'layout'));$('alignGridBtn').addEventListener('click',()=>{const c=activeCourse();if(!c)return;const next=gridPositions(c.room.rows,c.room.cols,c.room.spots.length);c.room.spots.forEach((s,i)=>next[i].studentId=s.studentId);c.room.spots=next;c.room.manual=false;save();render();toast('Desks aligned to the grid.');});
$('floorCount').addEventListener('change',e=>{const count=Number(e.target.value);state.floorPoints=DEFAULT_FLOOR_POINTS.slice(0,count).map((p,i)=>state.floorPoints[i]?{...state.floorPoints[i]}:{...p});save();render();});$('moveFloorBtn').addEventListener('click',()=>setModes(floorMode?null:'floor'));$('resetFloorBtn').addEventListener('click',()=>{if(!confirm('Reset floor reference points to their default positions?'))return;state.floorPoints=DEFAULT_FLOOR_POINTS.slice(0,state.floorPoints.length).map(p=>({...p}));save();render();toast('Floor points reset.');});
$('search').addEventListener('input',render);$('showAll').addEventListener('change',render);$('clearSelectionBtn').addEventListener('click',()=>{selectedStudentId=null;render();});$('clearSeatsBtn').addEventListener('click',()=>{const c=activeCourse();if(!c||!confirm(`Clear every seating assignment for “${c.name}”?`))return;c.room.spots.forEach(s=>s.studentId=null);selectedStudentId=null;save();render();toast('Seating cleared.');});
$('roster').addEventListener('dragover',e=>{if(draggedStudentId&&seatIndex(draggedStudentId)>=0)e.preventDefault();});$('roster').addEventListener('drop',e=>{e.preventDefault();if(draggedStudentId&&seatIndex(draggedStudentId)>=0)unseat(draggedStudentId);draggedStudentId=null;});
$('printBtn').addEventListener('click',()=>window.print());
$('exportBtn').addEventListener('click',()=>{const payload={...state,app:'Tech-GLM Classroom Seating Studio',exportedAt:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='classroom-seating-studio-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Backup exported. It contains student names; store it securely.');});
$('importBtn').addEventListener('click',()=>$('importInput').click());$('importInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>500000)throw Error('Backup is too large.');const incoming=validateState(JSON.parse(await file.text()));if(!confirm('Replace all locally saved courses, rosters, seating plans, and floor points?'))return;state=incoming;selectedStudentId=null;save();render();toast('Backup restored.');}catch(error){toast('Import failed: '+error.message);}finally{$('importInput').value='';}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){selectedStudentId=null;if(layoutMode||floorMode)setModes(null);else render();}});

render();
