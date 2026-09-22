'use strict';
/* Roster corrections and one set of physical floor marks shared by 9A, 9B and 9C.
   Existing student IDs remain unchanged, preserving saved seating arrangements. */
(() => {
  const corrected = {
    '9A':['Isabella','Martin','Lucia','Lucas','Matias','Alejandro','Samuel','David','Emilia','Maria Camila','Juana','Juliana','Pablo','Lorenzo','Juan Sebastian','Maria Jose','Mariana','Juan Jose','Sofia','Maria Del Rosario'],
    '9B':['Antonia C','Elena','Samuel','Ana Lucia','Antonia G','Santiago','Julieta','Gabriela','Jose Jacobo','Antonia A','Mariana','Matías','Valentina','Juana','Salomon','Jacobo O','Sofia','Jacobo P','Tomas'],
    '9C':['Mariana B','Sara Sofia','Juan Sebastián','Alejandro','Isabella F','Jeronimo','Matias','Maria Adelaida','Belen','Isabella L','Sara','Maria Antonia','Maria Jose','Juan Diego','Mariana T','Pablo','Emmanuel','David','Catalina']
  };
  for(const [grade,names] of Object.entries(corrected)) {
    if(GROUPS[grade].length !== names.length) throw Error(`Incorrect roster length for ${grade}`);
    GROUPS[grade].forEach((student,index)=>{student.name=names[index];student.label=names[index];});
  }
  const POINT_KEY='glm-grade9-shared-floor-points-v1';
  const DEFAULTS=[
    {x:28,y:33},{x:72,y:33},{x:28,y:66},{x:72,y:66},
    {x:50,y:33},{x:50,y:66},{x:36,y:50},{x:64,y:50}
  ];
  const descriptions=['Back left','Back right','Front left','Front right','Back center','Front center','Middle left','Middle right'];
  const $id=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fresh=(count=6)=>DEFAULTS.slice(0,count).map(p=>({...p}));
  function validateFloor(input){
    if(!Array.isArray(input)||input.length<4||input.length>8)throw Error('Choose 4–8 floor reference points.');
    return input.map((point,index)=>{
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.y<20||point.y>80||point.x<16||point.x>84)throw Error(`Invalid floor point ${index+1}.`);
      const xBound=point.y<=50?25-point.y/2:point.y/2-25;
      if(point.x<=xBound+4||point.x>=100-xBound-4)throw Error(`Floor point ${index+1} is outside the room.`);
      return {x:+point.x.toFixed(2),y:+point.y.toFixed(2)};
    });
  }
  let floorPoints=fresh(),floorMode=false,drag=null,ignoreClick=false;
  try {const saved=localStorage.getItem(POINT_KEY);if(saved)floorPoints=validateFloor(JSON.parse(saved));}
  catch(error){console.warn('Could not restore floor points.',error);}
  function storeFloor(){try{localStorage.setItem(POINT_KEY,JSON.stringify(floorPoints));}catch(error){toast('Could not save floor points. Export a backup.');}}
  function constrainPoint(x,y){
    y=clamp(y,24,76);const edge=(y<=50?25-y/2:y/2-25)+7;
    return {x:+clamp(x,edge,100-edge).toFixed(2),y:+y.toFixed(2)};
  }
  function tooClose(index,p){return floorPoints.some((other,i)=>i!==index&&Math.hypot(other.x-p.x,other.y-p.y)<7);}
  function finishFloorMode(){floorMode=false;layoutMode=false;drag=null;$id('moveFloorBtn').setAttribute('aria-pressed','false');render();}
  const tools=document.createElement('section');tools.className='floor-tools';tools.setAttribute('aria-label','Physical floor reference points');
  tools.innerHTML=`<div class="floor-intro"><div><span class="section-kicker">02 / FLOOR REFERENCE POINTS</span><h2>Fixed points on the floor</h2><p>Place matching, removable A–H markers on the actual floor. These anchors are shared by all three groups, independently of desk positions.</p></div><span class="floor-shared">Same floor · 9A / 9B / 9C</span></div><div class="floor-controls"><label for="floorCount">Reference points <select id="floorCount"><option value="4">4 points</option><option value="5">5 points</option><option value="6">6 points</option><option value="7">7 points</option><option value="8">8 points</option></select></label><button type="button" class="button subtle" id="moveFloorBtn" aria-pressed="false">Move floor points: off</button><button type="button" class="button subtle" id="resetFloorBtn">Reset floor points</button></div><p class="floor-help" id="floorHelp">Mark A–F on the real floor after checking aisles and door access. Move a floor point to match the actual location of its tape mark.</p>`;
  document.querySelector('.layout-tools').after(tools);
  const layer=document.createElement('div');layer.id='floorReferenceLayer';layer.className='floor-reference-layer';layer.setAttribute('aria-label','Physical floor reference points');$id('room').append(layer);
  const key=document.createElement('div');key.className='floor-reference-key';key.id='floorReferenceKey';document.querySelector('.map-footer').after(key);
  // A single room-wide physical marking plan: changing groups never resets the marks.
  function renderFloor(){
    $id('floorCount').value=String(floorPoints.length);
    $id('moveFloorBtn').textContent=`Move floor points: ${floorMode?'on':'off'}`;
    $id('moveFloorBtn').setAttribute('aria-pressed',String(floorMode));
    $id('moveFloorBtn').classList.toggle('is-on',floorMode);
    $id('moveDesksBtn').disabled=floorMode;
    $id('room').classList.toggle('floor-mode',floorMode);
    $id('floorHelp').textContent=floorMode?'Drag a lettered point, or focus it and use arrow keys (Shift + arrow for larger moves). Turn this mode off to seat students.':'The same labeled floor points appear on 9A, 9B and 9C. Place matching removable marks on the real floor; print the map as a guide.';
    if(floorMode){$id('moveDesksBtn').textContent='Move desks: off';$id('moveDesksBtn').setAttribute('aria-pressed','false');$id('layoutHelp').textContent='Finish moving floor points before editing desk spots or assigning students.';$id('mapHint').textContent='Move the A–H points only. Desks remain in their previous positions.';$id('selectionHint').textContent='Floor reference edit mode is on. Turn it off to assign names.';}
    layer.replaceChildren();key.replaceChildren();
    const lead=document.createElement('span');lead.className='floor-key-lead';lead.textContent='FLOOR MARKS ·';key.append(lead);
    floorPoints.forEach((point,index)=>{
      const name=String.fromCharCode(65+index),node=document.createElement('button');
      node.type='button';node.className='floor-reference';node.dataset.floorIndex=String(index);node.style.left=point.x+'%';node.style.top=point.y+'%';node.textContent=name;
      node.setAttribute('aria-label',`Floor reference ${name}, ${descriptions[index]}. ${floorMode?'Drag or use arrows to move.':'Physical alignment marker.'}`);
      node.title=`Floor mark ${name} · ${descriptions[index]}`;node.tabIndex=floorMode?0:-1;
      node.addEventListener('pointerdown',event=>{
        if(!floorMode||!event.isPrimary||event.button!==0)return;
        event.preventDefault();const current=floorPoints[index];drag={node,index,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,original:{...current},next:{...current},moved:false};node.setPointerCapture(event.pointerId);
      });
      node.addEventListener('pointermove',event=>{
        const d=drag;if(!d||d.node!==node||d.pointer!==event.pointerId)return;
        if(Math.hypot(event.clientX-d.startX,event.clientY-d.startY)>3)d.moved=true;
        if(!d.moved)return;
        event.preventDefault();const rect=$id('room').getBoundingClientRect();d.next=constrainPoint(d.original.x+(event.clientX-d.startX)/rect.width*100,d.original.y+(event.clientY-d.startY)/rect.height*100);
        node.style.left=d.next.x+'%';node.style.top=d.next.y+'%';node.classList.add('moving');
      });
      node.addEventListener('pointerup',event=>{
        const d=drag;if(!d||d.node!==node||d.pointer!==event.pointerId)return;drag=null;
        if(d.moved){ignoreClick=true;if(tooClose(index,d.next))toast('Floor points should be separated; choose another place.');else{floorPoints[index]=d.next;storeFloor();toast(`Floor reference ${name} moved for all three groups.`);}renderFloor();setTimeout(()=>ignoreClick=false,0);}
      });
      node.addEventListener('pointercancel',()=>{if(drag?.node===node){drag=null;renderFloor();}});
      node.addEventListener('click',()=>{if(ignoreClick)return;if(floorMode)toast(`Move floor mark ${name} with drag or arrow keys.`);});
      node.addEventListener('keydown',event=>{
        if(!floorMode||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
        event.preventDefault();const step=event.shiftKey?2:0.65,old=floorPoints[index],next=constrainPoint(old.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),old.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0));
        if(tooClose(index,next)){toast('Floor points should be separated.');return;}
        floorPoints[index]=next;storeFloor();renderFloor();layer.querySelector(`[data-floor-index="${index}"]`)?.focus();
      });
      layer.append(node);
      const entry=document.createElement('span');entry.className='floor-key-entry';const tag=document.createElement('strong');tag.textContent=name;entry.append(tag,document.createTextNode(' '+descriptions[index]));key.append(entry);
    });
  }
  const previousRender=render;
  render=function(){previousRender();renderFloor();};
  $id('floorCount').addEventListener('change',event=>{
    const count=Number(event.target.value);if(!Number.isInteger(count)||count<4||count>8)return;
    const old=floorPoints;floorPoints=DEFAULTS.slice(0,count).map((defaultPoint,i)=>old[i]?{...old[i]}:{...defaultPoint});storeFloor();renderFloor();toast(`${count} floor points now appear on all three classroom maps.`);
  });
  $id('moveFloorBtn').addEventListener('click',()=>{
    if(floorMode){finishFloorMode();return;}
    if(layoutMode){layoutMode=false;selected=null;}
    floorMode=true;layoutMode=true;selected=null;render();
  });
  $id('resetFloorBtn').addEventListener('click',()=>{if(!confirm('Restore the default positions of the floor reference points for all three groups?'))return;floorPoints=fresh(floorPoints.length);storeFloor();renderFloor();toast('Floor point positions reset for all groups.');});
  // Group switching in app.js turns off its edit mode; reset the common floor editor too.
  document.querySelectorAll('.group').forEach(button=>button.addEventListener('click',()=>{floorMode=false;renderFloor();}));
  // Export includes the physical points as well as every group’s seating and desk geometry.
  $id('exportBtn').addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const payload={app:'GLM Grade 9 Seating Studio',version:3,exportedAt:new Date().toISOString(),rooms,floorPoints};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='grade9-seating-floor-points-backup.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Seating plans and floor points exported. Store the backup securely.');
  },true);
  // Older v1/v2 backups still work; v3 restores the shared floor points too.
  $id('importInput').addEventListener('change',async event=>{
    event.stopImmediatePropagation();const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>200000)throw Error('Backup too large.');
      const payload=JSON.parse(await file.text());
      const importedRooms=payload.version===1?fromLegacy(payload):payload.version===2?validateV2(payload):payload.version===3?validateV2({...payload,version:2}):null;
      if(!importedRooms)throw Error('Unsupported backup version.');
      const importedFloor=payload.version===3?validateFloor(payload.floorPoints):fresh();
      if(!confirm('Replace all three saved seating plans and the shared floor reference points?'))return;
      rooms=importedRooms;floorPoints=importedFloor;floorMode=false;layoutMode=false;selected=null;save();storeFloor();render();toast('Seating plans and shared floor marks restored.');
    }catch(error){toast('Import failed: '+error.message);}finally{$id('importInput').value='';}
  },true);
  // Refresh the roster immediately after replacing the placeholder numerical labels.
  render();
})();
