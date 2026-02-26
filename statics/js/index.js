function tooglepass(){
    let pass = document.getElementById("password");
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

function fetchcode(type){
    let container = document.getElementById("container");
    fetch("/sonix/code",{
         method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "type": type
        })
    })
    .then(response => response.json())
    .then(data => {
        if(data["code"]){
            container.innerHTML = data["code"];
        }
        else{
            container.innerHTML = "<p>No internal code or file found. Please contact to customer care.</p>"
        }
    })
    .then(err => console.log(err));
}

function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else if (!response.ok) {
            alert("Login failed");
        }
    })
    .catch(error => console.log(error));
}

function signup(){
    let email = document.getElementById("email").value;
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            "email": email,
            "username": username,
            "password": password
        }),
        credentials: "include"
    })
    .then(response => {
        if (response.redirected) {
            localStorage.setItem("user",username);
            window.location.href = response.url;
        } else if (!response.ok) {
            alert("Signup failed");
        }
    })
    .catch(error => console.log(error));
}

function isPass(password){
    let regex = /^[A-Za-z0-9-_]+$/;
    return regex.test(password)  
}

function createroom(){
    let password = document.getElementById("room-pass").value;
    if(!isPass(password)){
        alert("Please use only symbol(- and _) digits, alphabets");
        return
    }
    
    fetch("/sonix/create",{
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "password": password
        })
    })
    .then(response => response.json())
    .then(data => {
        if(!data){
            alert("Can't create room. Error occured.")
        }
        else{
            localStorage.setItem("room_id",data.room);
            localStorage.setItem("roompass",data.password);
            localStorage.setItem("host",data.host);
            window.location.href = "/sonix/sync";
        }
    })
    .catch(error => console.log(error))
}

function joinRoom(){
    let user_pass = document.getElementById("room-id").value;
    const data = user_pass.split(" | ");
    localStorage.setItem("room_id",data[0]);
    localStorage.setItem("roompass",data[1]);

    fetch(`/sonix/isHost/${data[0]}`,{
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
    })
    .then(response => response.json())
    .then(data => {
        if(data.ishost){
            localStorage.setItem("host",true);
        }
        else{
            localStorage.setItem("host",false);
        }
    })
    .catch(error => console.log(error))
    window.location.href = "/sonix/sync";
}