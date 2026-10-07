/* ÔnTập12 — vanilla SPA. ponytail: 1 file logic, không framework, không build. */
(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var LS="ontap12-v1";
var store={get:function(){try{return JSON.parse(localStorage.getItem(LS))||{}}catch(e){return{}}},set:function(s){try{localStorage.setItem(LS,JSON.stringify(s))}catch(e){}}};
var S=Object.assign({theme:"light",best:0,exams:0,correct:0,answered:{},marked:[],hist:[],prog:{},vocabKnown:{},starred:{}},store.get());
function save(){store.set(S)}
var META={
 history:{name:"Lịch sử 12",short:"Sử",units:"Bài",book:"Kết nối tri thức",lessons:{1:"Bài 1: Liên Hợp Quốc",2:"Bài 2: Trật tự thế giới trong Chiến tranh lạnh",3:"Bài 3: Trật tự thế giới sau Chiến tranh lạnh"}},
 biology:{name:"Sinh học 12",short:"Sinh",units:"Bài",book:"Kết nối tri thức",lessons:{1:"Bài 1: DNA và cơ chế tái bản DNA",2:"Bài 2: Gene và truyền đạt thông tin di truyền",3:"Bài 3: Điều hoà biểu hiện gene"}},
 chemistry:{name:"Hóa học 12",short:"Hóa",units:"Chương",book:"Kết nối tri thức",lessons:{1:"Chương 1: Ester – Lipid",2:"Chương 2: Carbohydrate"}},
 english:{name:"Tiếng Anh 12",short:"Anh",units:"Unit",book:"Global Success",lessons:{1:"Unit 1: Life stories we admire",2:"Unit 2: A multicultural world"}}
};
var TYPES={multiple_choice:"Multiple Choice",cloze:"Cloze Test",word_usage_error:"Word Usage Error",closest_meaning:"Closest Meaning",reading_comprehension:"Reading Comprehension",true_false:"True/False"};
var SKILLS={Vocabulary:"Vocabulary",Grammar:"Grammar","Cloze test":"Cloze Test","Word usage":"Word Usage","Closest meaning":"Paraphrase","Reading":"Reading"};
function lessonsOf(sub){return Object.keys(META[sub].lessons).map(Number).sort(function(a,b){return a-b})}
function badgeCls(k){return k==="history"?"h":k==="biology"?"b":k==="chemistry"?"c":"e"}
function btnCls(k){return k==="history"?"btn-primary":k==="biology"?"btn-bio":k==="chemistry"?"btn-chem":"btn-eng"}
function subjTag(q){return q.subject==="history"?"Sử":q.subject==="biology"?"Sinh":q.subject==="chemistry"?"Hóa":"Anh"}
function unitTag(q){return (q.subject==="english"?"U":q.subject==="chemistry"?"C":"B")+q.lesson}
function typeOf(q){return q.type||"multiple_choice"}
function chipFor(q){var t=q.type?TYPES[q.type]:"";if(t&&q.topic&&t.toLowerCase()===q.topic.toLowerCase())t="";return esc(q.topic)+(t?" · "+esc(t):"")+" · "+esc(q.difficulty)+(q.band?" · Band "+Number(q.band).toFixed(1):"")}
var Q=(window.QBANK||[]).filter(function(q){return q&&q.id&&q.question&&((q.options&&q.options.length===4&&q.correctAnswer>=0&&q.correctAnswer<4)||(q.type==="true_false"&&q.statements&&q.statements.length===4))&&q.explanation});
var seen={};
Q=Q.filter(function(q){var k=(q.passageId||"")+q.question.trim().toLowerCase();if(seen[k])return false;seen[k]=1;return true});
if(!Q.length){document.body.insertAdjacentHTML("afterbegin",'<div class="wrap panel" style="margin-top:16px"><b>Lỗi dữ liệu:</b> chưa tải được câu hỏi. Hãy kiểm tra thư mục <code>data/</code>.</div>');return}

function toast(m){var t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(function(){t.hidden=true},2600)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function byId(id){return Q.find(function(q){return q.id===id})}
function chem(s){return esc(String(s).replace(/\bE5\b/g,"E\x015\x01").replace(/\bB(\d+)\b/g,"B\x01$1\x01")).replace(/([A-Za-z\)\]])(\d+)/g,"$1<sub>$2</sub>").replace(/\x01/g,"")}
function blankNo(q){var m=/\((\d+)\)/.exec(q.question||"");return m?m[1]:null}

/* theme */
function applyTheme(){document.documentElement.dataset.theme=S.theme;$("themeLbl").textContent=S.theme==="light"?"Sáng":"Tối"}
$("themeBtn").onclick=function(){S.theme=S.theme==="light"?"dark":"light";save();applyTheme()};applyTheme();

/* sidebar mobile + dropdown môn học: ponytail — 1 toggle gốc, mọi điều hướng đều đóng */
function setNav(open){document.body.classList.toggle("nav-open",!!open);var b=$("menuBtn");if(b)b.setAttribute("aria-expanded",open?"true":"false")}
function setSubj(open){var m=$("subjMenu"),b=$("subjBtn");if(!m||!b)return;var show=open===undefined?m.hidden:!!open;m.hidden=!show;document.body.classList.toggle("subj-open",show);b.setAttribute("aria-expanded",show?"true":"false")}
$("menuBtn").onclick=function(e){e.stopPropagation();setNav(!document.body.classList.contains("nav-open"))};
$("subjBtn").onclick=function(e){e.stopPropagation();setSubj()};
$("navScrim").onclick=function(){setNav(false)};
document.addEventListener("click",function(e){if(!e.target.closest(".nav-group"))setSubj(false)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){setNav(false);setSubj(false)}});

/* router */
var views=["home","subject","theory","quiz","bank","vocab","progress","result"];
var SUBJS=["history","biology","chemistry","english"];
function go(v){views.forEach(function(x){$("view-"+x).hidden=x!==v});document.querySelectorAll(".nav-btn").forEach(function(b){b.classList.toggle("active",b.dataset.nav===v||(v==="subject"&&curSub&&b.dataset.nav===curSub))});var sb=$("subjBtn");if(sb)sb.classList.toggle("active",v==="subject");setNav(false);setSubj(false);window.scrollTo({top:0,behavior:"smooth"});$("main").querySelector("h1,h2")?.setAttribute("tabindex","-1")}
document.addEventListener("click",function(e){var b=e.target.closest("[data-nav]");if(!b)return;var v=b.dataset.nav;
 if(v==="home")renderHome();
 else if(SUBJS.indexOf(v)>=0)renderSubject(v);
 else if(v==="bank")renderBank();
 else if(v==="vocab")renderVocab();
 else if(v==="progress"){renderProgress();renderWeak()}
 go(SUBJS.indexOf(v)>=0?"subject":v)});

/* ---------- HOME ---------- */
function counts(sub){return Q.filter(function(q){return q.subject===sub}).length}
function subjProg(sub){var p=S.prog[sub]||{};var ls=lessonsOf(sub).map(function(l){return p[l]||0});return ls.length?Math.round(ls.reduce(function(a,b){return a+b},0)/ls.length):0}
function renderHome(){
 var cards=Object.keys(META).map(function(k){var m=META[k];
  return '<div class="panel subj-card"><div class="top"><span class="badge '+badgeCls(k)+'">'+m.name+'</span>'
  +'<h3>'+m.name+'</h3><p class="muted">'+lessonsOf(k).length+' '+m.units+' · '+counts(k)+' câu hỏi · '+m.book+'</p>'
  +'<div class="pbar" role="progressbar" aria-valuenow="'+subjProg(k)+'" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ '+m.name+'"><i style="width:'+subjProg(k)+'%"></i></div>'
  +'<p class="small muted">Tiến độ '+subjProg(k)+'%</p>'
  +'<div class="row"><button class="btn '+btnCls(k)+'" data-nav="'+k+'">Bắt đầu học</button></div></div></div>'}).join("");
 $("subjectCards").innerHTML=cards;
 var lc=[];Object.keys(META).forEach(function(k){lessonsOf(k).forEach(function(l){
  var n=Q.filter(function(q){return q.subject===k&&q.lesson===l}).length;
  var p=(S.prog[k]||{})[l]||0;var th=(window.THEORY[k]||{})[l];if(!th)return;
  lc.push('<div class="panel lesson-card"><span class="badge '+badgeCls(k)+'">'+META[k].name+'</span><h3>'+esc(th.title)+'</h3><p>'+esc(th.desc)+'</p><div class="lesson-meta"><span class="badge">'+n+' câu</span><span class="badge">'+p+'% tiến độ</span></div><div class="pbar"><i style="width:'+p+'%"></i></div><div class="row"><button class="btn btn-sm" data-theory="'+k+':'+l+'">Học lý thuyết</button><button class="btn btn-sm btn-primary" data-quiz="'+k+':'+l+'">Luyện ngay</button></div></div>')})});
 $("lessonCards").innerHTML=lc.join("");
 var tot=S.hist.length,best=S.hist.reduce(function(m,h){return Math.max(m,h.point)},0);
 $("heroBest").textContent=tot?best.toFixed(2):"–";
 $("heroStats").innerHTML='<div><b>'+Q.length+'</b><span>câu hỏi</span></div><div><b>'+tot+'</b><span>đề đã làm</span></div><div><b>'+(tot?best.toFixed(1):"–")+'</b><span>điểm cao nhất</span></div>';
 $("heroBars").innerHTML=Object.keys(META).map(function(k){var m=META[k];return lessonsOf(k).map(function(l){var p=(S.prog[k]||{})[l]||0;return '<div class="hbar"><span>'+m.short+' '+(m.units==="Unit"?"U":m.units==="Chương"?"C":"B")+l+'</span><i><em style="width:'+p+'%"></em></i><span>'+p+'%</span></div>'}).join("")}).join("");
 go("home");
}
document.addEventListener("click",function(e){
 var t=e.target.closest("[data-theory]");if(t){var a=t.dataset.theory.split(":");renderTheory(a[0],+a[1]);return}
 var q=e.target.closest("[data-quiz]");if(q){var b=q.dataset.quiz.split(":");startExam({subject:b[0],lesson:b[1],count:10,time:10,practice:true});}
});

/* ---------- SUBJECT ---------- */
var curSub="history";
function typeCounts(sub,l){var tc={};Q.filter(function(q){return q.subject===sub&&q.lesson===l}).forEach(function(q){var t=typeOf(q);tc[t]=(tc[t]||0)+1});return tc}
function renderSubject(sub){curSub=sub;var m=META[sub];var th=window.THEORY[sub]||{};var ls=lessonsOf(sub);
 $("subjectHead").innerHTML='<h2>'+m.name+' <small class="muted">· '+counts(sub)+' câu · '+m.units+' 1–'+ls.length+'</small></h2><p class="muted">'+m.book+' — chọn '+m.units.toLowerCase()+' để học lý thuyết, luyện trắc nghiệm hoặc tạo đề kiểm tra tính giờ.</p>';
 var prev=$("cfgLesson").value;
 $("cfgLesson").innerHTML='<option value="all">Tổng hợp '+ls.length+' '+m.units.toLowerCase()+'</option>'+ls.map(function(l){return '<option value="'+l+'">'+m.units+' '+l+'</option>'}).join("");
 $("cfgLesson").value=ls.indexOf(+prev)>=0||prev==="all"?prev:"all";
 $("cfgTypeWrap").style.display=sub==="english"?"":"none";
 $("subjectLessons").innerHTML=ls.map(function(l){var n=Q.filter(function(q){return q.subject===sub&&q.lesson===l}).length;var p=(S.prog[sub]||{})[l]||0;
  var meta=sub==="english"?Object.keys(TYPES).map(function(t){return (typeCounts(sub,l)[t]||0)+" "+TYPES[t].split(" ")[0]}).join(" · "):"Nhận biết → Vận dụng cao";
  var title=(th[l]&&th[l].title)||(m.units+" "+l);
  var desc=(th[l]&&th[l].desc)||"";
  return '<div class="panel lesson-card"><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p><div class="lesson-meta"><span class="badge">'+n+' câu</span><span class="badge">'+meta+'</span></div><div class="pbar"><i style="width:'+p+'%"></i></div><p class="small muted">Tiến độ '+p+'%</p><div class="row"><button class="btn btn-sm" data-theory="'+sub+':'+l+'">Học lý thuyết</button><button class="btn btn-sm btn-primary" data-quiz="'+sub+':'+l+'">Trắc nghiệm</button><button class="btn btn-sm btn-ghost" data-test="'+sub+':'+l+'">Kiểm tra</button></div></div>'}).join("")
 +'<div class="panel lesson-card"><h3>Tổng hợp '+ls.length+' '+m.units.toLowerCase()+'</h3><p>Đề trộn đủ các '+(sub==="english"?"dạng bài":"bài học")+', đúng như kiểm tra cuối kỳ.</p><div class="lesson-meta"><span class="badge">'+counts(sub)+' câu</span></div><div class="row"><button class="btn btn-sm btn-primary" data-test="'+sub+':all">Kiểm tra tổng hợp</button></div></div>';
 go("subject");
}
document.addEventListener("click",function(e){var t=e.target.closest("[data-test]");if(!t)return;var a=t.dataset.test.split(":");$("cfgLesson").value=a[1];collectCfg(a[0],false)});
function collectCfg(sub,practice){startExam({subject:sub||curSub,lesson:$("cfgLesson").value,count:+$("cfgCount").value,time:+$("cfgTime").value,level:$("cfgLevel").value,qtype:(sub||curSub)==="english"?$("cfgType").value:"all",shQ:$("cfgShuffleQ").checked,shA:$("cfgShuffleA").checked,practice:practice})}
$("cfgStart").onclick=function(){collectCfg(null,false)};$("cfgPractice").onclick=function(){collectCfg(null,true)};
$("quickBtn").onclick=function(){startExam({subject:SUBJS[Math.floor(Math.random()*SUBJS.length)],lesson:"all",count:10,time:10,practice:false,quick:true})};
$("theoryBack").onclick=function(){renderSubject(curSub)};

/* ---------- THEORY ---------- */
function renderTheory(sub,l){curSub=sub;var t=(window.THEORY[sub]||{})[l];if(!t){toast("Chưa có lý thuyết cho phần này");return}
 $("theoryBody").innerHTML='<p class="eyebrow">'+META[sub].name+' · '+META[sub].book+'</p><h2 style="margin-top:0">'+esc(t.title)+'</h2><p class="muted">'+esc(t.desc)+'</p>'+t.html+'<div class="row"><button class="btn btn-primary" data-quiz="'+sub+':'+l+'">Luyện trắc nghiệm phần này</button></div>';
 go("theory");
}

/* ---------- QUIZ ---------- */
var E=null,timerH=null;
var LS_EXAM=LS+"-exam";
function recentMap(){var r={};S.hist.slice(-3).forEach(function(h){(h.ids||[]).forEach(function(id){r[id]=1})});return r}
function pickFresh(arr,n,shQ){var a=shQ!==false?shuffle(arr):arr.slice();var r=recentMap();a=a.slice().sort(function(x,y){return (r[x.id]?1:0)-(r[y.id]?1:0)});return a.slice(0,Math.min(n,a.length))}
function pool(o){
 if(o.ids&&o.ids.length){var seen={},arr=[];o.ids.forEach(function(id){var q=byId(id);if(q&&!seen[id]){seen[id]=1;arr.push(q)}});return pickFresh(arr,o.count||arr.length,o.shQ)}
 var base=Q.filter(function(q){return q.subject===o.subject&&(o.lesson==="all"||q.lesson===+o.lesson)&&(!o.level||o.level==="all"||q.difficulty===o.level)&&(!o.topic||q.topic===o.topic)&&(!o.band||q.band===+o.band)});
 if(o.subject==="chemistry"&&(!o.qtype||o.qtype==="all")){var tfs=base.filter(function(q){return typeOf(q)==="true_false"});var rest=base.filter(function(q){return typeOf(q)!=="true_false"});var k=Math.min(2,tfs.length,o.count);var sel=pickFresh(tfs,k,o.shQ).concat(pickFresh(rest,o.count-k,o.shQ));return o.shQ!==false?shuffle(sel):sel}
 if(o.subject!=="english")return pickFresh(base,o.count,o.shQ);
 var qt=o.qtype||"all";
 if(qt!=="all"){var only=base.filter(function(q){return typeOf(q)===qt});
  if(qt==="cloze"||qt==="reading_comprehension"){var gs={};only.forEach(function(q){var p=q.passageId||"x";(gs[p]=gs[p]||[]).push(q)});var gl=Object.keys(gs).map(function(p){return gs[p]});var fl={};Q.filter(function(q){return q.subject==="english"&&q.passageId}).forEach(function(q){fl[q.passageId]=(fl[q.passageId]||0)+1});gl=gl.filter(function(g){var p=g[0].passageId;return !p||g.length===(fl[p]||g.length)});if(o.shQ!==false)gl=shuffle(gl);var take=[],n=o.count;gl.forEach(function(g){if(take.length+g.length<=n)take=take.concat(g)});if(!take.length&&gl.length)take=gl[0].slice(0,n);return take}
  return pickFresh(only,o.count,o.shQ)}
 var N=o.count;
 var mc=base.filter(function(q){return typeOf(q)==="multiple_choice"});
 var wue=base.filter(function(q){return typeOf(q)==="word_usage_error"});
 var cm=base.filter(function(q){return typeOf(q)==="closest_meaning"});
 var groups={};
 base.filter(function(q){return typeOf(q)==="cloze"||typeOf(q)==="reading_comprehension"}).forEach(function(q){var p=q.passageId||"x";(groups[p]=groups[p]||[]).push(q)});
 var ps=Object.keys(groups).map(function(p){return groups[p].sort(function(a,b){return (blankNo(a)||"")<(blankNo(b)||"")?-1:1})});
 var wantWUE=N>=30?5:(N>=20?3:1),wantCM=N>=30?5:(N>=20?2:1);
 var wueSel=pickFresh(wue,wantWUE,o.shQ),cmSel=pickFresh(cm,wantCM,o.shQ);
 var budget=N-wueSel.length-cmSel.length;
 // ponytail: passage (cloze/reading) là bó nguyên bài — chỉ lấy bài đọc còn đủ chỗ trống sau lọc, vừa ngân sách, không xẻ lẻ
 var fullLen={};
 Q.filter(function(q){return q.subject==="english"&&q.passageId}).forEach(function(q){fullLen[q.passageId]=(fullLen[q.passageId]||0)+1});
 var fullPs=ps.filter(function(g){var p=g[0].passageId;return g.length===(fullLen[p]||g.length)});
 if(o.shQ!==false)fullPs=shuffle(fullPs);
 var maxPass=(o.qtype==="cloze"||o.qtype==="reading_comprehension")?fullPs.length:(o.lesson==="all"?(N>=40?Math.min(2,fullPs.length):Math.min(1,fullPs.length)):Math.min(1,fullPs.length));
 var clozeSel=[];fullPs.slice(0,maxPass).forEach(function(g){if(clozeSel.length+g.length<=budget)clozeSel=clozeSel.concat(g)});
 if(o.level&&o.level!=="all"&&ps.length&&!clozeSel.length)toast("Bài đọc không đủ điều kiện mức độ đã chọn nên đề không gồm cloze");
 var mcSel=pickFresh(mc,Math.max(budget-clozeSel.length,0),o.shQ);
 var sel=mcSel.concat(clozeSel,wueSel,cmSel);
 if(sel.length<N){var used={};sel.forEach(function(q){used[q.id]=1});sel=sel.concat(pickFresh(base.filter(function(q){return !used[q.id]&&typeOf(q)!=="cloze"}),N-sel.length,o.shQ))}
 return sel.slice(0,Math.min(N,sel.length));
}
function passageHtml(q){
 if(!q.passageId||!window.PASSAGES||!window.PASSAGES[q.passageId])return "";
 var p=window.PASSAGES[q.passageId],bn=blankNo(q);
 var txt=esc(p.text).replace(/\((\d+)\)/g,function(m,n){return n===bn?'<span class="blank cur">('+n+')</span>':'<span class="blank">('+n+')</span>'});
 return '<div class="passage"><b>'+esc(p.title)+'</b><p>'+txt+'</p></div>';
}
function startExam(o){
 var list=pool(o);
 if(!list.length){toast("Không có câu hỏi phù hợp bộ lọc");return}
 if(list.length<o.count)toast("Kho đề có "+list.length+" câu phù hợp (đã lấy tối đa)");
 E={cfg:o,qs:list.map(function(q){if(typeOf(q)==="true_false")return{id:q.id,tf:[-1,-1,-1,-1]};var opts=q.options.map(function(t,i){return{t:t,ok:i===q.correctAnswer}});
  if(o.shA!==false)opts=shuffle(opts);
  return{id:q.id,opts:opts}}),ans:new Array(list.length).fill(-1),flag:new Array(list.length).fill(false),i:0,practice:!!o.practice,t0:Date.now(),limit:o.time*60};
 renderQ();go("quiz");startTimer();
}
function startTimer(){clearInterval(timerH);tick();timerH=setInterval(tick,1000)}
function tick(){if(!E)return;var el=Math.floor((Date.now()-E.t0)/1000);var left=E.limit-el;
 if(left<=0){submit(true);return}
 var m=Math.floor(left/60),s=left%60;var t=$("qTimer");t.textContent=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;t.classList.toggle("low",left<60)}
function curQ(){return byId(E.qs[E.i].id)}
function saveDraft(){try{if(E&&!$("view-quiz").hidden)localStorage.setItem(LS_EXAM,JSON.stringify(E));else localStorage.removeItem(LS_EXAM)}catch(e){}}

function qDoneN(n){var s=E.qs[n];return typeOf(byId(s.id))==="true_false"?s.tf.some(function(v){return v>=0}):E.ans[n]>=0}
function tfSt(q,s,a){if(typeOf(q)!=="true_false")return a>=0?(s.opts[a].ok?"ok":"bad"):"skip";var an=s.tf.filter(function(v){return v>=0}).length;if(!an)return "skip";return q.statements.every(function(t,i){return s.tf[i]===(t.ok?1:0)})?"ok":"bad"}
function answerTF(i,v){E.qs[E.i].tf[i]=v;renderQ()}
function renderTF(box,q,st){
 box.innerHTML="";
 q.statements.forEach(function(t,i){
  var row=document.createElement("div");row.className="tf-row";
  var cur=st.tf[i];
  row.innerHTML='<span class="tf-t"><b>'+"abcd"[i]+')</b> '+chem(t.t)+'</span>';
  [["D",1],["S",0]].forEach(function(p){
   var b=document.createElement("button");b.className="btn btn-sm"+(cur===p[1]?" btn-primary":" btn-ghost");b.textContent=p[0]==="D"?"Đúng":"Sai";
   b.onclick=function(){answerTF(i,p[1])};row.appendChild(b)});
  if(E.practice&&cur>=0)row.classList.add(cur===(t.ok?1:0)?"tf-ok":"tf-bad");
  box.appendChild(row)});
 if(E.practice&&st.tf.some(function(v){return v>=0})){var d=document.createElement("div");d.className="rev exp";d.innerHTML="<b>Giải thích:</b> "+chem(q.explanation);box.appendChild(d)}
}
function resultOpts(q,s,a){
 if(typeOf(q)!=="true_false")return s.opts.map(function(op,idx){var mk=op.ok?" ✓":"";var mine=(idx===a&&!op.ok)?" ✗":"";return '<div class="opt'+(op.ok?" practice-ok":idx===a?" practice-bad":"")+'" style="cursor:default"><span class="k">'+["A","B","C","D"][idx]+'</span><span>'+(q.subject==="chemistry"?chem(op.t):esc(op.t))+mk+mine+'</span></div>'}).join("");
 return q.statements.map(function(t,i){var mine=s.tf[i];var good=mine>=0&&mine===(t.ok?1:0);
  return '<div class="opt'+(mine>=0?(good?" practice-ok":" practice-bad"):"")+'" style="cursor:default"><span class="k">'+"abcd"[i]+'</span><span>'+chem(t.t)+'</span><b>'+(mine>=0?(mine?"Đúng":"Sai"):"—")+' · Đáp án: '+(t.ok?"Đúng":"Sai")+(mine>=0?(good?" ✓":" ✗"):"")+'</b></div>'}).join("");
}
function tfRows(q){return q.statements.map(function(s2,i){return '<div class="opt" style="cursor:default"><span class="k">'+"abcd"[i]+'</span><span>'+chem(s2.t)+'</span><b>'+(s2.ok?"Đúng":"Sai")+'</b></div>'}).join("")}
function renderQ(){
 var q=curQ(),st=E.qs[E.i],m=META[E.cfg.subject];
 var scope=E.cfg.lesson==="all"?" · Tổng hợp":(" · "+m.units+" "+E.cfg.lesson);
 var kind=E.cfg.subject==="english"&&E.cfg.qtype&&E.cfg.qtype!=="all"?(" · "+TYPES[E.cfg.qtype]):"";
 $("qTitle").textContent=(E.cfg.quick?"Kiểm tra nhanh · ":E.practice?"Luyện tập · ":"Kiểm tra · ")+m.name+scope+kind;
 $("qCount").textContent="Câu "+(E.i+1)+"/"+E.qs.length;
 var done=E.qs.filter(function(x,n){return qDoneN(n)}).length;
 $("qDone").textContent="Đã làm: "+done;
 var pct=Math.round(done/E.qs.length*100);$("qProg").style.width=pct+"%";$("qProgWrap").setAttribute("aria-valuenow",pct);
 $("qFlag").textContent=(E.flag[E.i]?"★ ":"☆ ")+"Đánh dấu xem lại";
  $("qStar").textContent=((S.starred&&S.starred[curQ().id])?"★ Sổ tay":"☆ Sổ tay");
 $("qTopic").textContent=q.topic+((E.cfg.subject==="english"&&q.type&&TYPES[q.type].toLowerCase()!==String(q.topic).toLowerCase())?" · "+TYPES[q.type]:"")+" · "+q.difficulty+(q.band?" · Band "+Number(q.band).toFixed(1):"");
 var head=passageHtml(q);
 $("qText").innerHTML=(head?head+"<br>":"")+"Câu "+(E.i+1)+": "+(q.subject==="chemistry"?chem(q.question):esc(q.question));
 var box=$("qOpts");box.innerHTML="";
 if(typeOf(q)==="true_false"){renderTF(box,q,st)}else{st.opts.forEach(function(op,idx){
  var b=document.createElement("button");b.className="opt"+(E.ans[E.i]===idx?" sel":"");b.setAttribute("role","radio");b.setAttribute("aria-checked",E.ans[E.i]===idx);
  b.innerHTML='<span class="k">'+["A","B","C","D"][idx]+'</span><span>'+(q.subject==="chemistry"?chem(op.t):esc(op.t))+'</span>';
  b.onclick=function(){answer(idx)};box.appendChild(b)});
 if(E.practice&&E.ans[E.i]>=0){box.querySelectorAll(".opt").forEach(function(el,idx){if(st.opts[idx].ok)el.classList.add("practice-ok");else if(idx===E.ans[E.i])el.classList.add("practice-bad")});
  if(!box.querySelector(".exp")){var d=document.createElement("div");d.className="rev exp";d.innerHTML="<b>Giải thích:</b> "+(q.subject==="chemistry"?chem(q.explanation):esc(q.explanation))+(q.wrongWord?"<br><b>Từ sai:</b> "+esc(q.wrongWord)+" → <b>nên dùng:</b> "+esc(q.correctWord):"");box.appendChild(d)}}
 }var pal=$("qPal");pal.innerHTML="";
 E.qs.forEach(function(s,n){var b=document.createElement("button");b.textContent=(n+1<10?"0":"")+(n+1);
  b.className=(qDoneN(n)?"done ":"")+(n===E.i?"cur":"");if(E.flag[n])b.classList.add("flag");
  b.setAttribute("aria-label","Câu "+(n+1)+(qDoneN(n)?" đã làm":" chưa làm"));b.onclick=function(){E.i=n;renderQ()};pal.appendChild(b)});
 $("qPrev").disabled=E.i===0;$("qNext").disabled=E.i===E.qs.length-1;
 saveDraft();
}
function answer(i){E.ans[E.i]=i;renderQ()}
$("qPrev").onclick=function(){if(E.i>0){E.i--;renderQ()}};
$("qNext").onclick=function(){if(E.i<E.qs.length-1){E.i++;renderQ()}};
$("qFlag").onclick=function(){E.flag[E.i]=!E.flag[E.i];save();renderQ()};
$("qStar").onclick=function(){S.starred=S.starred||{};var id=curQ().id;if(S.starred[id])delete S.starred[id];else S.starred[id]=1;save();renderQ()};
document.addEventListener("keydown",function(e){
 if($("view-quiz").hidden||!E)return;
 if(e.key>="1"&&e.key<="4"){if(typeOf(curQ())!=="true_false")answer(+e.key-1)}
 else if(e.key==="ArrowRight"){if(E.i<E.qs.length-1){E.i++;renderQ()}}
 else if(e.key==="ArrowLeft"){if(E.i>0){E.i--;renderQ()}}});
$("qSubmit").onclick=function(){submit(false)};$("qSubmit2").onclick=function(){submit(false)};
window.addEventListener("beforeunload",function(e){if(E&&!$("view-quiz").hidden){e.preventDefault();e.returnValue=""}});
function verdict(p){return p<5?["Cần cố gắng","low"]:p<6.5?["Đạt","mid"]:p<8?["Khá","mid"]:p<9?["Tốt","good"]:["Xuất sắc","good"]}
function submit(auto){
 clearInterval(timerH);
 try{localStorage.removeItem(LS_EXAM)}catch(e){}
 var ok=0,bad=0,skip=0,pts=0,topics={},types={};
 E.qs.forEach(function(s,n){var q=byId(s.id);var a=E.ans[n];var st,fr;
  if(typeOf(q)==="true_false"){var gd=q.statements.reduce(function(m,t,i){return m+(s.tf[i]===(t.ok?1:0)?1:0)},0);var an=s.tf.filter(function(v){return v>=0}).length;st=an===0?"skip":(gd===4?"ok":"bad");fr=gd===4?1:(gd===3?0.5:(gd===2?0.25:0))}
  else{st=a>=0?(s.opts[a].ok?"ok":"bad"):"skip";fr=st==="ok"?1:0}
  pts+=fr;S.answered[s.id]=st;if(st==="ok"){ok++;S.correct++}
  if(st==="bad")bad++;else if(st==="skip")skip++;
  var tp=topics[q.topic]=topics[q.topic]||{ok:0,tot:0};tp.tot++;if(st==="ok")tp.ok++;
  if(E.cfg.subject==="english"){var ty=types[typeOf(q)]=types[typeOf(q)]||{ok:0,tot:0};ty.tot++;if(st==="ok")ty.ok++}});
 var secs=Math.min(Math.floor((Date.now()-E.t0)/1000),E.limit);
 var tot=E.qs.length,point=Math.round(pts/tot*100)/10;
 S.exams++;S.best=Math.max(S.best,point);
 Object.keys(META).forEach(function(sub){S.prog[sub]=S.prog[sub]||{};lessonsOf(sub).forEach(function(l){
  var all=Q.filter(function(q){return q.subject===sub&&q.lesson===l});
  var good=all.filter(function(q){return S.answered[q.id]==="ok"}).length;
  S.prog[sub][l]=all.length?Math.round(good/all.length*100):0})});
 var rec={when:Date.now(),sub:E.cfg.subject,lesson:E.cfg.lesson,point:point,ok:ok,tot:tot,time:secs,ids:E.qs.map(function(s){return s.id})};
 S.hist.unshift(rec);S.hist=S.hist.slice(0,20);save();
 var m=META[E.cfg.subject];
 var scope=E.cfg.lesson==="all"?(" · Tổng hợp "+lessonsOf(E.cfg.subject).length+" "+m.units.toLowerCase()):(" · "+m.units+" "+E.cfg.lesson);
 $("rSub").textContent=(auto?"Hết giờ · ":"")+m.name+scope;
 $("rPoint").textContent=point.toFixed(1);
 $("rFrac").textContent=ok+"/"+tot+" · "+Math.round(ok/tot*100)+"%";
 var v=verdict(point);var ve=$("rVerdict");ve.textContent=v[0];ve.className="r-verdict "+v[1];
 $("rOk").textContent=ok;$("rBad").textContent=bad;$("rSkip").textContent=skip;
 $("rTime").textContent=Math.floor(secs/60)+":"+String(secs%60).padStart(2,"0");
 if(E.cfg.subject==="english"){$("rTopics").innerHTML="";}else{$("rTopics").innerHTML="<h3>Kết quả theo chủ đề</h3>"+Object.keys(topics).map(function(t){var p=Math.round(topics[t].ok/topics[t].tot*100);
  return '<div class="trow"><span>'+esc(t)+'</span><span class="pbar"><i style="width:'+p+'%"></i></span><b>'+topics[t].ok+'/'+topics[t].tot+'</b></div>'}).join("");}
 var rt=$("rTypes");
 if(E.cfg.subject==="english"){
  var order=["multiple_choice","cloze","word_usage_error","closest_meaning","reading_comprehension"];
   var letters={multiple_choice:"A",cloze:"B",word_usage_error:"C",closest_meaning:"D",reading_comprehension:"E"};
   var rows=order.map(function(t){var s=types[t];if(!s)return "";
   var p=Math.round(s.ok/s.tot*100);
    return '<div class="r-box"><b>'+s.ok+'/'+s.tot+'</b><span>Phần '+letters[t]+' · '+TYPES[t]+'</span><span class="pbar"><i style="width:'+p+'%"></i></span></div>'}).join("");
  var sk=Object.keys(SKILLS).map(function(k){var agg={ok:0,tot:0};E.qs.forEach(function(s,n){var q=byId(s.id);if(q.topic!==k)return;var a=E.ans[n];agg.tot++;if(a>=0&&s.opts[a].ok)agg.ok++});
   if(!agg.tot)return "";var note=agg.tot<3?' <span class="muted small">(cần ≥3 câu)</span>':"";
   return '<div class="trow"><span>'+SKILLS[k]+note+'</span><span class="pbar"><i style="width:'+Math.round(agg.ok/agg.tot*100)+'%"></i></span><b>'+Math.round(agg.ok/agg.tot*100)+'%</b></div>'}).join("");
  rt.innerHTML="<h3>Kết quả theo phần</h3>"+'<div class="r-grid r-parts">'+rows+'</div>'+(sk?"<h3>Kỹ năng theo chủ đề</h3>"+sk:"");
 }else rt.innerHTML="";
 var list=$("rList");list.innerHTML="<h2>Chi tiết từng câu</h2>";
 E._wrongOnly=false;
 var renderList=function(onlyWrong){
  list.innerHTML="<h2>Chi tiết từng câu"+(onlyWrong?" (chỉ câu sai/bỏ qua)":"")+"</h2>";
  E.qs.forEach(function(s,n){var q=byId(s.id);var a=E.ans[n];var st=tfSt(q,s,a);
   if(onlyWrong&&st==="ok")return;
   var d=document.createElement("div");d.className="panel rev";
   var extra=q.wrongWord?("<br><b>Từ sai:</b> "+esc(q.wrongWord)+" → <b>nên dùng:</b> "+esc(q.correctWord)):"";
   d.innerHTML='<div class="rev-head"><b>Câu '+(n+1)+'</b><button class="btn btn-sm btn-ghost" data-star="'+s.id+'">'+((S.starred&&S.starred[s.id])?"★ Sổ tay":"☆ Sổ tay")+'</button>'+'<span class="tag '+st+'">'+(st==="ok"?"Đúng":st==="bad"?"Sai":"Bỏ qua")+'</span><span class="chip">'+chipFor(q)+'</span></div>'
   +(q.passageId&&window.PASSAGES&&window.PASSAGES[q.passageId]?'<div class="passage"><b>'+esc(window.PASSAGES[q.passageId].title)+'</b><p>'+esc(window.PASSAGES[q.passageId].text)+'</p></div>':"")
   +'<p>'+(q.subject==="chemistry"?chem(q.question):esc(q.question))+'</p>'
   +resultOpts(q,s,a)
   +(typeOf(q)==="true_false"?'<div class="exp"><b>Đúng/Sai từng ý ở trên</b><br><b>Giải thích:</b> ':'<div class="exp"><b>Đáp án đúng: '+["A","B","C","D"][s.opts.findIndex(function(o){return o.ok})]+'</b><br><b>Giải thích:</b> ')+(q.subject==="chemistry"?chem(q.explanation):esc(q.explanation))+extra+'<br><span class="muted small">Nguồn: '+esc(q.source)+(q.sourceType?" ("+esc(q.sourceType)+")":"")+'</span></div>';
   list.appendChild(d)})};
 renderList(false);
 $("rWrong").onclick=function(){E._wrongOnly=!E._wrongOnly;renderList(E._wrongOnly);$("rWrong").textContent=E._wrongOnly?"Xem tất cả câu":"Xem lại câu sai";window.scrollTo({top:document.querySelector(".result-hero").offsetHeight})};
 $("rRetry").onclick=function(){startExam(E.cfg)};
  $("rDrill").onclick=function(){var ids=[];E.qs.forEach(function(s,n){var x=E.ans[n];if(!(x>=0&&s.opts[x].ok))ids.push(s.id)});if(!ids.length){toast("Không có câu sai — làm tốt lắm!");return}startExam({subject:E.cfg.subject,lesson:"all",count:ids.length,time:Math.max(5,Math.ceil(ids.length*1.5)),practice:true,shQ:true,shA:true,ids:ids})};
 $("rNew").onclick=function(){var c=Object.assign({},E.cfg);startExam(c)};
 toast(auto?"Hết giờ — đã tự nộp bài":"Đã chấm bài: "+point.toFixed(1)+"/10");
 go("result");
}

/* ---------- BANK ---------- */
function bankItem(x,s,det){
 var body=typeOf(x)==="true_false"
  ?'<div class="tf-list">'+tfRows(x)+'</div><div class="exp"><b>Đáp án từng ý ở trên.</b> '+(x.subject==="chemistry"?chem(x.explanation):esc(x.explanation))
  :'<ol type="A">'+x.options.map(function(o){return "<li>"+(x.subject==="chemistry"?chem(o):esc(o))+"</li>"}).join("")+'</ol><div class="exp"><b>Đáp án: '+["A","B","C","D"][x.correctAnswer]+'.</b> '+(x.subject==="chemistry"?chem(x.explanation):esc(x.explanation));
 return '<details class="panel bank-item"><summary>['+subjTag(x)+' '+unitTag(x)+(x.type?" · "+TYPES[x.type]:"")+'] '+(x.subject==="chemistry"?chem(x.question):esc(x.question))+' '+(s?'<span class="tag '+(s==="ok"?"ok":"bad")+'">'+(s==="ok"?"Đã đúng":"Đã sai")+'</span>':"")
 +'<br><span class="muted small">'+chipFor(x)+' · Nguồn: '+esc(x.source)+'</span></summary>'+det
 +body+(x.wrongWord?'<br><b>Từ sai:</b> '+esc(x.wrongWord)+' → <b>nên dùng:</b> '+esc(x.correctWord):"")+'</div></details>'}
function renderBank(){
 var sub=$("fSub").value,les=$("fLes").value,dif=$("fDif").value,st=$("fState").value,ft=$("fType").value,q=$("fQ").value.trim().toLowerCase();
 var list=Q.filter(function(x){
  return(!sub||x.subject===sub)&&(!les||x.lesson===+les)&&(!dif||x.difficulty===dif)
  &&(!ft||typeOf(x)===ft)
  &&(!q||x.question.toLowerCase().includes(q)||x.topic.toLowerCase().includes(q))
  &&(!st||(st==="star"?(S.starred&&S.starred[x.id]):st==="todo"?!S.answered[x.id]:st==="done"?S.answered[x.id]==="ok":S.answered[x.id]==="bad"))});
 $("bankCount").textContent="· "+list.length+"/"+Q.length+" câu";
 $("bankList").innerHTML=list.length?list.slice(0,120).map(function(x){
  var s=S.answered[x.id];
  var det=x.passageId&&window.PASSAGES&&window.PASSAGES[x.passageId]?'<div class="passage"><b>'+esc(window.PASSAGES[x.passageId].title)+'</b><p>'+esc(window.PASSAGES[x.passageId].text)+'</p></div>':"";
  return bankItem(x,s,det)}).join("")+(list.length>120?'<div class="panel muted">Chỉ hiện 120/'+list.length+' câu — hãy lọc hẹp hơn để xem hết.</div>':"")
 :'<div class="panel">Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.</div>';
 go("bank");
}
["fQ","fSub","fLes","fDif","fState","fType"].forEach(function(id){$(id).addEventListener("input",renderBank)});

/* ---------- VOCAB FLASHCARDS ---------- */
var V={list:[],i:0,flip:false,hideAll:false,starOnly:false};
function vocabAll(){return window.VOCAB||{}}
function vocabFilter(){
 var unit=$("vUnit").value||"1",kind=$("vKind").value||"",q=$("vQ").value.trim().toLowerCase();
 return (vocabAll()[unit]||[]).filter(function(w){
  return(!kind||w.kind===kind)&&(!V.starOnly||(S.starred&&S.starred["v::"+unit+"::"+w.en]))&&(!q||w.en.toLowerCase().includes(q)||(w.vi||"").toLowerCase().includes(q))});
}
function vocabKey(w){return $("vUnit").value+"::"+w.en}
function renderVocab(){
 V.list=vocabFilter();V.i=0;V.flip=false;
 var u=$("vUnit").value,all=(vocabAll()[u]||[]).length;
 $("vocabCount").textContent="· Unit "+u+" · "+V.list.length+"/"+all+" thẻ";
 renderFc();renderVGrid();
 go("vocab");
}
function fcFront(w){var envi=$("vMode").value!=="vien";return envi?w.en:w.vi}
function fcBack(w){var envi=$("vMode").value!=="vien";return envi?w.vi:w.en}
function renderFc(){
 var box=$("fcMain"),n=V.list.length;
 if(!n){box.classList.remove("flipped");box.innerHTML='<span class="muted">Không có thẻ nào. Hãy nới lỏng bộ lọc.</span>';$("fcCount").textContent="0/0";$("fcProg").style.width="0%";return}
 if(V.i<0)V.i=0;if(V.i>=n)V.i=n-1;
 var w=V.list[V.i],frontText=fcFront(w),backText=fcBack(w);
 var known=S.vocabKnown[vocabKey(w)];
 box.classList.toggle("flipped",V.flip);
 box.classList.remove("from-next","from-prev","anim");
 void box.offsetWidth;
 box.classList.add("anim");
 if(V.slide){box.classList.add(V.slide==="next"?"from-next":"from-prev");V.slide=null}
 box.setAttribute("aria-label","Thẻ từ vựng "+(V.i+1)+"/"+n+(V.flip?": "+backText:": "+frontText));
 box.innerHTML='<div class="fc-face fc-front"><div class="en">'+esc(frontText)+'</div>'
  +(w.pos&&$("vMode").value!=="vien"?'<div class="ipa">'+esc(w.pos+(w.ipa?" · "+w.ipa:""))+'</div>':"")
  +((!V.flip&&V.hideAll)?'<div class="hint">Bấm để hiện nghĩa</div>':"")
  +((!V.flip&&!V.hideAll)?'<div class="vi">'+esc(backText)+'</div>':"")
  +'<div class="hint">'+esc(w.kind==="phrase"?"Cụm từ":"Từ vựng")+' · Unit '+esc($("vUnit").value)+(known?" · Đã thuộc ✓":"")+'</div></div>'
  +'<div class="fc-face fc-back"><div class="en">'+esc(backText)+'</div>'
  +'<div class="hint">'+esc(w.kind==="phrase"?"Cụm từ":"Từ vựng")+' · Unit '+esc($("vUnit").value)+(known?" · Đã thuộc ✓":"")+'</div></div>';
 $("fcCount").textContent=(V.i+1)+"/"+n;
 var done=V.list.filter(function(x){return S.vocabKnown[$("vUnit").value+"::"+x.en]}).length;
 var pct=n?Math.round(done/n*100):0;$("fcProg").style.width=pct+"%";$("fcProgWrap").setAttribute("aria-valuenow",pct);
 var kb=$("fcKnow");kb.textContent=known?"Chưa thuộc":"Đã thuộc ✓";kb.setAttribute("aria-pressed",known?"true":"false");
  var _w=V.list[V.i];$("fcStar").textContent=(S.starred&&_w&&S.starred["v::"+vocabKey(_w)])?"★ Sổ tay":"☆ Sổ tay";
}
function renderVGrid(){
 var g=$("vocabGrid");if(!g)return;
 g.innerHTML=V.list.map(function(w,idx){
  var known=S.vocabKnown[vocabKey(w)];
  return '<button class="vcard'+(known?" known":"")+'" data-vi="'+idx+'"><span class="en">'+esc(w.en)+((S.starred&&S.starred["v::"+$("vUnit").value+"::"+w.en])?" \u2605":"")+'</span>'
  +(w.pos||w.ipa?'<span class="ipa">'+esc([w.pos,w.ipa].filter(Boolean).join(" · "))+'</span>':"")
  +'<span class="vi'+(V.hideAll?" masked":"")+'"><span>'+esc(w.vi)+'</span></span>'
  +'<span class="rowline"><span class="badge e">'+esc(w.kind==="phrase"?"Cụm từ":"Từ vựng")+'</span><span class="muted small">'+(known?"Đã thuộc ✓":"Bấm để lật")+'</span></span></button>'}).join("")
  ||'<div class="panel">Không có thẻ nào.</div>';
}
document.addEventListener("click",function(e){
 var c=e.target.closest(".vcard");if(!c)return;
 var w=V.list[+c.dataset.vi];if(!w)return;
 var vi=c.querySelector(".vi");if(vi)vi.classList.toggle("masked");
});
$("fcMain").onclick=function(){V.flip=!V.flip;renderFc()};
$("fcMain").onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();V.flip=!V.flip;renderFc()}};
$("fcPrev").onclick=function(){if(!V.list.length)return;V.i=(V.i-1+V.list.length)%V.list.length;V.flip=false;V.slide="prev";renderFc()};
$("fcNext").onclick=function(){if(!V.list.length)return;V.i=(V.i+1)%V.list.length;V.flip=false;V.slide="next";renderFc()};
$("fcStar").onclick=function(){var w=V.list[V.i];if(!w)return;S.starred=S.starred||{};var k="v::"+vocabKey(w);if(S.starred[k])delete S.starred[k];else S.starred[k]=1;save();renderFc();renderVGrid()};
$("fcKnow").onclick=function(){var w=V.list[V.i];if(!w)return;var k=vocabKey(w);if(S.vocabKnown[k])delete S.vocabKnown[k];else S.vocabKnown[k]=1;save();renderFc();renderVGrid()};
$("vShuffle").onclick=function(){V.list=shuffle(V.list);V.i=0;V.flip=false;renderFc();renderVGrid();toast("Đã trộn "+V.list.length+" thẻ")};
$("vStarOnly").onclick=function(){V.starOnly=!V.starOnly;var b=$("vStarOnly");b.textContent=V.starOnly?"\u2605 Đang lọc":"Sổ tay \u2605";b.setAttribute("aria-pressed",V.starOnly?"true":"false");renderVGrid()};
$("vHideAll").onclick=function(){V.hideAll=!V.hideAll;V.flip=false;var b=$("vHideAll");b.textContent=V.hideAll?"Hiện hết nghĩa":"Ẩn hết nghĩa";b.setAttribute("aria-pressed",V.hideAll?"true":"false");renderFc();renderVGrid()};
["vQ","vUnit","vKind","vMode"].forEach(function(id){$(id).addEventListener("input",function(){V.hideAll=false;V.starOnly=false;var _sb=$("vStarOnly");if(_sb){_sb.textContent="Sổ tay \u2605";_sb.setAttribute("aria-pressed","false")}$("vHideAll").textContent="Ẩn hết nghĩa";renderVocab()})});
document.addEventListener("keydown",function(e){
 if($("view-vocab").hidden||!V.list.length)return;
 if(e.target.matches("input,select,textarea"))return;
 if(e.key==="ArrowRight")$("fcNext").click();
 else if(e.key==="ArrowLeft")$("fcPrev").click();
 else if(e.key===" "&&document.activeElement!==$("fcMain")){e.preventDefault();V.flip=!V.flip;renderFc()}
});

/* ---------- DIEM YEU (B): tai dung S.answered + filter san co cua pool() */
var WEAK=[];
function weakStats(){
 var dims=[];
 function agg(label,filter,action){
  var tot=0,ok=0,i,q,st;
  for(i=0;i<Q.length;i++){q=Q[i];if(!filter(q))continue;st=S.answered[q.id];if(!st||st==="skip")continue;tot++;if(st==="ok")ok++}
  if(tot>=3)dims.push({label:label,ok:ok,tot:tot,acc:Math.round(ok/tot*100),action:action});
 }
 var ts=Object.keys(TYPES),t;
 for(t=0;t<ts.length;t++)(function(ty){agg(TYPES[ty]+" · Anh",function(q){return q.subject==="english"&&typeOf(q)===ty},{subject:"english",qtype:ty})})(ts[t]);
 [5.5,6.0,6.5,7.0,7.5,8.0,8.5].forEach(function(b){agg("Band "+b.toFixed(1)+" · Anh",function(q){return q.subject==="english"&&q.band===b},{subject:"english",band:b})});
 var sk=Object.keys(META),ti,li;
 for(ti=0;ti<sk.length;ti++){var ls=lessonsOf(sk[ti]);for(li=0;li<ls.length;li++)(function(k,l){var lbl=(META[k].lessons[l]||(META[k].units+" "+l)).split(":")[0];agg(lbl+" · "+META[k].short,function(q){return q.subject===k&&q.lesson===l},{subject:k,lesson:String(l)})})(sk[ti],ls[li])}
 var tp={};
 Q.forEach(function(q){(tp[q.topic]=tp[q.topic]||[]).push(q)});
 Object.keys(tp).forEach(function(topic){var q0=tp[topic][0];agg(topic+" · "+subjTag(q0),function(q){return q.topic===topic},{subject:q0.subject,topic:topic})});
 Object.keys(META).forEach(function(k){["Nhận biết","Thông hiểu","Vận dụng","Vận dụng cao"].forEach(function(d){agg(d+" · "+META[k].short,function(q){return q.subject===k&&q.difficulty===d},{subject:k,lesson:"all",level:d})})});
  dims.sort(function(a,b){return a.acc-b.acc});
 return dims.slice(0,3);
}
function renderWeak(){
 var box=$("weakBox");if(!box)return;
 WEAK=weakStats();
 if(!WEAK.length){box.innerHTML='<p class="muted">Chưa đủ dữ liệu — làm thêm bài để có phân tích (mỗi nhóm cần tối thiểu 3 câu đã làm).</p>';return}
 box.innerHTML=WEAK.map(function(w,i){
  return '<div class="prog-row"><div class="lbl"><span>'+(i===0?'<span class="tag bad">Yếu nhất</span> ':'')+esc(w.label)+'</span><span>'+w.ok+'/'+w.tot+' đúng · '+w.acc+'%</span></div><div class="pbar"><i style="width:'+w.acc+'%"></i></div><div class="row" style="margin-top:8px"><button class="btn btn-sm btn-primary" data-weak="'+i+'">Luyện 10 câu phần này</button></div></div>'}).join("");
}
document.addEventListener("click",function(e){
 var b=e.target.closest("[data-weak]");if(!b)return;
 var w=WEAK[+b.dataset.weak];if(!w)return;
 var cfg={subject:w.action.subject,lesson:"all",count:10,time:10,practice:true,level:"all",qtype:"all",shQ:true,shA:true};
 if(w.action.lesson!==undefined)cfg.lesson=w.action.lesson;
 if(w.action.topic)cfg.topic=w.action.topic;
 if(w.action.band!==undefined)cfg.band=w.action.band;
  if(w.action.level)cfg.level=w.action.level;
 if(w.action.qtype)cfg.qtype=w.action.qtype;

 startExam(cfg);
});
document.addEventListener("click",function(e){var st=e.target.closest("[data-star]");if(!st)return;S.starred=S.starred||{};var id=st.dataset.star;if(S.starred[id])delete S.starred[id];else S.starred[id]=1;save();st.textContent=S.starred[id]?"★ Sổ tay":"☆ Sổ tay"});

/* ---------- PROGRESS ---------- */
function renderTrend(){var tb=$("trendBox");if(!tb)return;var wk=S.hist.filter(function(h){return h.when>=Date.now()-7*864e5}).length;var goal=S.goal||3;var last=S.hist.slice(0,14).reverse();tb.innerHTML='<div class="prog-row"><div class="lbl"><span>Mục tiêu tuần</span><span> '+wk+'/'+goal+' đề</span></div><div class="pbar"><i style="width:'+Math.min(100,Math.round(wk/goal*100))+'%"></i></div><div class="row"><button class="btn btn-sm" data-goal="-1" aria-label="Giảm mục tiêu">−</button><button class="btn btn-sm" data-goal="1" aria-label="Tăng mục tiêu">+</button></div></div>'+ (last.length?'<div style="margin-top:14px">' +last.map(function(h){var d=new Date(h.when);return '<div class="trow"><span>'+d.toLocaleDateString("vi-VN")+'</span><span class="pbar"><i style="width:'+(h.point*10)+'%"></i></span><b>'+h.point.toFixed(1)+'</b></div>'}).join("")+'</div>':'<p class="muted">Làm bài để thấy biểu đồ điểm ở đây.</p>');}document.addEventListener("click",function(e){var g=e.target.closest("[data-goal]");if(!g)return;S.goal=Math.min(14,Math.max(1,(S.goal||3)+(+g.dataset.goal)));save();renderTrend()});
function renderProgress(){
 renderTrend();
  $("progCards").innerHTML=Object.keys(META).map(function(k){var m=META[k];
  var rows=lessonsOf(k).map(function(l){var p=(S.prog[k]||{})[l]||0;var n=Q.filter(function(q){return q.subject===k&&q.lesson===l}).length;
   var good=Q.filter(function(q){return q.subject===k&&q.lesson===l&&S.answered[q.id]==="ok"}).length;
   var lbl=m.lessons[l]||(m.units+" "+l);
   return '<div class="prog-row"><div class="lbl"><span>'+esc(lbl)+'</span><span>'+good+'/'+n+' đúng · '+p+'%</span></div><div class="pbar"><i style="width:'+p+'%"></i></div></div>'}).join("");
  return '<div class="panel"><h3>'+m.name+' <small class="muted">· '+m.book+'</small></h3>'+rows+'</div>'}).join("");
 var tot=S.hist.length,best=S.hist.reduce(function(m,h){return Math.max(m,h.point)},0);
 $("histList").innerHTML=tot?'<div class="hist">'+S.hist.map(function(h){var d=new Date(h.when);
  return '<div class="hist-item"><span><b>'+h.point.toFixed(1)+'/10</b> · '+META[h.sub].name+' '+(h.lesson==="all"?"Tổng hợp":META[h.sub].units+" "+h.lesson)+' · '+h.ok+'/'+h.tot+'</span><span class="muted">'+d.toLocaleDateString("vi-VN")+' '+d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+'</span></div>'}).join("")+'</div><p class="muted">Tổng '+tot+' đề · điểm cao nhất '+best.toFixed(1)+' · '+S.correct+' câu đúng tích lũy</p>'
 :'<p class="muted">Chưa có đề nào. Hãy bắt đầu một bài kiểm tra — kết quả sẽ hiện ở đây.</p>';
 go("progress");
}
$("wipeBtn").onclick=function(){if(confirm("Xoá toàn bộ điểm, tiến độ và lịch sử?")){S=Object.assign(S,{best:0,exams:0,correct:0,answered:{},marked:[],hist:[],prog:{},starred:{}});save();try{localStorage.removeItem(LS_EXAM)}catch(e){}renderProgress();renderHome();toast("Đã xoá dữ liệu")}};

/* resume bài dở */
(function(){try{var raw=localStorage.getItem(LS_EXAM);if(!raw)return;var d=JSON.parse(raw);
 if(!d||!d.qs||!d.qs.length||!d.cfg||!META[d.cfg.subject])return;
 if(Date.now()-d.t0>d.limit*1000)return;
 var left=Math.ceil((d.limit*1000-(Date.now()-d.t0))/1000);
 if(confirm("Có bài "+META[d.cfg.subject].name+" làm dở ("+d.ans.filter(function(a){return a>=0}).length+"/"+d.qs.length+" câu, còn "+Math.floor(left/60)+":"+String(left%60).padStart(2,"0")+"). Tiếp tục làm?")){E=d;curSub=d.cfg.subject;renderQ();go("quiz");startTimer()}
 else localStorage.removeItem(LS_EXAM)}catch(e){}})();

/* init */
renderHome();
})();
