// ================== DOM Elements ==================
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
const ok_btn = document.getElementById("ok-btn");
const room_inp = document.getElementById("room-id");
const room_pass_inp = document.getElementById("room-pass");
const participant_cont = document.getElementById("participant");

// ================== State Variables ==================
let ws;
let intervalID;
let indexCount = -1;
let currentActive = null;
let prevuserlen = 0;
let playlist = [];
let currentIndex = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const baseDelay = 1000;

// ================== Initialization ==================
room_inp.readOnly = true;
room_pass_inp.readOnly = true;
audio.hidden = true;
audio.load();

if (roomID) {
    room_inp.value = roomID;
    room_pass_inp.value = pass;
} else {
    room_inp.value = "None";
}

connectWebSocket();

// ================== WebSocket Connection ==================
function connectWebSocket() {
    ws = new WebSocket(`wss://${window.location.host}/ws/sync/${roomID}?host=${isHost}`, [pass]);

    ws.onopen = () => {
        console.log("Connected");
        reconnectAttempts = 0;
        syncOnReconnect();
    };

    ws.onmessage = (event) => {
        handleWebSocketMessage(event);
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
        console.log("WebSocket closed. Attempting reconnect...");
        attemptReconnect();
    };
}

function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.error("Max reconnect attempts reached.");
        return;
    }
    reconnectAttempts++;
    const delay = baseDelay * Math.pow(2, reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay} ms`);
    setTimeout(connectWebSocket, delay);
}

function syncOnReconnect() {
    if (currentIndex !== null) {
        ws.send(JSON.stringify({
            'action': 'sync_request',
            'index': currentIndex,
            'time': audio.currentTime
        }));

        const li = songList[currentIndex];
        if (li) {
            let track = li.querySelector(".title").textContent;
            let artist = li.querySelector(".artist").textContent;
            let img = li.querySelector("img").src;
            updateMediaSession(audio, track, artist, img);
        }
    }
}

// ================== Handle Messages ==================
function handleWebSocketMessage(event) {
    let room = JSON.parse(event.data);

    if (room.user_list) {
        updateParticipantList(room);
    } else if (room.action) {
        switch (room.action) {
            case 'play':
                playFromServer(room);
                break;
            case 'pause':
                pauseFromServer(room);
                break;
            case 'seek':
            case 'driftsync':
                syncSeek(room);
                break;
            case 'forward':
                playSong(room.nextIndex);
                break;
            case 'backward':
                playSong(room.prevIndex);
                break;
            case 'sync':
                playSong(room.index);
                audio.currentTime = room.time;
                break;
        }
    } else if (room.error) {
        alert(room.error);
        window.location.href = "/home";
    }
}

// ================== Playback Handlers ==================
function playFromServer(room) {
    if (room.index !== undefined) {
        playSong(room.index);
    }
    safePlay(room.time || 0);
}

function pauseFromServer(room) {
    if (!isNaN(room.time)) {
        audio.currentTime = room.time;
    }
    audio.pause();
}

function syncSeek(room) {
    if (!isNaN(room.time)) {
        let diff = Math.abs(audio.currentTime - room.time);
        if (diff > 2) {
            if (room.index !== undefined) {
                playSong(room.index);
            }
            audio.currentTime = room.time;
        }
    }
}

// ================== Safe Play ==================
function safePlay(startTime = 0) {
    audio.currentTime = startTime;
    audio.play().catch(err => {
        console.error("Play error:", err);
    });
}

// ================== Play Song ==================
function playSong(index) {
    if (index >= 0 && index < songList.length) {
        const li = songList[index];
        let songSrc = li.getAttribute("data-src");
        audiosrc.src = songSrc;
        audio.load();

        audio.addEventListener("loadeddata", function onLoaded() {
            audio.removeEventListener("loadeddata", onLoaded);
            audio.currentTime = 0;
            audio.play().catch(err => console.error("Play failed:", err));
        });

        if (currentActive) currentActive.classList.remove("active");
        li.classList.add("active");
        currentActive = li;
        currentIndex = index;
        updateMetadata(li);
    }
}

// ================== Update Metadata ==================
function updateMetadata(li) {
    let track = li.querySelector(".title").textContent;
    let artist = li.querySelector(".artist").textContent;
    let img = li.querySelector("img").src;
    musicname.textContent = track;
    artistname.textContent = artist;
    musicover.src = img;
    updateMediaSession(audio, track, artist, img);
}

// ================== Media Session ==================
function updateMediaSession(audio, mtitle, artistname, image) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: mtitle,
        artist: artistname,
        album: '',
        artwork: [{ src: image, sizes: "512x512", type: 'image/jpeg' }]
    });

    navigator.mediaSession.setActionHandler("play", () => {
        ws.send(JSON.stringify({ action: "play", time: audio.currentTime }));
        audio.play();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
        ws.send(JSON.stringify({ action: "pause", time: audio.currentTime }));
        audio.pause();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
        let nextIndex = (currentIndex + 1) % songList.length;
        ws.send(JSON.stringify({ action: "forward", nextIndex: nextIndex }));
        playSong(nextIndex);
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
        let prevIndex = (currentIndex - 1 + songList.length) % songList.length;
        ws.send(JSON.stringify({ action: "backward", prevIndex: prevIndex }));
        playSong(prevIndex);
    });
}

// ================== Event Listeners ==================

// Play/Pause Button
playPauseBtn.addEventListener("click", () => {
    if (audio.paused) {
        ws.send(JSON.stringify({ action: "play", time: audio.currentTime }));
        audio.play();
    } else {
        ws.send(JSON.stringify({ action: "pause", time: audio.currentTime }));
        audio.pause();
    }
    updateButton();
});

// Audio Time Update
audio.addEventListener("timeupdate", () => {
    if (!isNaN(audio.duration) && audio.duration > 0) {
        let value = (audio.currentTime / audio.duration) * 100;
        slider.value = value;
        updateBar(value);
    }
    song_current_time.textContent = formatTime(audio.currentTime);
});

// Metadata Loaded
audio.addEventListener("loadedmetadata", () => {
    if (!isNaN(audio.duration)) {
        song_duration.textContent = formatTime(audio.duration);
    }
});

// Song Ended
audio.addEventListener("ended", () => {
    let nextIndex = (currentIndex + 1) % songList.length;
    playSong(nextIndex);
});

// Seek Slider
slider.addEventListener("input", () => {
    if (!isNaN(audio.duration)) {
        audio.currentTime = (slider.value / 100) * audio.duration;
        updateBar(slider.value);
        ws.send(JSON.stringify({
            'action': 'driftsync',
            'time': audio.currentTime,
            'index': currentIndex
        }));
    }
});

// Playback Sync Interval (for host)
audio.addEventListener("play", () => {
    intervalID = setInterval(() => {
        if (isHost) {
            ws.send(JSON.stringify({ 'action': 'seek', 'time': audio.currentTime, 'index': currentIndex }));
        }
    }, 5000);

    updateButton();
        if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
    }
});

audio.addEventListener("pause", () => {
    clearInterval(intervalID);
    updateButton();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
    }
});

// Forward / Backward buttons
forward.addEventListener("click", () => {
    let nextIndex = (currentIndex + 1) % songList.length;
    ws.send(JSON.stringify({ 'action': 'forward', 'nextIndex': nextIndex }));
    playSong(nextIndex);
});

backward.addEventListener("click", () => {
    let prevIndex = (currentIndex - 1 + songList.length) % songList.length;
    ws.send(JSON.stringify({ 'action': 'backward', 'prevIndex': prevIndex }));
    playSong(prevIndex);
});

// Song Selection from List
songList.forEach((li, index) => {
    li.addEventListener("click", () => {
        playSong(index);
        ws.send(JSON.stringify({ 'action': 'play', 'time': 0, 'index': index }));
    });
});

// ================== Helper Functions ==================

function updateBar(value = 0) {
    slider.style.background = `linear-gradient(to right, orangered 0%, orangered ${value}%, #d3d3d3 ${value}%, #d3d3d3 100%)`;
}
updateBar();

function updateButton() {
    if (!audio.paused) {
        playPauseBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    } else {
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

function updateParticipantList(room) {
    let users = room.user_list;
    participant_cont.innerHTML = '';

    if (users.length > prevuserlen && prevuserlen !== 0) {
        ws.send(JSON.stringify({
            "index": currentIndex,
            "user": users.at(-1),
            "type": "sync",
            "time": audio.currentTime
        }));
    }

    prevuserlen = users.length;

    users.forEach(user => {
        const card = document.createElement("div");
        card.className = "card";
        let char = user.charAt(0).toUpperCase();

        card.innerHTML = `
            <div class="profile" id="profile">${char}</div>
            <div class="name">${user}</div>
        `;
        participant_cont.appendChild(card);
    });
}

function popupRedirect() {
    let popup = document.getElementById("popup-display");
    popup.style.display = "none";
}

function redirect() {
    window.location.href = "/home";
}

function togglepass() {
    let pass = document.getElementById("room-pass");
    let icon = document.getElementById("password-icon");
    if (icon.className === "fa-solid fa-eye") {
        icon.className = "fa-solid fa-eye-slash";
        pass.type = "text";
    } else {
        icon.className = "fa-solid fa-eye";
        pass.type = "password";
    }
}

function isPlaying(audioElement) {
    return !audioElement.paused && !audioElement.ended && audioElement.currentTime > 0;
}
