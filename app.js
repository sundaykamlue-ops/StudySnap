(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "studysnap-v1-data";
  const days = [{v:1,t:"จันทร์",full:"วันจันทร์"},{v:2,t:"อังคาร",full:"วันอังคาร"},{v:3,t:"พุธ",full:"วันพุธ"},{v:4,t:"พฤหัสบดี",full:"วันพฤหัสบดี"},{v:5,t:"ศุกร์",full:"วันศุกร์"},{v:6,t:"เสาร์",full:"วันเสาร์"},{v:0,t:"อาทิตย์",full:"วันอาทิตย์"}];
  const colors = ["#7ea8ff","#ff8fb4","#46b99a","#ffb84d","#a58af5","#66bfd7"];
  const defaultData = () => ({tasks:[],classes:[],sessions:[],settings:{name:"",goal:"อ่านหนังสือวันละ 30 นาที",focus:25},xp:0});
  let data = loadData();
  let selectedDay = new Date().getDay();
  let dashboardFilter = "all";
  let timerSeconds = Number(data.settings.focus || 25) * 60;
  let timerInterval = null;
  let timerRunning = false;
  let toastTimer = null;

  function loadData(){
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return defaultData();
      return {
        tasks:Array.isArray(parsed.tasks)?parsed.tasks:[],
        classes:Array.isArray(parsed.classes)?parsed.classes:[],
        sessions:Array.isArray(parsed.sessions)?parsed.sessions:[],
        settings:{...defaultData().settings,...(parsed.settings||{})},
        xp:Number(parsed.xp)||0
      };
    } catch { return defaultData(); }
  }
  function saveData(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; }
    catch { showToast("บันทึกไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม"); return false; }
  }
  function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function showToast(message){
    const el=$("toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
  }
  function localDateString(d=new Date()){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  function formatDate(value){
    if(!value) return "ไม่กำหนดวันส่ง";
    const [y,m,d]=value.split("-").map(Number);
    return new Date(y,m-1,d).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
  }
  function getTaskStatus(task){
    if(task.done) return "done";
    if(task.dueDate && task.dueDate < localDateString()) return "overdue";
    return "pending";
  }
  function statusLabel(task){
    const s=getTaskStatus(task);
    return s==="done"?"✓ เสร็จแล้ว":s==="overdue"?"เลยกำหนด":"ต้องทำ";
  }
  function sortedTasks(list){
    return [...list].sort((a,b)=>{
      const sa=getTaskStatus(a), sb=getTaskStatus(b);
      const rank={overdue:0,pending:1,done:2};
      if(rank[sa]!==rank[sb]) return rank[sa]-rank[sb];
      if(a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if(a.dueDate) return -1; if(b.dueDate) return 1;
      return (b.createdAt||"").localeCompare(a.createdAt||"");
    });
  }
  function taskRow(task){
    const status=getTaskStatus(task);
    const subject=task.subject?`<span>${esc(task.subject)}</span>`:"";
    const due=task.dueDate?`<span>📅 ${esc(formatDate(task.dueDate))}</span>`:"<span>📅 ไม่กำหนดวันส่ง</span>";
    return `<div class="task-row ${task.done?"done":""}">
      <input class="task-check" type="checkbox" data-action="toggle-task" data-id="${esc(task.id)}" ${task.done?"checked":""} aria-label="ทำ ${esc(task.title)} เสร็จแล้ว">
      <div class="task-main"><div class="task-name">${esc(task.title)}</div>
      <div class="task-subline">${subject}${due}<span>ความสำคัญ: ${task.priority==="high"?"สูง":task.priority==="low"?"ต่ำ":"ปานกลาง"}</span></div>
      ${task.details?`<div class="task-details">${esc(task.details)}</div>`:""}</div>
      <span class="task-status ${status}">${statusLabel(task)}</span>
      <div class="task-menu"><button class="tiny-button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="แก้ไขงาน">แก้ไข</button><button class="tiny-button" data-action="delete-task" data-id="${esc(task.id)}" aria-label="ลบงาน">ลบ</button></div>
    </div>`;
  }
  function renderTaskLists(){
    const all=sortedTasks(data.tasks);
    const search=($("taskSearch")?.value||"").trim().toLowerCase();
    const fullFilter=$("taskFilter")?.value||"all";
    const filtered=all.filter(t=>{
      const matchesSearch=!search || `${t.title} ${t.subject||""} ${t.details||""}`.toLowerCase().includes(search);
      const s=getTaskStatus(t);
      const matchesFilter=fullFilter==="all" || (fullFilter==="pending"&&s!=="done") || (fullFilter==="done"&&s==="done") || (fullFilter==="overdue"&&s==="overdue");
      return matchesSearch&&matchesFilter;
    });
    $("fullTaskList").innerHTML=filtered.map(taskRow).join("");
    $("fullTaskEmpty").hidden=filtered.length>0;
    const homeList=all.filter(t=>dashboardFilter==="all" || (dashboardFilter==="pending"&&getTaskStatus(t)!=="done") || (dashboardFilter==="done"&&getTaskStatus(t)==="done")).slice(0,5);
    $("dashboardTaskList").innerHTML=homeList.map(taskRow).join("");
    $("dashboardEmpty").hidden=homeList.length>0;
    document.querySelectorAll("#dashboardFilters [data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===dashboardFilter));
    $("focusTaskSelect").innerHTML='<option value="">โฟกัสเรื่องของฉัน</option>'+sortedTasks(data.tasks.filter(t=>!t.done)).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("");
    renderDashboardStats();
  }
  function renderDashboardStats(){
    const completed=data.tasks.filter(t=>t.done).length, total=data.tasks.length, pending=data.tasks.filter(t=>!t.done).length;
    const pct=total?Math.round(completed/total*100):0;
    $("progressCount").textContent=`${completed} / ${total}`;
    $("progressPercent").textContent=`${pct}%`;
    $("progressBar").style.width=`${pct}%`;
    $("progressRing").style.background=`conic-gradient(#8d91f4 ${pct}%, #dce2ff ${pct}% 100%)`;
    $("progressMessage").textContent=total&&completed===total?"เก่งมาก! วันนี้ทำครบทุกงานแล้ว 🎉":completed?"เก่งมาก! ทำต่อไปทีละงานนะ 💪":"เริ่มจากงานเล็ก ๆ สักงานก็ได้นะ 💪";
    $("completedTotal").textContent=completed;
    $("pendingTotal").textContent=pending;
    $("xpTotal").textContent=`${data.xp} XP`;
    const totalMinutes=data.sessions.reduce((sum,s)=>sum+(Number(s.minutes)||0),0);
    $("focusTotal").textContent=`${totalMinutes} นาที`;
    $("statsCompleted").textContent=completed;
    $("statsFocus").textContent=`${totalMinutes} นาที`;
    $("statsXP").textContent=data.xp;
    $("goalSummary").textContent=data.settings.goal||"ตั้งเป้าหมายเล็ก ๆ แล้วค่อย ๆ ทำให้สำเร็จ";
    const name=data.settings.name.trim();
    $("greeting").textContent=name?`สวัสดี ${name}! 👋`:"สวัสดี! 👋";
    $("avatarInitial").textContent=name?Array.from(name)[0].toUpperCase():"S";
    renderStats();
  }
  function dayName(day){return days.find(d=>d.v===Number(day))?.full||"วันเรียน";}
  function renderScheduleList(targetId, list, emptyId){
    const sorted=[...list].sort((a,b)=>a.start.localeCompare(b.start));
    $(targetId).innerHTML=sorted.map((c,i)=>`<div class="schedule-row">
      <span class="schedule-dot" style="background:${colors[i%colors.length]}"></span>
      <span class="schedule-time">${esc(c.start)}–${esc(c.end)}</span>
      <span class="schedule-name">${esc(c.name)}</span>
      <span class="schedule-room">${c.room?`ห้อง ${esc(c.room)}`:""}</span>
    </div>`).join("");
    if(emptyId) $(emptyId).hidden=sorted.length>0;
  }
  function renderTimetable(){
    $("dayTabs").innerHTML=days.map(d=>`<button class="day-tab ${d.v===selectedDay?"active":""}" data-day="${d.v}">${d.t}</button>`).join("");
    $("scheduleDayTitle").textContent=`${dayName(selectedDay)} · ตารางเรียน`;
    renderScheduleList("scheduleList",data.classes.filter(c=>Number(c.day)===selectedDay),"scheduleEmpty");
    const today=new Date().getDay();
    renderScheduleList("todaySchedule",data.classes.filter(c=>Number(c.day)===today).slice(0,4),null);
    if(!data.classes.some(c=>Number(c.day)===today)){
      $("todaySchedule").innerHTML='<p class="empty-state">วันนี้ยังไม่มีวิชาเรียน 🌼</p>';
    }
  }
  function renderStats(){
    const labels=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);labels.push({key:localDateString(d),label:d.toLocaleDateString("th-TH",{weekday:"short"}),minutes:0});}
    data.sessions.forEach(s=>{const row=labels.find(d=>d.key===s.date);if(row)row.minutes+=Number(s.minutes)||0;});
    const max=Math.max(25,...labels.map(x=>x.minutes));
    $("weeklyChart").innerHTML=labels.map(d=>`<div class="chart-col"><span class="chart-value">${d.minutes}</span><div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(d.minutes?5:2,d.minutes/max*100)}%"></div></div><span class="chart-day">${esc(d.label)}</span></div>`).join("");
    const map={};data.tasks.forEach(t=>{const key=(t.subject||"ไม่ระบุวิชา").trim();map[key]??={total:0,done:0};map[key].total++;if(t.done)map[key].done++;});
    const entries=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    $("subjectStats").innerHTML=entries.map(([name,v])=>`<div class="subject-row"><span>${esc(name)}</span><div class="subject-bar"><div style="width:${v.total?Math.round(v.done/v.total*100):0}%"></div></div><span>${v.done}/${v.total}</span></div>`).join("");
    $("subjectStatsEmpty").hidden=entries.length>0;
    const sessions=[...data.sessions].slice(-5).reverse();
    $("focusHistory").innerHTML=sessions.map(s=>`<div class="history-item"><span>${esc(s.taskTitle||"โฟกัสเรื่องของฉัน")}<br><small>${esc(formatDate(s.date))}</small></span><strong>${Number(s.minutes)||0} นาที</strong></div>`).join("");
    $("focusHistoryEmpty").hidden=sessions.length>0;
  }
  function renderAll(){renderTaskLists();renderTimetable();renderTimer();$("displayName").value=data.settings.name||"";$("studyGoal").value=data.settings.goal||"";$("defaultFocus").value=String(data.settings.focus||25);}
  function showPage(page){
    document.querySelectorAll(".page-view").forEach(el=>el.classList.toggle("active",el.id===`page-${page}`));
    document.querySelectorAll("[data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
    if(page==="tasks")renderTaskLists();if(page==="timetable")renderTimetable();if(page==="stats")renderStats();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function openTaskDialog(task=null){
    $("taskForm").reset();$("editTaskId").value=task?.id||"";
    $("taskDialogTitle").textContent=task?"แก้ไขการบ้าน ✏️":"เพิ่มการบ้าน 📝";
    $("taskTitle").value=task?.title||"";$("taskSubject").value=task?.subject||"";
    $("taskDueDate").value=task?.dueDate||"";$("taskPriority").value=task?.priority||"medium";$("taskDetails").value=task?.details||"";
    $("taskDialog").showModal();$("taskTitle").focus();
  }
  function completeTask(id,done){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    if(done&&!task.done&&!task.xpAwarded){data.xp+=20;task.xpAwarded=true;showToast("ทำงานสำเร็จ! ได้รับ 20 XP ⭐");}
    task.done=done;task.completedAt=done?new Date().toISOString():null;
    saveData();renderAll();
  }
  function deleteTask(id){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    if(!confirm(`ต้องการลบ "${task.title}" หรือไม่?`))return;
    data.tasks=data.tasks.filter(t=>t.id!==id);saveData();renderAll();showToast("ลบการบ้านแล้ว");
  }
  function handleTaskAction(event){
    const el=event.target.closest("[data-action]");if(!el)return;
    const {action,id}=el.dataset;
    if(action==="toggle-task")completeTask(id,el.checked);
    if(action==="edit-task"){const task=data.tasks.find(t=>t.id===id);if(task)openTaskDialog(task);}
    if(action==="delete-task")deleteTask(id);
  }
  function openClassDialog(cls=null){
    $("classForm").reset();$("editClassId").value=cls?.id||"";
    $("classDialogTitle").textContent=cls?"แก้ไขวิชา ✏️":"เพิ่มวิชา 📚";
    $("className").value=cls?.name||"";$("classDay").value=String(cls?.day??selectedDay);
    $("classStart").value=cls?.start||"08:00";$("classEnd").value=cls?.end||"09:00";$("classRoom").value=cls?.room||"";
    $("classDialog").showModal();
  }
  function renderClassEditControls(){
    const list=$("scheduleList");
    list.querySelectorAll(".schedule-row").forEach((row,i)=>{
      const cls=[...data.classes.filter(c=>Number(c.day)===selectedDay)].sort((a,b)=>a.start.localeCompare(b.start))[i];
      if(!cls)return;
      const actions=document.createElement("div");
      actions.className="schedule-actions";
      const btn=document.createElement("button");
      btn.type="button";btn.className="tiny-button";btn.textContent="แก้ไข";btn.dataset.editClass=cls.id;
      const del=document.createElement("button");
      del.type="button";del.className="tiny-button";del.textContent="ลบ";del.dataset.deleteClass=cls.id;
      actions.append(btn,del);
      row.append(actions);
    });
  }
  function renderTimer(){
    const m=Math.floor(timerSeconds/60),s=timerSeconds%60;
    const text=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    $("focusTimer").textContent=text;$("dashboardTimer").textContent=text;
    $("focusStart").textContent=timerRunning?"Ⅱ หยุดชั่วคราว":"▶ เริ่ม";
    $("dashboardStart").textContent=timerRunning?"Ⅱ หยุด":"▶ เริ่ม";
    $("focusMinutes").disabled=timerRunning;
    const chosen=data.tasks.find(t=>t.id===$("focusTaskSelect").value);
    $("focusTaskLabel").textContent=chosen?`กำลังทำ: ${chosen.title}`:"เวลาสำหรับตัวคุณเอง";
  }
  function pauseTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}timerRunning=false;renderTimer();}
  function startPauseTimer(){
    if(timerRunning){pauseTimer();showToast("หยุดพักเวลาไว้แล้ว");return;}
    if(timerSeconds<=0)timerSeconds=Number($("focusMinutes").value||25)*60;
    timerRunning=true;renderTimer();
    timerInterval=setInterval(()=>{
      timerSeconds=Math.max(0,timerSeconds-1);renderTimer();
      if(timerSeconds<=0){pauseTimer();finishSession();}
    },1000);
  }
  function finishSession(){
    const mins=Number($("focusMinutes").value||25);
    const task=data.tasks.find(t=>t.id===$("focusTaskSelect").value);
    data.sessions.push({id:uid(),date:localDateString(),minutes:mins,taskId:task?.id||null,taskTitle:task?.title||"",completedAt:new Date().toISOString()});
    data.xp+=15;saveData();renderAll();showToast(`ครบเวลาแล้ว! บันทึก ${mins} นาที และได้รับ 15 XP 🎉`);
    alert(`ครบเวลาโฟกัส ${mins} นาทีแล้ว! 🌷\nพักสายตาสักครู่ แล้วค่อยกลับมาลุยต่อ`);
  }
  function resetTimer(){
    pauseTimer();timerSeconds=Number($("focusMinutes").value||data.settings.focus||25)*60;renderTimer();showToast("รีเซ็ตเวลาแล้ว");
  }
  function updateDateHeader(){
    $("todayDate").textContent=new Date().toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  }

  document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();showPage(el.dataset.page);}));
  $("quickAddBtn").addEventListener("click",()=>openTaskDialog());
  $("dashboardAddTask").addEventListener("click",()=>openTaskDialog());
  $("tasksAddBtn").addEventListener("click",()=>openTaskDialog());
  $("taskForm").addEventListener("submit",e=>{
    e.preventDefault();
    const title=$("taskTitle").value.trim();if(!title){showToast("กรุณาใส่ชื่องาน");return;}
    const id=$("editTaskId").value;
    const existing=data.tasks.find(t=>t.id===id);
    const task={id:id||uid(),title,subject:$("taskSubject").value.trim(),dueDate:$("taskDueDate").value,priority:$("taskPriority").value,details:$("taskDetails").value.trim(),done:existing?.done||false,xpAwarded:existing?.xpAwarded||false,createdAt:existing?.createdAt||new Date().toISOString()};
    if(existing)data.tasks=data.tasks.map(t=>t.id===id?task:t);else data.tasks.push(task);
    saveData();$("taskDialog").close();renderAll();showToast(existing?"แก้ไขการบ้านแล้ว":"เพิ่มการบ้านแล้ว ✨");
  });
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
  $("fullTaskList").addEventListener("change",handleTaskAction);
  $("dashboardTaskList").addEventListener("change",handleTaskAction);
  $("fullTaskList").addEventListener("click",handleTaskAction);
  $("dashboardTaskList").addEventListener("click",handleTaskAction);
  $("taskSearch").addEventListener("input",renderTaskLists);
  $("taskFilter").addEventListener("change",renderTaskLists);
  $("dashboardFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;dashboardFilter=b.dataset.filter;renderTaskLists();});
  $("addClassBtn").addEventListener("click",()=>openClassDialog());
  $("dayTabs").addEventListener("click",e=>{const b=e.target.closest("[data-day]");if(!b)return;selectedDay=Number(b.dataset.day);renderTimetable();renderClassEditControls();});
  $("scheduleList").addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit-class]");const del=e.target.closest("[data-delete-class]");
    if(edit){const cls=data.classes.find(c=>c.id===edit.dataset.editClass);if(cls)openClassDialog(cls);}
    if(del){const cls=data.classes.find(c=>c.id===del.dataset.deleteClass);if(cls&&confirm(`ลบวิชา "${cls.name}" หรือไม่?`)){data.classes=data.classes.filter(c=>c.id!==cls.id);saveData();renderTimetable();renderClassEditControls();showToast("ลบวิชาแล้ว");}}
  });
  $("classForm").addEventListener("submit",e=>{
    e.preventDefault();const name=$("className").value.trim(),start=$("classStart").value,end=$("classEnd").value;
    if(!name){showToast("กรุณาใส่ชื่อวิชา");return;}
    if(start>=end){showToast("เวลาเลิกต้องอยู่หลังเวลาเริ่ม");return;}
    const day=Number($("classDay").value);
    const overlap=data.classes.some(c=>c.id!==$("editClassId").value&&Number(c.day)===day&&start<c.end&&end>c.start);
    if(overlap&&!confirm("เวลานี้ซ้อนกับวิชาอื่น ต้องการบันทึกต่อหรือไม่?"))return;
    const id=$("editClassId").value,existing=data.classes.find(c=>c.id===id);
    const cls={id:id||uid(),name,day,start,end,room:$("classRoom").value.trim()};
    if(existing)data.classes=data.classes.map(c=>c.id===id?cls:c);else data.classes.push(cls);
    selectedDay=day;saveData();$("classDialog").close();renderTimetable();renderClassEditControls();showToast(existing?"แก้ไขวิชาแล้ว":"เพิ่มวิชาแล้ว 📚");
  });
  $("focusStart").addEventListener("click",startPauseTimer);
  $("dashboardStart").addEventListener("click",startPauseTimer);
  $("focusReset").addEventListener("click",resetTimer);
  $("dashboardReset").addEventListener("click",resetTimer);
  $("focusMinutes").addEventListener("change",()=>{if(!timerRunning){timerSeconds=Number($("focusMinutes").value)*60;renderTimer();}});
  $("focusTaskSelect").addEventListener("change",renderTimer);
  $("settingsForm").addEventListener("submit",e=>{
    e.preventDefault();data.settings.name=$("displayName").value.trim();data.settings.goal=$("studyGoal").value.trim();data.settings.focus=Number($("defaultFocus").value||25);
    if(!timerRunning)timerSeconds=data.settings.focus*60;
    saveData();renderAll();showToast("บันทึกการตั้งค่าแล้ว 💜");
  });
  $("exportDataBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`studysnap-backup-${localDateString()}.json`;a.click();URL.revokeObjectURL(url);showToast("ดาวน์โหลดข้อมูลสำรองแล้ว");
  });
  $("clearDataBtn").addEventListener("click",()=>{
    if(!confirm("ต้องการลบการบ้าน ตารางเรียน สถิติ และการตั้งค่าทั้งหมดจากเบราว์เซอร์นี้ใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้"))return;
    pauseTimer();data=defaultData();saveData();timerSeconds=25*60;renderAll();showToast("ลบข้อมูลในเครื่องแล้ว");
  });
  updateDateHeader();renderAll();renderClassEditControls();
})();