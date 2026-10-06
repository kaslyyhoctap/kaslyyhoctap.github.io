/* ÔnTập12 — vanilla SPA. ponytail: 1 file logic, không framework, không build. */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var LS="ontap12-v1";
var store={get:function(){try{return JSON.parse(localStorage.getItem(LS))||{}}catch(e){return{}}},set:function(s){try{localStorage.setItem(LS,JSON.stringify(s))}catch(e){}}};
var S=Object.assign({theme:"light",best:0,exams:0,correct:0,answered:{},marked:[],hist:[],prog:{}},store.get());
function save(){store.set(S)}
var META={
 history:{name:"Lịch sử 12",icon:"H",lessons:{1:"Bài 1: Liên Hợp Quốc",2:"Bài 2: Trật tự thế giới trong Chiến tranh lạnh",3:"Bài 3: Trật tự thế giới sau Chiến tranh lạnh"}},
 biology:{name:"Sinh học 12",icon:"B",lessons:{1:"Bài 1: DNA và cơ chế tái bản DNA",2:"Bài 2: Gene và truyền đạt thông tin di truyền",3:"Bài 3: Điều hoà biểu hiện gene"}}
};
var Q=(window.QBANK||[]).filter(function(q){return q&&q.id&&q.question&&q.options&&q.options.length===4&&q.correctAnswer>=0&&q.correctAnswer<4&&q.explanation});
var seen={},DUP=[];
Q=Q.filter(function(q){var k=q.question.trim().toLowerCase();if(seen[k]){DUP.push(q.id);return false}seen[k]=1;return true});
if(!Q.length){document.body.insertAdjacentHTML("afterbegin",'<div class="wrap panel" style="margin-top:16px"><b>Lỗi dữ liệu:</b> chưa tải được câu hỏi. Hãy kiểm tra thư mục <code>data/</code>.</div>');return}

function toast(m){var t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(function(){t.hidden=true},2600)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function byId(id){return Q.find(function(q){return q.id===id})}

/* theme */
function applyTheme(){document.documentElement.dataset.theme=S.theme;$("themeLbl").textContent=S.theme==="light"?"Sáng":"Tối"}
$("themeBtn").onclick=function(){S.theme=S.theme==="light"?"dark":"light";save();applyTheme()};applyTheme();

/* router */
var views=["home","subject","theory","quiz","bank","progress","result"];
function go(v){views.forEach(function(x){$("view-"+x).hidden=x!==v});document.querySelectorAll(".nav-btn").forEach(function(b){b.classList.toggle("active",b.dataset.nav===v||(v==="subject"&&curSub&&b.dataset.nav===curSub))});window.scrollTo({top:0,behavior:"smooth"});$("main").querySelector("h1,h2")?.setAttribute("tabindex","-1")}
document.addEventListener("click",function(e){var b=e.target.closest("[data-nav]");if(!b)return;var v=b.dataset.nav;
 if(v==="home")renderHome();
 else if(v==="history"||v==="biology")renderSubject(v);
 else if(v==="bank")renderBank();
 else if(v==="progress")renderProgress();
 go(v==="history"||v==="biology"?"subject":v)});

/* ---------- HOME ---------- */
function counts(sub){return Q.filter(function(q){return q.subject===sub}).length}
function subjProg(sub){var p=S.prog[sub]||{};var ls=[1,2,3].map(function(l){return p[l]||0});return Math.round(ls.reduce(function(a,b){return a+b},0)/3)}
function renderHome(){
 var cards=Object.keys(META).map(function(k){var m=META[k];
  return '<div class="panel subj-card"><div class="top"><span class="badge '+(k==="history"?"h":"b")+'">'+m.name+'</span>'
  +'<h3>'+m.name+'</h3><p class="muted">3 bài học · '+counts(k)+' câu hỏi · Kết nối tri thức</p>'
  +'<div class="pbar" role="progressbar" aria-valuenow="'+subjProg(k)+'" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ '+m.name+'"><i style="width:'+subjProg(k)+'%"></i></div>'
  +'<p class="small muted">Tiến độ '+subjProg(k)+'%</p>'
  +'<div class="row"><button class="btn '+(k==="history"?"btn-primary":"btn-bio")+'" data-nav="'+k+'">Bắt đầu học</button></div></div></div>'}).join("");
 $("subjectCards").innerHTML=cards;
 var lc=[];Object.keys(META).forEach(function(k){[1,2,3].forEach(function(l){
  var n=Q.filter(function(q){return q.subject===k&&q.lesson===l}).length;
  var p=(S.prog[k]||{})[l]||0;var th=window.THEORY[k][l];
  lc.push('<div class="panel lesson-card"><span class="badge '+(k==="history"?"h":"b")+'">'+META[k].name+'</span><h3>'+esc(th.title)+'</h3><p>'+esc(th.desc)+'</p><div class="lesson-meta"><span class="badge">'+n+' câu</span><span class="badge">'+p+'% tiến độ</span></div><div class="pbar"><i style="width:'+p+'%"></i></div><div class="row"><button class="btn btn-sm" data-theory="'+k+':'+l+'">Học lý thuyết</button><button class="btn btn-sm btn-primary" data-quiz="'+k+':'+l+'">Luyện ngay</button></div></div>')})});
 $("lessonCards").innerHTML=lc;
 var tot=S.hist.length,best=S.hist.reduce(function(m,h){return Math.max(m,h.point)},0);
 $("heroBest").textContent=tot?best.toFixed(2):"–";
 $("heroStats").innerHTML='<div><b>'+Q.length+'</b><span>câu hỏi</span></div><div><b>'+tot+'</b><span>đề đã làm</span></div><div><b>'+(tot?best.toFixed(1):"–")+'</b><span>điểm cao nhất</span></div>';
 $("heroBars").innerHTML=["history","biology"].map(function(k){return [1,2,3].map(function(l){var p=(S.prog[k]||{})[l]||0;return '<div class="hbar"><span>'+(k==="history"?"Sử":"Sinh")+' B'+l+'</span><i><em style="width:'+p+'%"></em></i><span>'+p+'%</span></div>'}).join("")}).join("");
 go("home");
}
document.addEventListener("click",function(e){
 var t=e.target.closest("[data-theory]");if(t){var a=t.dataset.theory.split(":");renderTheory(a[0],+a[1]);return}
 var q=e.target.closest("[data-quiz]");if(q){var b=q.dataset.quiz.split(":");startExam({subject:b[0],lesson:b[1],count:10,time:10,practice:true});}
});

/* ---------- SUBJECT ---------- */
var curSub="history";
function renderSubject(sub){curSub=sub;var m=META[sub];var th=window.THEORY[sub];
 $("subjectHead").innerHTML='<h2>'+m.name+' <small class="muted">· '+counts(sub)+' câu · Bài 1–3</small></h2><p class="muted">Kết nối tri thức — chọn bài để học lý thuyết, luyện trắc nghiệm hoặc tạo đề kiểm tra tính giờ.</p>';
 $("subjectLessons").innerHTML=[1,2,3].map(function(l){var n=Q.filter(function(q){return q.subject===sub&&q.lesson===l}).length;var p=(S.prog[sub]||{})[l]||0;
  return '<div class="panel lesson-card"><h3>'+esc(th[l].title)+'</h3><p>'+esc(th[l].desc)+'</p><div class="lesson-meta"><span class="badge">'+n+' câu</span><span class="badge">Nhận biết → Vận dụng cao</span></div><div class="pbar"><i style="width:'+p+'%"></i></div><p class="small muted">Tiến độ '+p+'%</p><div class="row"><button class="btn btn-sm" data-theory="'+sub+':'+l+'">Học lý thuyết</button><button class="btn btn-sm btn-primary" data-quiz="'+sub+':'+l+'">Trắc nghiệm</button><button class="btn btn-sm btn-ghost" data-test="'+sub+':'+l+'">Kiểm tra</button></div></div>'}).join("")
 +'<div class="panel lesson-card"><h3>Tổng hợp 3 bài</h3><p>Đề trộn cả 3 bài, đúng như kiểm tra cuối kỳ.</p><div class="lesson-meta"><span class="badge">'+counts(sub)+' câu</span></div><div class="row"><button class="btn btn-sm btn-primary" data-test="'+sub+':all">Kiểm tra tổng hợp</button></div></div>';
 go("subject");
}
document.addEventListener("click",function(e){var t=e.target.closest("[data-test]");if(!t)return;var a=t.dataset.test.split(":");$("cfgLesson").value=a[1];collectCfg(a[0],false)});
function collectCfg(sub,practice){startExam({subject:sub||curSub,lesson:$("cfgLesson").value,count:+$("cfgCount").value,time:+$("cfgTime").value,level:$("cfgLevel").value,shQ:$("cfgShuffleQ").checked,shA:$("cfgShuffleA").checked,practice:practice})}
$("cfgStart").onclick=function(){collectCfg(null,false)};$("cfgPractice").onclick=function(){collectCfg(null,true)};
$("quickBtn").onclick=function(){startExam({subject:Math.random()<.5?"history":"biology",lesson:"all",count:10,time:10,practice:false,quick:true})};
$("theoryBack").onclick=function(){renderSubject(curSub)};

/* ---------- THEORY ---------- */
function renderTheory(sub,l){curSub=sub;var t=window.THEORY[sub][l];
 $("theoryBody").innerHTML='<p class="eyebrow">'+META[sub].name+'</p><h2 style="margin-top:0">'+esc(t.title)+'</h2><p class="muted">'+esc(t.desc)+'</p>'+t.html+'<div class="row"><button class="btn btn-primary" data-quiz="'+sub+':'+l+'">Luyện trắc nghiệm bài này</button></div>';
 go("theory");
}

/* ---------- QUIZ ---------- */
var E=null,timerH=null;
function pool(o){var list=Q.filter(function(q){return q.subject===o.subject&&(o.lesson==="all"||q.lesson===+o.lesson)&&(!o.level||o.level==="all"||q.difficulty===o.level)});
 if(o.shQ!==false)list=shuffle(list);
 // ưu tiên câu chưa làm gần đây
 var recent=S.hist.slice(-3).flatMap(function(h){return h.ids||[]});
 list=list.sort(function(a,b){return (recent.includes(a.id)?1:0)-(recent.includes(b.id)?1:0)});
 return list.slice(0,Math.min(o.count,list.length))}
function startExam(o){
 var list=pool(o);
 if(!list.length){toast("Không có câu hỏi phù hợp bộ lọc");return}
 E={cfg:o,qs:list.map(function(q){var opts=q.options.map(function(t,i){return{t:t,ok:i===q.correctAnswer}});
  if(o.shA!==false)opts=shuffle(opts);
  return{id:q.id,opts:opts}}),ans:new Array(list.length).fill(-1),flag:new Array(list.length).fill(false),i:0,practice:!!o.practice,t0:Date.now(),limit:o.time*60};
 renderQ();go("quiz");startTimer();
}
function startTimer(){clearInterval(timerH);tick();timerH=setInterval(tick,1000)}
function tick(){if(!E)return;var el=Math.floor((Date.now()-E.t0)/1000);var left=E.limit-el;
 if(left<=0){submit(true);return}
 var m=Math.floor(left/60),s=left%60;var t=$("qTimer");t.textContent=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;t.classList.toggle("low",left<60)}
function curQ(){return byId(E.qs[E.i].id)}
function renderQ(){
 var q=curQ(),st=E.qs[E.i];
 $("qTitle").textContent=(E.cfg.quick?"Kiểm tra nhanh · ":E.practice?"Luyện tập · ":"Kiểm tra · ")+META[E.cfg.subject].name+(E.cfg.lesson==="all"?" · Tổng hợp":" · Bài "+E.cfg.lesson);
 $("qCount").textContent="Câu "+(E.i+1)+"/"+E.qs.length;
 var done=E.ans.filter(function(a){return a>=0}).length;
 $("qDone").textContent="Đã làm: "+done;
 var pct=Math.round(done/E.qs.length*100);$("qProg").style.width=pct+"%";$("qProgWrap").setAttribute("aria-valuenow",pct);
 $("qFlag").textContent=(E.flag[E.i]?"★ ":"☆ ")+"Đánh dấu xem lại";
 $("qTopic").textContent=q.topic+" · "+q.difficulty;
 $("qText").textContent="Câu "+(E.i+1)+": "+q.question;
 var box=$("qOpts");box.innerHTML="";
 st.opts.forEach(function(op,idx){
  var b=document.createElement("button");b.className="opt"+(E.ans[E.i]===idx?" sel":"");b.setAttribute("role","radio");b.setAttribute("aria-checked",E.ans[E.i]===idx);
  b.innerHTML='<span class="k">'+["A","B","C","D"][idx]+'</span><span>'+esc(op.t)+'</span>';
  b.onclick=function(){answer(idx)};box.appendChild(b)});
 if(E.practice&&E.ans[E.i]>=0){box.querySelectorAll(".opt").forEach(function(el,idx){if(st.opts[idx].ok)el.classList.add("practice-ok");else if(idx===E.ans[E.i])el.classList.add("practice-bad")});
  if(!box.querySelector(".exp")){var d=document.createElement("div");d.className="rev exp";d.innerHTML="<b>Giải thích:</b> "+esc(q.explanation);box.appendChild(d)}}
 var pal=$("qPal");pal.innerHTML="";
 E.qs.forEach(function(s,n){var b=document.createElement("button");b.textContent=(n+1<10?"0":"")+(n+1);
  b.className=(E.ans[n]>=0?"done ":"")+(n===E.i?"cur":"");if(E.flag[n])b.classList.add("flag");
  b.setAttribute("aria-label","Câu "+(n+1)+(E.ans[n]>=0?" đã làm":" chưa làm"));b.onclick=function(){E.i=n;renderQ()};pal.appendChild(b)});
 $("qPrev").disabled=E.i===0;$("qNext").disabled=E.i===E.qs.length-1;
}
function answer(i){E.ans[E.i]=i;renderQ();if(E.i<E.qs.length-1&&!E.practice){/* ở lại để xem lại, không tự nhảy */}}
$("qPrev").onclick=function(){if(E.i>0){E.i--;renderQ()}};
$("qNext").onclick=function(){if(E.i<E.qs.length-1){E.i++;renderQ()}};
$("qFlag").onclick=function(){E.flag[E.i]=!E.flag[E.i];save();renderQ()};
document.addEventListener("keydown",function(e){
 if($("view-quiz").hidden||!E)return;
 if(e.key>="1"&&e.key<="4"){answer(+e.key-1)}
 else if(e.key==="ArrowRight"){if(E.i<E.qs.length-1){E.i++;renderQ()}}
 else if(e.key==="ArrowLeft"){if(E.i>0){E.i--;renderQ()}}});
$("qSubmit").onclick=function(){submit(false)};$("qSubmit2").onclick=function(){submit(false)};
function verdict(p){return p<5?["Cần cố gắng","low"]:p<6.5?["Đạt","mid"]:p<8?["Khá","mid"]:p<9?["Tốt","good"]:["Xuất sắc","good"]}
function submit(auto){
 clearInterval(timerH);
 var ok=0,bad=0,skip=0,topics={};
 E.qs.forEach(function(s,n){var q=byId(s.id);var a=E.ans[n];
  var st=a>=0?(s.opts[a].ok?"ok":"bad"):"skip";
  S.answered[s.id]=st;if(st==="ok"){ok++;S.correct++}
  if(st==="ok")bad+=0;else if(st==="bad")bad++;else skip++;
  var tp=topics[q.topic]=topics[q.topic]||{ok:0,tot:0};tp.tot++;if(st==="ok")tp.ok++});
 var secs=Math.min(Math.floor((Date.now()-E.t0)/1000),E.limit);
 var tot=E.qs.length,point=Math.round(ok/tot*100)/10;
 S.exams++;S.best=Math.max(S.best,point);
 // tiến độ từng bài: % câu đúng trên tổng câu của bài
 ["history","biology"].forEach(function(sub){S.prog[sub]=S.prog[sub]||{};[1,2,3].forEach(function(l){
  var all=Q.filter(function(q){return q.subject===sub&&q.lesson===l});
  var good=all.filter(function(q){return S.answered[q.id]==="ok"}).length;
  S.prog[sub][l]=Math.round(good/all.length*100)})});
 var rec={when:Date.now(),sub:E.cfg.subject,lesson:E.cfg.lesson,point:point,ok:ok,tot:tot,time:secs,ids:E.qs.map(function(s){return s.id})};
 S.hist.unshift(rec);S.hist=S.hist.slice(0,20);save();
 // result
 $("rSub").textContent=(auto?"Hết giờ · ":"")+META[E.cfg.subject].name+(E.cfg.lesson==="all"?" · Tổng hợp 3 bài":" · Bài "+E.cfg.lesson);
 $("rPoint").textContent=point.toFixed(1);
 $("rFrac").textContent=ok+"/"+tot+" · "+Math.round(ok/tot*100)+"%";
 var v=verdict(point);var ve=$("rVerdict");ve.textContent=v[0];ve.className="r-verdict "+v[1];
 $("rOk").textContent=ok;$("rBad").textContent=bad;$("rSkip").textContent=skip;
 $("rTime").textContent=Math.floor(secs/60)+":"+String(secs%60).padStart(2,"0");
 $("rTopics").innerHTML="<h3>Kết quả theo chủ đề</h3>"+Object.keys(topics).map(function(t){var p=Math.round(topics[t].ok/topics[t].tot*100);
  return '<div class="trow"><span>'+esc(t)+'</span><span class="pbar"><i style="width:'+p+'%"></i></span><b>'+topics[t].ok+'/'+topics[t].tot+'</b></div>'}).join("");
 var list=$("rList");list.innerHTML="<h2>Chi tiết từng câu</h2>";
 E._wrongOnly=false;
 var renderList=function(onlyWrong){
  list.innerHTML="<h2>Chi tiết từng câu"+(onlyWrong?" (chỉ câu sai/bỏ qua)":"")+"</h2>";
  E.qs.forEach(function(s,n){var q=byId(s.id);var a=E.ans[n];var st=a>=0?(s.opts[a].ok?"ok":"bad"):"skip";
   if(onlyWrong&&st==="ok")return;
   var d=document.createElement("div");d.className="panel rev";
   d.innerHTML='<div class="rev-head"><b>Câu '+(n+1)+'</b><span class="tag '+st+'">'+(st==="ok"?"Đúng":st==="bad"?"Sai":"Bỏ qua")+'</span><span class="chip">'+esc(q.topic)+' · '+esc(q.difficulty)+'</span></div>'
   +'<p>'+esc(q.question)+'</p>'
   +s.opts.map(function(op,idx){var mk=op.ok?" ✓":"";var mine=(idx===a&&!op.ok)?" ✗":"";
    return '<div class="opt'+(op.ok?" practice-ok":idx===a?" practice-bad":"")+'" style="cursor:default"><span class="k">'+["A","B","C","D"][idx]+'</span><span>'+esc(op.t)+mk+mine+'</span></div>'}).join("")
   +'<div class="exp"><b>Đáp án đúng: '+["A","B","C","D"][s.opts.findIndex(function(o){return o.ok})]+'</b><br><b>Giải thích:</b> '+esc(q.explanation)+'<br><span class="muted small">Nguồn: '+esc(q.source)+'</span></div>';
   list.appendChild(d)})};
 renderList(false);
 $("rWrong").onclick=function(){E._wrongOnly=!E._wrongOnly;renderList(E._wrongOnly);$("rWrong").textContent=E._wrongOnly?"Xem tất cả câu":"Xem lại câu sai";window.scrollTo({top:document.querySelector(".result-hero").offsetHeight})};
 $("rRetry").onclick=function(){startExam(E.cfg)};
 $("rNew").onclick=function(){var c=Object.assign({},E.cfg);startExam(c)};
 E._renderList=renderList;E._res={ok:ok,tot:tot,point:point};
 toast(auto?"Hết giờ — đã tự nộp bài":"Đã chấm bài: "+point.toFixed(1)+"/10");
 go("result");
}

/* ---------- BANK ---------- */
function renderBank(){
 var sub=$("fSub").value,les=$("fLes").value,dif=$("fDif").value,st=$("fState").value,q=$("fQ").value.trim().toLowerCase();
 var list=Q.filter(function(x){
  return(!sub||x.subject===sub)&&(!les||x.lesson===+les)&&(!dif||x.difficulty===dif)
  &&(!q||x.question.toLowerCase().includes(q)||x.topic.toLowerCase().includes(q))
  &&(!st||(st==="todo"?!S.answered[x.id]:st==="done"?S.answered[x.id]==="ok":S.answered[x.id]==="bad"))});
 $("bankCount").textContent="· "+list.length+"/"+Q.length+" câu";
 $("bankList").innerHTML=list.length?list.slice(0,120).map(function(x){
  var s=S.answered[x.id];return '<details class="panel bank-item"><summary>['+(x.subject==="history"?"Sử":"Sinh")+' B'+x.lesson+'] '+esc(x.question)+' '+(s?'<span class="tag '+(s==="ok"?"ok":"bad")+'">'+(s==="ok"?"Đã đúng":"Đã sai")+'</span>':"")
  +'<br><span class="muted small">'+esc(x.topic)+' · '+esc(x.difficulty)+' · Nguồn: '+esc(x.source)+'</span></summary>'
  +'<ol type="A">'+x.options.map(function(o){return "<li>"+esc(o)+"</li>"}).join("")+'</ol><div class="exp"><b>Đáp án: '+["A","B","C","D"][x.correctAnswer]+'.</b> '+esc(x.explanation)+'</div></details>'}).join("")
 :'<div class="panel">Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.</div>';
 go("bank");
}
["fQ","fSub","fLes","fDif","fState"].forEach(function(id){$(id).addEventListener("input",renderBank)});

/* ---------- PROGRESS ---------- */
function renderProgress(){
 $("progCards").innerHTML=Object.keys(META).map(function(k){var m=META[k];
  var rows=[1,2,3].map(function(l){var p=(S.prog[k]||{})[l]||0;var n=Q.filter(function(q){return q.subject===k&&q.lesson===l}).length;
   var good=Q.filter(function(q){return q.subject===k&&q.lesson===l&&S.answered[q.id]==="ok"}).length;
   return '<div class="prog-row"><div class="lbl"><span>'+esc(m.lessons[l])+'</span><span>'+good+'/'+n+' đúng · '+p+'%</span></div><div class="pbar"><i style="width:'+p+'%"></i></div></div>'}).join("");
  return '<div class="panel"><h3>'+m.name+'</h3>'+rows+'</div>'}).join("");
 var tot=S.hist.length,best=S.hist.reduce(function(m,h){return Math.max(m,h.point)},0);
 $("histList").innerHTML=tot?'<div class="hist">'+S.hist.map(function(h){var d=new Date(h.when);
  return '<div class="hist-item"><span><b>'+h.point.toFixed(1)+'/10</b> · '+META[h.sub].name+' '+(h.lesson==="all"?"Tổng hợp":"Bài "+h.lesson)+' · '+h.ok+'/'+h.tot+'</span><span class="muted">'+d.toLocaleDateString("vi-VN")+' '+d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+'</span></div>'}).join("")+'</div><p class="muted">Tổng '+tot+' đề · điểm cao nhất '+best.toFixed(1)+' · '+S.correct+' câu đúng tích lũy</p>'
 :'<p class="muted">Chưa có đề nào. Hãy bắt đầu một bài kiểm tra — kết quả sẽ hiện ở đây.</p>';
 go("progress");
}
$("wipeBtn").onclick=function(){if(confirm("Xoá toàn bộ điểm, tiến độ và lịch sử?")){S=Object.assign(S,{best:0,exams:0,correct:0,answered:{},marked:[],hist:[],prog:{}});save();renderProgress();renderHome();toast("Đã xoá dữ liệu")}};

/* init */
renderHome();
})();
