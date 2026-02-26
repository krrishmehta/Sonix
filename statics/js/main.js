const roomID = localStorage.getItem("room_id");
const pass = localStorage.getItem("roompass");
const slider = document.getElementById("progress-bar");
const audio = document.getElementById("audioplayer");
const audiosrc = document.getElementById("audiosrc");
const song_current_time = document.getElementById("current-time");
const song_duration = document.getElementById("song-end-time");
const playPauseBtn = document.getElementById("play-pause-btn");
const isHost = localStorage.getItem("host");
const backward = document.getElementById("backward-btn");
const forward = document.getElementById("forward-btn");
const artistname = document.getElementById("artist-name");
const musicname = document.getElementById("song-title");
const songList = document.querySelectorAll("#songList li");
const musicover = document.getElementById("music-cover");
const index = null;
const ok_btn = document.getElementById("ok-btn");

let intervalID;
let room_inp = document.getElementById("room-id");
let room_pass_inp = document.getElementById("room-pass");
let participant_cont = document.getElementById("participant");
let indexCount = -1;
let currentActive = null;
let prevuserlen = 0;
let playlist = [];
let currentIndex = null;
let ws = null;

room_inp.readOnly = true;
room_pass_inp.readOnly = true;
audio.hidden = true;

audio.load();

if(roomID){
    room_inp.value = roomID;
    room_pass_inp.value = pass;
}
else{
    room_inp.value = "None";
}

//✅ Safe play wrapper
function safePlay(startTime = 0) {
    audio.currentTime = startTime;
    audio.play();
}

function reConnect(){
  ws = new WebSocket(`wss://${window.location.host}/ws/sync/${roomID}?host=${isHost}`,[pass]);
}
reConnect();

songList.forEach((li, index) => {
  li.addEventListener("click", () => {
    playSong(index);
    ws.send(JSON.stringify({'action':'play', 'time':audio.currentTime, 'index':index}));
  });
});

// ================== Audio Progress ==================
audio.addEventListener("timeupdate",()=>{
    if (!isNaN(audio.duration) && audio.duration > 0) {
        let value = (audio.currentTime / audio.duration) * 100;
        slider.value = value;
        updateBar(value);
    }
    song_current_time.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration)) {
        song_duration.textContent = formatTime(audio.duration);
    }
});

audio.addEventListener("ended",() => {
  let nextIndex = (currentIndex + 1) % songList.length;
  playSong(nextIndex);
});

// ================== Slider Seek ==================
slider.addEventListener("input", () => {
    if (!isNaN(audio.duration)) {
        audio.currentTime = (slider.value / 100) * audio.duration;
        updateBar(slider.value);
        ws.send(JSON.stringify({
            'action': 'driftsync',
            'time': audio.currentTime,
            'index': index
        }));
    }
});

// ================== Play / Pause Button ==================
playPauseBtn.addEventListener("click", () => {
  if (audio.paused) {
    ws.send(JSON.stringify({ action: "play", time: audio.currentTime }));
    audio.play();
  } else {
    ws.send(JSON.stringify({
        'action': 'pause',
        'time': audio.currentTime
    }));
    audio.pause();
  }
  updateButton()
});

// ================== Sync Interval ==================
audio.addEventListener("play",() => {
    intervalID = setInterval(() =>{
      if(isHost){
        ws.send(JSON.stringify({'action':'seek','time':audio.currentTime,'index':index}));
      }
    },5000)
});

audio.addEventListener("pause",() => {
    clearInterval(intervalID);
});

audio.addEventListener("play", updateButton);
audio.addEventListener("pause", updateButton);

// ================== Forward / Backward ==================
backward.addEventListener("click",() => {
  let prevIndex = (currentIndex - 1 + songList.length) % songList.length; // loop back
  ws.send(JSON.stringify({'action':'backward', 'prevIndex':prevIndex}));
  playSong(prevIndex);
});

forward.addEventListener("click",() => {
  let nextIndex = (currentIndex + 1) % songList.length; // loop back
  ws.send(JSON.stringify({'action':'forward','nextIndex':nextIndex}));
  playSong(nextIndex);
});

// ================== WebSocket ==================
ws.onopen = () => {
  console.log("Connected")
  setInterval(() => {
    ws.send(JSON.stringify({"action":"ping"}));
  },3000);
}

ws.onmessage = (event) => {
  let room = JSON.parse(event.data);
  if(room.user_list){
    updateParticipantList(room);
  }
  else if(room.action == 'play'){
    audio.load();
    if(!room.index){
      safePlay(room.time);
    }
    playSong(room.index);
  }
  else if(room.action == 'pause'){
    audio.currentTime = room.time;
    audio.pause();
  }
  else if(room.action == 'seek' || room.action == 'driftsync'){
    let diff = Math.abs(audio.currentTime - room.time);
    if (diff > 2) {
      if(room.index){
        playSong(index);
      }
      audio.currentTime = room.time;
    }
  }
  else if(room.action == 'forward'){
    playSong(room.nextIndex);
  }
  else if(room.action == 'backward'){
    playSong(room.prevIndex);
  }
  else if(room.type == "sync"){
    audio.currentTime = room.time;
    playSong(room.index);
  }
  else if(room.action == "pong"){
    console.log("pong received!");
  }
  else if(room.error){
    alert(room.error);
    window.location.href = "/home";
  }
};

ws.onclose = (event) => {
  console.log("WebSocket closed:", event);
  reConnect();
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
  reConnect();
};

// ================== Helper Functions ==================
function updateBar(value=0){
    slider.style.background = `linear-gradient(to right, orangered 0%, orangered ${value}%, #d3d3d3 ${value}%, #d3d3d3 100%)`;
}
updateBar();

function updateButton(){
    if(!audio.paused){
        playPauseBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    }
    else{
        playPauseBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    }
}

function formatTime(sec) {
    if (isNaN(sec)) return "00:00";
    let minutes = Math.floor(sec / 60);
    let seconds = Math.floor(sec % 60);
    if (seconds < 10) seconds = "0" + seconds;
    return `${minutes}:${seconds}`;
}

function tooglepass(){
    let pass = document.getElementById("room-pass");
    let icon = document.getElementById("password-icon");
    if(icon.className == "fa-solid fa-eye"){
        icon.className = "fa-solid fa-eye-slash";
        pass.type = "text";
    }
    else{
        icon.className = "fa-solid fa-eye";
        pass.type = "password";
    }
}

function redirect(){
    window.location.href = "/home";
}

function updateParticipantList(room){
    let users = room.user_list;
    participant_cont.innerHTML = '';

    if(users.length > prevuserlen & prevuserlen != 0){
      ws.send(JSON.stringify({"index":currentIndex,"user":users.at(-1),"type":"sync","time":audio.currentTime}))
    }

    prevuserlen = users.length;
    users.forEach(user => {
        const card = document.createElement("div");
        card.className = "card";

        let char = user.charAt(0).toUpperCase()

        card.innerHTML = `
        <div class="profile" id="profile">${char}</div>
        <div class="name">${user}</div>
        `;
        participant_cont.appendChild(card);
    })
}

function isPlaying(audioElement) {
    return !audioElement.paused && !audioElement.ended && audioElement.currentTime > 0;
}

function playSong(index) {
  if (index >= 0 && index < songList.length) {
    const li = songList[index];
    let songSrc = li.getAttribute("data-src");
    audiosrc.src = songSrc;
    audio.load();
    safePlay(0);

    if (currentActive) currentActive.classList.remove("active");
    li.classList.add("active");
    currentActive = li;
    currentIndex = index;
    updateMetadata(li);
  }
}

function updateMetadata(li){
  let track = li.querySelector(".title").textContent;
  let artist = li.querySelector('.artist').textContent;
  let img = li.querySelector('img').src;
  musicname.textContent = track;
  artistname.textContent = artist;
  musicover.src = img;
  updateMediaSession(audio,track,artist,img);
}

function updateMediaSession(audio,mtitle,artistname,image){
  if(!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: mtitle,
    artist: artistname,
    album: '',
    artwork: [{
      src: image, sizes: "512X512", type: 'image/jpeg'
    }]
  });
  navigator.mediaSession.setActionHandler("play", ()=>{
    ws.send(JSON.stringify({ action: "play", time: audio.currentTime }));
    audio.play();
});
  navigator.mediaSession.setActionHandler("pause", () =>{
    ws.send(JSON.stringify({
        'action': 'pause',
        'time': audio.currentTime
    }));
    audio.pause();
  });
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    if(typeof playSong === "function"){
      let nextIndex = (currentIndex + 1) % songList.length; // loop back
      ws.send(JSON.stringify({'action':'forward','nextIndex':nextIndex}));
      playSong(nextIndex);
    };
  });
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    if(typeof playSong === "function"){
      let prevIndex = (currentIndex - 1 + songList.length) % songList.length; // loop back
      ws.send(JSON.stringify({'action':'backward', 'prevIndex':prevIndex}));
      playSong(prevIndex);
    };
  });
}

function popupRedirect(){
  let popup = document.getElementById("popup-display");
  popup.style.display = "none";
}