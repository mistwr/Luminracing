/* ============================================================
   LUMIN AI GAMES — DRAG RACER
   Motor completo: 3D (Three.js), física arcade, carreira,
   multiplayer online (Supabase Realtime) e perfis.
   ============================================================ */

/* ---------------- SUPABASE ---------------- */
const SUPABASE_URL = "https://wyurrrtiaggvilanbxjs.supabase.co";
const SUPABASE_KEY = "sb_publishable_i5DujYk0E7cX3_nKIY7YLg_aoJnm4Rg";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------------- ESTADO GLOBAL ---------------- */
const STORAGE_KEY = "lumin_drag_racer_session_v1";

const CARS = [
  { id:"starter", name:"LUMIN Civic GT", color:0xff5c5c, price:0,    accel:1.00, top:1.00, label:"Inicial" },
  { id:"gtr",     name:"Nightfall GT-R", color:0x5c9bff, price:1200, accel:1.14, top:1.08, label:"Equilibrado" },
  { id:"mustang", name:"Apex Mustang",   color:0xffd95c, price:2600, accel:1.30, top:1.14, label:"Agressivo" },
  { id:"lumin",   name:"LUMIN Prototype",color:0xa0ffb8, price:5200, accel:1.48, top:1.24, label:"Lendário" },
];

const CHAPTERS = [
  { id:1, title:"Primeira Luz", rival:"Tó \"Pé Leve\"", rivalCar:{accel:0.85,top:0.85}, reward:250,
    story:"Bem-vindo à pista LUMIN. O Tó corre aqui há anos só pelo gosto da coisa. Mostra-lhe do que és feito." },
  { id:2, title:"Ruas de Porto Velho", rival:"Marta \"Faísca\"", rivalCar:{accel:0.95,top:0.95}, reward:300,
    story:"A Marta construiu o carro dela peça a peça. Reação rápida, sem perdão para arranques tardios." },
  { id:3, title:"Desafio da Sucata", rival:"Igor", rivalCar:{accel:1.02,top:1.0}, reward:350,
    story:"O Igor diz que carro bonito não ganha corrida. Vamos ver se tem razão." },
  { id:4, title:"Noite Neon", rival:"DJ Throttle", rivalCar:{accel:1.08,top:1.05}, reward:420,
    story:"As corridas de noite atraem gente a sério. O DJ Throttle nunca perdeu numa sexta-feira." },
  { id:5, title:"Reta Final do Bairro", rival:"Capitão Reis", rivalCar:{accel:1.12,top:1.1}, reward:480,
    story:"Ex-piloto profissional, hoje reformado... mas ainda corre como se fosse campeonato." },
  { id:6, title:"O Clube Secreto", rival:"Yuki", rivalCar:{accel:1.2,top:1.15}, reward:560,
    story:"Poucos sabem onde o clube corre. A Yuki convidou-te pessoalmente. Não dececiones." },
  { id:7, title:"Rainha do Asfalto", rival:"Bia \"Relâmpago\"", rivalCar:{accel:1.28,top:1.2}, reward:650,
    story:"A Bia nunca perdeu uma final. Hoje é a tua oportunidade de mudar isso." },
  { id:8, title:"Lenda LUMIN", rival:"O Fantasma", rivalCar:{accel:1.4,top:1.3}, reward:1000,
    story:"Ninguém sabe quem é O Fantasma. Só se sabe que, até hoje, nunca foi vencido." },
];

const TRACK_LENGTH = 402; // metros (quarto de milha)

let state = {
  profile: null,          // {id, username, pin, best_time, coins, unlocked_cars, selected_car, career_chapter, career_stars, ...}
  mode: null,             // 'career' | 'quick' | 'multi'
  chapterIndex: null,
  room: null,             // {id, code, isHost}
  channel: null,
};

/* ---------------- PERSISTÊNCIA LOCAL (sessão) ---------------- */
function saveLocalSession(profile){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ id:profile.id, username:profile.username, pin:profile.pin })); }catch(e){}
}
function loadLocalSession(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }catch(e){ return null; }
}

/* ============================================================
   UI HELPERS
   ============================================================ */
const $ = (id) => document.getElementById(id);
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}
document.querySelectorAll("[data-back]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    leaveRoomIfAny();
    showScreen(btn.getAttribute("data-back"));
    refreshMenu();
  });
});

function refreshMenu(){
  if(state.profile){
    $("menuProfileBox").classList.remove("hidden");
    $("menuUsername").textContent = state.profile.username;
    $("menuBestTime").textContent = state.profile.best_time ? Number(state.profile.best_time).toFixed(2)+"s" : "—";
    $("menuCoins").textContent = state.profile.coins ?? 0;
  } else {
    $("menuProfileBox").classList.add("hidden");
  }
}

/* ============================================================
   PERFIL (criar / entrar) via Supabase RPC
   ============================================================ */
$("btnProfile").addEventListener("click", ()=> showScreen("screenProfile"));

$("btnCreateProfile").addEventListener("click", async ()=>{
  const username = $("inUsername").value.trim();
  const pin = $("inPin").value.trim();
  const msg = $("profileMsg");
  msg.textContent = "";
  if(username.length < 2){ msg.textContent = "Nome muito curto."; return; }
  if(!/^\d{4}$/.test(pin)){ msg.textContent = "PIN tem de ter 4 dígitos."; return; }
  msg.textContent = "A criar perfil...";
  const { data, error } = await sb.from("game_profiles").insert({ username, pin }).select().single();
  if(error){
    msg.textContent = error.code === "23505" ? "Esse nome já existe. Tenta ENTRAR." : "Erro: " + error.message;
    return;
  }
  state.profile = data;
  saveLocalSession(data);
  msg.textContent = "Perfil criado!";
  refreshMenu();
  setTimeout(()=> showScreen("screenMenu"), 500);
});

$("btnLoginProfile").addEventListener("click", async ()=>{
  const username = $("inUsername").value.trim();
  const pin = $("inPin").value.trim();
  const msg = $("profileMsg");
  msg.textContent = "A entrar...";
  const { data, error } = await sb.rpc("login_game_profile", { p_username: username, p_pin: pin });
  if(error || !data || data.length === 0){
    msg.textContent = "Nome ou PIN incorretos.";
    return;
  }
  state.profile = data[0];
  saveLocalSession(state.profile);
  msg.textContent = "Bem-vindo de volta!";
  refreshMenu();
  setTimeout(()=> showScreen("screenMenu"), 400);
});

async function trySilentLogin(){
  const saved = loadLocalSession();
  if(!saved) return;
  const { data } = await sb.rpc("login_game_profile", { p_username: saved.username, p_pin: saved.pin });
  if(data && data.length){ state.profile = data[0]; refreshMenu(); }
}

async function persistProfile(){
  if(!state.profile) return;
  const p = state.profile;
  await sb.rpc("update_game_profile", {
    p_id: p.id, p_pin: p.pin,
    p_best_time: p.best_time, p_best_trap_speed: p.best_trap_speed,
    p_total_races: p.total_races, p_wins: p.wins, p_coins: p.coins,
    p_career_chapter: p.career_chapter, p_career_stars: p.career_stars,
    p_unlocked_cars: p.unlocked_cars, p_selected_car: p.selected_car
  });
}

function requireProfile(thenFn){
  if(!state.profile){ showScreen("screenProfile"); $("profileMsg").textContent="Cria ou entra num perfil primeiro."; return; }
  thenFn();
}

/* ============================================================
   GARAGEM
   ============================================================ */
$("btnGarage").addEventListener("click", ()=> requireProfile(()=>{ renderGarage(); showScreen("screenGarage"); }));

function renderGarage(){
  $("garageCoins").textContent = state.profile.coins ?? 0;
  const grid = $("carGrid"); grid.innerHTML = "";
  const unlocked = state.profile.unlocked_cars || ["starter"];
  CARS.forEach(car=>{
    const isUnlocked = unlocked.includes(car.id);
    const isSelected = state.profile.selected_car === car.id;
    const card = document.createElement("div");
    card.className = "carCard" + (isSelected?" selected":"") + (!isUnlocked?" locked":"");
    card.innerHTML = `<div class="carSwatch" style="background:#${car.color.toString(16).padStart(6,'0')}"></div>
      <div class="carName">${car.name}</div>
      <div class="carStats">${car.label}${isUnlocked ? "" : " · 💰"+car.price}</div>`;
    card.addEventListener("click", async ()=>{
      if(isUnlocked){
        state.profile.selected_car = car.id;
        await persistProfile();
        renderGarage();
        $("carDetail").textContent = car.name + " selecionado.";
      } else if((state.profile.coins||0) >= car.price){
        state.profile.coins -= car.price;
        state.profile.unlocked_cars = [...unlocked, car.id];
        state.profile.selected_car = car.id;
        await persistProfile();
        renderGarage();
        $("carDetail").textContent = "Comprado e equipado: " + car.name + "!";
      } else {
        $("carDetail").textContent = "Moedas insuficientes (precisas " + car.price + ").";
      }
    });
    grid.appendChild(card);
  });
}

function getSelectedCar(){
  const id = state.profile?.selected_car || "starter";
  return CARS.find(c=>c.id===id) || CARS[0];
}

/* ============================================================
   LEADERBOARD
   ============================================================ */
$("btnLeaderboard").addEventListener("click", async ()=>{
  showScreen("screenLeaderboard");
  const tbody = $("lbTable").querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='3'>A carregar...</td></tr>";
  const { data, error } = await sb.from("game_profiles")
    .select("username,best_time,best_trap_speed")
    .not("best_time","is",null)
    .order("best_time", { ascending:true }).limit(20);
  if(error || !data || !data.length){ tbody.innerHTML = "<tr><td colspan='3'>Sem resultados ainda.</td></tr>"; return; }
  tbody.innerHTML = data.map((r,i)=>`<tr><td class="rank">#${i+1}</td><td>${r.username}</td><td class="time">${Number(r.best_time).toFixed(2)}s</td></tr>`).join("");
});

/* ============================================================
   CARREIRA
   ============================================================ */
$("btnCareer").addEventListener("click", ()=> requireProfile(()=>{ renderCareer(); showScreen("screenCareer"); }));

function renderCareer(){
  const list = $("chapterList"); list.innerHTML = "";
  const unlockedChapter = state.profile.career_chapter || 1;
  const stars = state.profile.career_stars || {};
  CHAPTERS.forEach(ch=>{
    const isLocked = ch.id > unlockedChapter;
    const card = document.createElement("div");
    card.className = "chapterCard" + (isLocked?" locked":"");
    const st = stars[ch.id] || 0;
    card.innerHTML = `<div><div class="chapterTitle">${ch.id}. ${ch.title}</div><div class="chapterSub">vs ${ch.rival}</div></div>
      <div class="stars">${"★".repeat(st)}${"☆".repeat(3-st)}</div>`;
    if(!isLocked){
      card.addEventListener("click", ()=> openChapterStory(ch.id));
    }
    list.appendChild(card);
  });
}

function openChapterStory(chapterId){
  const ch = CHAPTERS.find(c=>c.id===chapterId);
  state.chapterIndex = chapterId;
  $("storyChapterNum").textContent = ch.id;
  $("storyTitle").textContent = ch.title;
  $("storyRival").textContent = "Rival: " + ch.rival;
  $("storyText").textContent = ch.story;
  showScreen("screenStory");
}

$("btnStoryStart").addEventListener("click", ()=>{
  const ch = CHAPTERS.find(c=>c.id===state.chapterIndex);
  state.mode = "career";
  startRace({ opponent: ch.rivalCar, chapter: ch });
});

/* ============================================================
   CORRIDA RÁPIDA
   ============================================================ */
$("btnQuick").addEventListener("click", ()=> requireProfile(()=>{
  state.mode = "quick";
  startRace({ opponent: { accel: 0.9 + Math.random()*0.5, top: 0.9 + Math.random()*0.4 }, chapter:null });
}));

/* ============================================================
   MULTIPLAYER (Supabase Realtime)
   ============================================================ */
$("btnMulti").addEventListener("click", ()=> requireProfile(()=>{ $("multiMsg").textContent=""; showScreen("screenMulti"); }));

function genRoomCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

$("btnCreateRoom").addEventListener("click", async ()=>{
  const code = genRoomCode();
  const { data, error } = await sb.from("game_rooms").insert({ code, host_id: state.profile.id, status:"waiting" }).select().single();
  if(error){ $("multiMsg").textContent = "Erro ao criar sala."; return; }
  state.room = { id:data.id, code, isHost:true };
  $("waitRoomCode").textContent = code;
  $("waitStatus").textContent = "À espera de adversário...";
  showScreen("screenWaitRoom");
  subscribeRoom(code, true);
});

$("btnJoinRoom").addEventListener("click", async ()=>{
  const code = $("inRoomCode").value.trim().toUpperCase();
  if(code.length !== 6){ $("multiMsg").textContent = "Código inválido."; return; }
  const { data, error } = await sb.from("game_rooms").select().eq("code", code).eq("status","waiting").single();
  if(error || !data){ $("multiMsg").textContent = "Sala não encontrada."; return; }
  await sb.from("game_rooms").update({ guest_id: state.profile.id, status:"racing" }).eq("id", data.id);
  state.room = { id:data.id, code, isHost:false };
  showScreen("screenWaitRoom");
  $("waitRoomCode").textContent = code;
  $("waitStatus").textContent = "A entrar na corrida...";
  subscribeRoom(code, false);
});

function subscribeRoom(code, isHost){
  const channel = sb.channel("race:" + code, { config:{ broadcast:{ self:false } } });
  state.channel = channel;
  channel.on("broadcast", { event:"opp_pos" }, (msg)=>{
    onOpponentUpdate(msg.payload);
  });
  channel.on("broadcast", { event:"start" }, (msg)=>{
    if(!isHost) beginCountdown(msg.payload.startAt);
  });
  channel.on("broadcast", { event:"guest_ready" }, ()=>{
    if(isHost){
      $("waitStatus").textContent = "Adversário pronto! A iniciar...";
      const startAt = Date.now() + 3000;
      channel.send({ type:"broadcast", event:"start", payload:{ startAt } });
      state.mode = "multi";
      startRace({ opponent: null, chapter:null, multiplayer:true });
      beginCountdown(startAt);
    }
  });
  channel.subscribe((status)=>{
    if(status === "SUBSCRIBED" && !isHost){
      channel.send({ type:"broadcast", event:"guest_ready", payload:{} });
      state.mode = "multi";
      $("waitStatus").textContent = "À espera do anfitrião...";
    }
  });
}

function leaveRoomIfAny(){
  if(state.channel){ sb.removeChannel(state.channel); state.channel = null; }
  state.room = null;
}

/* ============================================================
   THREE.JS — CENA 3D
   ============================================================ */
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
function resizeRenderer(){ renderer.setSize(window.innerWidth, window.innerHeight); }
resizeRenderer();
window.addEventListener("resize", ()=>{ resizeRenderer(); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070b);
scene.fog = new THREE.Fog(0x07070b, 40, 220);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 1000);

// Luzes
scene.add(new THREE.AmbientLight(0x55556a, 1.1));
const sun = new THREE.DirectionalLight(0xfff2cc, 0.9);
sun.position.set(-30, 60, -20);
scene.add(sun);

// Pista
const roadWidth = 14;
const roadGeo = new THREE.PlaneGeometry(roadWidth, 1600, 1, 1);
const roadMat = new THREE.MeshStandardMaterial({ color:0x16161e, roughness:0.95 });
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI/2;
road.position.z = -700;
scene.add(road);

// Linha central tracejada
const dashGroup = new THREE.Group();
for(let i=0;i<160;i++){
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 4), new THREE.MeshBasicMaterial({ color:0xa0ffb8 }));
  dash.rotation.x = -Math.PI/2;
  dash.position.set(0, 0.01, -i*10);
  dashGroup.add(dash);
}
scene.add(dashGroup);

// Chão lateral (deserto/grama estilizada)
const groundGeo = new THREE.PlaneGeometry(400, 1600);
const groundMat = new THREE.MeshStandardMaterial({ color:0x0c0c12, roughness:1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; ground.position.z = -700;
scene.add(ground);

// Postes/cones laterais para sensação de velocidade
const coneGeo = new THREE.ConeGeometry(0.4, 1.2, 6);
const coneMat = new THREE.MeshStandardMaterial({ color:0xffd95c, emissive:0x332200 });
const cones = [];
for(let i=0;i<80;i++){
  for(const side of [-1,1]){
    const c = new THREE.Mesh(coneGeo, coneMat);
    c.position.set(side*(roadWidth/2+1.2), 0.6, -i*20);
    scene.add(c); cones.push(c);
  }
}

// Linha de meta a 402m
const finishGeo = new THREE.PlaneGeometry(roadWidth, 2);
const finishMat = new THREE.MeshBasicMaterial({ color:0xffffff });
const finishLine = new THREE.Mesh(finishGeo, finishMat);
finishLine.rotation.x = -Math.PI/2;
finishLine.position.set(0, 0.02, -TRACK_LENGTH);
scene.add(finishLine);

function makeCarMesh(colorHex){
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.5, 4.2),
    new THREE.MeshStandardMaterial({ color: colorHex, metalness:0.4, roughness:0.4 })
  );
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.45, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x111118, metalness:0.2, roughness:0.6 })
  );
  cabin.position.set(0, 0.95, -0.1);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color:0x111111 });
  const wheelPositions = [[-0.95,0.32,1.4],[0.95,0.32,1.4],[-0.95,0.32,-1.4],[0.95,0.32,-1.4]];
  const wheels = wheelPositions.map(p=>{
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI/2;
    w.position.set(p[0],p[1],p[2]);
    group.add(w);
    return w;
  });
  group.userData.wheels = wheels;
  const tail = new THREE.PointLight(0xff3333, 0, 4);
  tail.position.set(0,0.5,2.2);
  group.add(tail);
  group.userData.brakeLight = tail;
  return group;
}

const playerCar = makeCarMesh(0xff5c5c);
playerCar.position.set(-1.6, 0, 0);
scene.add(playerCar);

const oppCar = makeCarMesh(0x5c9bff);
oppCar.position.set(1.6, 0, 0);
oppCar.visible = false;
scene.add(oppCar);

/* ---------------- ÁUDIO (sintetizado, sem ficheiros externos) ---------------- */
let audioCtx = null, engineOsc = null, engineGain = null;
function ensureAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  engineOsc = audioCtx.createOscillator();
  engineOsc.type = "sawtooth";
  engineGain = audioCtx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineGain).connect(audioCtx.destination);
  engineOsc.frequency.value = 60;
  engineOsc.start();
}
function setEngineSound(rpmRatio, active){
  if(!audioCtx) return;
  engineGain.gain.setTargetAtTime(active ? 0.05 : 0, audioCtx.currentTime, 0.05);
  engineOsc.frequency.setTargetAtTime(50 + rpmRatio*260, audioCtx.currentTime, 0.03);
}
function beep(freq=880, dur=0.12){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type="square"; o.frequency.value=freq; g.gain.value=0.06;
  o.connect(g).connect(audioCtx.destination); o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
  o.stop(audioCtx.currentTime+dur+0.02);
}

/* ============================================================
   FÍSICA DE CORRIDA (arcade)
   ============================================================ */
const GEAR_BANDS = [0, 40, 80, 120, 160, 200, 999]; // km/h limites por mudança (6 velocidades)
function gearForSpeed(kmh){
  for(let g=1; g<GEAR_BANDS.length-1; g++){
    if(kmh < GEAR_BANDS[g]) return g;
  }
  return GEAR_BANDS.length-1;
}
const GEAR_ACCEL_FACTOR = [0, 1.5, 1.25, 1.05, 0.9, 0.78, 0.68];

function makeRaceCar(stats){
  return {
    stats,
    distance: 0,
    speed: 0,        // m/s
    gear: 1,
    rpmRatio: 0,
    nitro: 1.0,       // 0..1 reservatório
    nitroActive: false,
    finished: false,
    finishTime: null,
    trapSpeed: 0,
    overRevPenaltyT: 0,
    lastShiftBoostT: 0,
  };
}

function stepCar(car, throttle, dt, nitroHeld){
  if(car.finished){ return; }
  const kmh = car.speed*3.6;
  const properGear = gearForSpeed(kmh);
  // RPM sobe dentro da banda da mudança atual
  const bandLow = GEAR_BANDS[car.gear-1] ?? 0, bandHigh = GEAR_BANDS[car.gear] ?? 999;
  car.rpmRatio = THREE.MathUtils.clamp((kmh - bandLow) / Math.max(1,(bandHigh-bandLow)), 0, 1);

  // mudança automática de segurança se ultrapassar muito a banda (evita travar fisicamente)
  if(properGear > car.gear) {
    car.overRevPenaltyT = 0.35; // pequena penalização por não ter mudado a tempo
    car.gear = properGear;
  }

  let accelFactor = GEAR_ACCEL_FACTOR[car.gear] || 0.6;
  if(car.overRevPenaltyT > 0){ accelFactor *= 0.55; car.overRevPenaltyT -= dt; }
  if(car.lastShiftBoostT > 0){ accelFactor *= 1.18; car.lastShiftBoostT -= dt; }

  let nitroBoost = 1.0;
  car.nitroActive = false;
  if(nitroHeld && car.nitro > 0.02){
    nitroBoost = 1.55;
    car.nitro = Math.max(0, car.nitro - dt*0.35);
    car.nitroActive = true;
  } else if(!nitroHeld && car.nitro < 1){
    car.nitro = Math.min(1, car.nitro + dt*0.06);
  }

  const baseAccel = 9.0 * car.stats.accel; // m/s^2 baseline
  const drag = (0.0028 / car.stats.top) * car.speed * car.speed; // resistência do ar (carros mais rápidos cortam melhor o ar)
  let a = (baseAccel * accelFactor * nitroBoost * throttle) - drag;
  if(throttle <= 0.01) a = -3.2; // travagem/atrito ao soltar o gás

  const topSpeedMps = 78 * car.stats.top;
  car.speed = THREE.MathUtils.clamp(car.speed + a*dt, 0, topSpeedMps);
  car.distance += car.speed*dt;

  if(car.distance >= TRACK_LENGTH && !car.finished){
    car.finished = true;
    car.finishTime = raceClock;
    car.trapSpeed = car.speed*3.6;
  }
}

function manualShift(car){
  // mudança manual: se feita com o RPM alto (perto da zona vermelha), dá um pequeno boost de aceleração
  if(car.rpmRatio > 0.78){
    car.lastShiftBoostT = 0.9;
    beep(1200, 0.07);
  } else {
    beep(500, 0.05);
  }
  car.gear = Math.min(6, car.gear + 1);
}

/* ============================================================
   CORRIDA — ORQUESTRAÇÃO
   ============================================================ */
let raceClock = 0;
let raceState = "idle"; // idle | countdown | running | finished
let player, opponent;
let countdownLights = 0;
let greenTime = null;
let playerReaction = null;
let foul = false;
let throttleHeld = false;
let nitroHeld = false;
let lastBroadcast = 0;
let currentChapter = null;
let isMultiplayer = false;
let cpuReactionDelay = 0.05;
let opponentGhost = { distance:0, speed:0, finished:false, finishTime:null };

function startRace({ opponent: oppStats, chapter, multiplayer }){
  currentChapter = chapter || null;
  isMultiplayer = !!multiplayer;
  ensureAudio();
  const carDef = getSelectedCar();
  player = makeRaceCar({ accel: carDef.accel, top: carDef.top });
  opponent = isMultiplayer ? null : makeRaceCar(oppStats);
  opponentGhost = { distance:0, speed:0, finished:false, finishTime:null };
  cpuReactionDelay = 0.12 + Math.random()*0.25;
  raceClock = 0; foul = false; playerReaction = null;
  oppCar.visible = !isMultiplayer || true;
  $("opRow").style.display = "flex";
  showScreen("screenMenu"); // garante que ecrãs de UI saem do caminho
  $("hud").classList.add("show");
  document.querySelectorAll(".screen").forEach(s=>s.classList.add("hidden"));
  resetCarsVisual();

  if(isMultiplayer){
    // o início é coordenado por subscribeRoom (host envia 'start')
    if(state.room && state.room.isHost){
      // handled in subscribeRoom guest_ready handler
    }
  } else {
    beginCountdown(Date.now() + 600);
  }
}

function resetCarsVisual(){
  playerCar.position.set(-1.6, 0, 0);
  oppCar.position.set(1.6, 0, 0);
  camera.position.set(-1.6, 2.4, 7);
  camera.lookAt(-1.6, 1, -10);
  const carDef = getSelectedCar();
  playerCar.children[0].material.color.setHex(carDef.color);
}

function beginCountdown(startAt){
  raceState = "countdown";
  countdownLights = 0;
  document.querySelectorAll(".treeLamp").forEach(l=>l.classList.remove("on"));
  $("centerMsg").textContent = "";
  $("centerMsg").className = "";
  const delay = Math.max(0, startAt - Date.now());
  // sequência: 3 lâmpadas amarelas a cada 500ms, depois vermelho breve, depois verde no startAt
  const lamps = document.querySelectorAll(".treeLamp");
  const baseDelay = delay - 1500; // começa cedo o suficiente para 3 luzes de 500ms
  const t0 = Math.max(0, baseDelay);
  [0,1,2].forEach(i=>{
    setTimeout(()=>{ lamps[i].classList.add("on"); beep(700,0.08); }, t0 + i*500);
  });
  setTimeout(()=>{
    lamps[3].classList.add("on");
  }, t0 + 1450);
  setTimeout(()=>{
    lamps.forEach(l=>l.classList.remove("on"));
    lamps[4].classList.add("on");
    greenTime = performance.now();
    raceState = "running";
    $("centerMsg").textContent = "GO!";
    $("centerMsg").className = "accent";
    beep(1500,0.18);
    setTimeout(()=>{ if($("centerMsg").textContent==="GO!") $("centerMsg").textContent=""; }, 700);
  }, Math.max(t0+1500, delay));
}

$("gasBtn").addEventListener("pointerdown", (e)=>{ e.preventDefault(); onGasDown(); });
$("gasBtn").addEventListener("pointerup", (e)=>{ e.preventDefault(); onGasUp(); });
$("gasBtn").addEventListener("pointerleave", ()=> onGasUp());
$("shiftBtn").addEventListener("pointerdown", (e)=>{ e.preventDefault(); if(player) manualShift(player); });
$("nitroBtn").addEventListener("pointerdown", (e)=>{ e.preventDefault(); nitroHeld = true; });
$("nitroBtn").addEventListener("pointerup", (e)=>{ e.preventDefault(); nitroHeld = false; });
$("nitroBtn").addEventListener("pointerleave", ()=> nitroHeld = false);

window.addEventListener("keydown", (e)=>{
  if(e.code === "Space" || e.code === "ArrowUp"){ onGasDown(); }
  if(e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyW"){ if(player) manualShift(player); }
  if(e.code === "KeyN"){ nitroHeld = true; }
});
window.addEventListener("keyup", (e)=>{
  if(e.code === "Space" || e.code === "ArrowUp"){ onGasUp(); }
  if(e.code === "KeyN"){ nitroHeld = false; }
});

function onGasDown(){
  ensureAudio();
  throttleHeld = true;
  if(raceState === "countdown"){
    // arranque antecipado = falsa partida
    foul = true;
    raceState = "running";
    greenTime = performance.now() - 10; // negativo => reação negativa
    playerReaction = -0.05;
    $("centerMsg").textContent = "FALSA PARTIDA!";
    $("centerMsg").className = "red";
  }
  if(raceState === "running" && playerReaction === null && greenTime !== null){
    playerReaction = (performance.now() - greenTime)/1000;
  }
}
function onGasUp(){ throttleHeld = false; }

/* ============================================================
   LOOP PRINCIPAL
   ============================================================ */
let lastT = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.05, (now-lastT)/1000);
  lastT = now;

  if(raceState === "running"){
    raceClock += dt;
    stepCar(player, throttleHeld ? 1 : 0, dt, nitroHeld);
    setEngineSound(player.rpmRatio, throttleHeld);

    if(!isMultiplayer && opponent){
      // CPU: reage perto do verde + pequena variação, acelera quase sempre a fundo
      const cpuThrottle = raceClock > cpuReactionDelay ? 1 : 0;
      stepCar(opponent, cpuThrottle, dt, false);
    }

    // posição visual
    const camZ = -player.distance;
    playerCar.position.z = -player.distance + (-1.6 - -1.6); // mantém X
    playerCar.position.x = -1.6;
    playerCar.rotation.y = 0;
    const wheelSpin = player.speed*dt*2.2;
    playerCar.userData.wheels.forEach(w=> w.rotation.x -= wheelSpin);
    playerCar.userData.brakeLight.intensity = throttleHeld ? 0 : 1.4;

    let oppDistanceForDraw = 0, oppSpeedForBar = 0, oppFinished=false;
    if(isMultiplayer){
      oppDistanceForDraw = opponentGhost.distance;
      oppSpeedForBar = opponentGhost.speed;
      oppFinished = opponentGhost.finished;
    } else if(opponent){
      oppDistanceForDraw = opponent.distance;
      oppSpeedForBar = opponent.speed;
      oppFinished = opponent.finished;
      oppCar.userData.wheels.forEach(w=> w.rotation.x -= opponent.speed*dt*2.2);
    }
    oppCar.position.z = -oppDistanceForDraw;
    oppCar.position.x = 1.6;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, -1.6, 0.08);
    camera.position.z = -player.distance + 7;
    camera.position.y = 2.4 + Math.min(1.2, player.speed*0.01);
    camera.lookAt(-1.6, 1, -player.distance - 10);

    // HUD
    $("hudTime").textContent = raceClock.toFixed(2);
    $("hudDist").textContent = Math.min(TRACK_LENGTH, Math.round(player.distance));
    $("hudSpeed").textContent = Math.round(player.speed*3.6);
    $("hudSpeed2").textContent = Math.round(player.speed*3.6);
    $("gearLabel").textContent = player.gear;
    $("rpmFill").style.width = (player.rpmRatio*100)+"%";
    $("nitroBtn").classList.toggle("depleted", player.nitro < 0.05);
    $("barPlayer").style.width = Math.min(100, player.distance/TRACK_LENGTH*100)+"%";
    $("barOpp").style.width = Math.min(100, oppDistanceForDraw/TRACK_LENGTH*100)+"%";

    if(isMultiplayer){
      const tNow = performance.now();
      if(tNow - lastBroadcast > 80 && state.channel){
        lastBroadcast = tNow;
        state.channel.send({ type:"broadcast", event:"opp_pos", payload:{
          distance: player.distance, speed: player.speed, finished: player.finished, time: player.finished ? player.finishTime : null, trap: player.trapSpeed
        }});
      }
    }

    const playerDone = player.finished;
    const oppDone = isMultiplayer ? opponentGhost.finished : (opponent ? opponent.finished : true);
    if(playerDone && oppDone){
      finishRace();
    } else if(playerDone){
      // espera o adversário terminar (ou timeout curto)
      if(raceClock - player.finishTime > 6){ finishRace(); }
    }
  }

  renderer.render(scene, camera);
}
animate();

function onOpponentUpdate(payload){
  opponentGhost.distance = payload.distance;
  opponentGhost.speed = payload.speed;
  if(payload.finished && !opponentGhost.finished){
    opponentGhost.finished = true;
    opponentGhost.finishTime = payload.time;
    opponentGhost.trapSpeed = payload.trap;
  }
}

/* ============================================================
   RESULTADOS
   ============================================================ */
async function finishRace(){
  if(raceState === "finished") return;
  raceState = "finished";
  $("hud").classList.remove("show");
  setEngineSound(0,false);

  const myTime = player.finishTime ?? raceClock;
  const myTrap = player.trapSpeed || player.speed*3.6;
  const oppTime = isMultiplayer ? (opponentGhost.finishTime ?? 999) : (opponent ? (opponent.finishTime ?? 999) : 999);
  const won = !foul && myTime < oppTime;

  $("resTime").textContent = myTime.toFixed(2)+"s";
  $("resTrap").textContent = Math.round(myTrap)+" km/h";
  $("resReaction").textContent = (playerReaction!==null ? playerReaction.toFixed(2) : "—")+"s";

  let coinsEarned = 0, starsEarned = 0;
  if(foul){
    $("resOutcome").textContent = "FALSA PARTIDA";
    $("resOutcome").style.color = "var(--red)";
  } else if(won){
    $("resOutcome").textContent = "VITÓRIA!";
    $("resOutcome").style.color = "var(--accent)";
    coinsEarned = 80 + Math.round(Math.max(0, (oppTime-myTime))*40);
    starsEarned = playerReaction!==null && playerReaction < 0.2 ? 3 : (playerReaction!==null && playerReaction < 0.4 ? 2 : 1);
  } else {
    $("resOutcome").textContent = "DERROTA";
    $("resOutcome").style.color = "var(--muted)";
    coinsEarned = 20;
  }
  $("resCoins").textContent = "+"+coinsEarned;
  $("resStars").textContent = currentChapter ? ("★".repeat(starsEarned)+"☆".repeat(3-starsEarned)) : "";
  $("resultTitle").textContent = currentChapter ? ("CAPÍTULO " + currentChapter.id) : (isMultiplayer ? "MULTIPLAYER" : "CORRIDA RÁPIDA");

  // atualizar perfil
  if(state.profile){
    const p = state.profile;
    p.total_races = (p.total_races||0) + 1;
    if(won) p.wins = (p.wins||0) + 1;
    p.coins = (p.coins||0) + coinsEarned;
    if(!foul && (p.best_time == null || myTime < p.best_time)){
      p.best_time = myTime; p.best_trap_speed = myTrap;
    }
    if(currentChapter && won){
      const stars = p.career_stars || {};
      stars[currentChapter.id] = Math.max(stars[currentChapter.id]||0, starsEarned);
      p.career_stars = stars;
      if(currentChapter.id >= (p.career_chapter||1)){
        p.career_chapter = Math.min(CHAPTERS.length, currentChapter.id + 1);
      }
    }
    await persistProfile();
    refreshMenu();
  }

  if(state.room){
    await sb.from("game_rooms").update({
      [state.room.isHost ? "host_time" : "guest_time"]: foul ? null : myTime
    }).eq("id", state.room.id);
  }

  showScreen("screenResults");
}

$("btnResultContinue").addEventListener("click", ()=>{
  leaveRoomIfAny();
  if(state.mode === "career"){ renderCareer(); showScreen("screenCareer"); }
  else { showScreen("screenMenu"); refreshMenu(); }
});
$("btnResultMenu").addEventListener("click", ()=>{
  leaveRoomIfAny();
  showScreen("screenMenu"); refreshMenu();
});

/* ============================================================
   INÍCIO
   ============================================================ */
(async function init(){
  await trySilentLogin();
  refreshMenu();
  showScreen("screenMenu");
})();
