//var hostAddress = 'http://localhost:8080';
var url = window.location.href;
var urlParts = url.split(':');
var hostAddress = urlParts[0] + ':' + urlParts[1] + ':8080';
        
function register() {
    var nick = document.getElementById('nickInputRegister').value;
    var email = document.getElementById('emailInputRegister').value;
    var password = document.getElementById('passwordInputRegister').value;
    var image = document.getElementById('imageInputRegister').files[0];
    
    if (nick && email && password) {
        
        var formData = new FormData();
        formData.append('nick', nick);
        formData.append('email', email);
        formData.append('password', password);
        if (image) {
            formData.append('image', image);
        }
        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', hostAddress + '/register', true);

        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    alert("Register succesful")
                } else {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        alert('Error: ' + response.error);
                    } catch (e) {
                        alert('Error parsing server response.');
                    }
                }

            }
        };

        xhr.send(formData);
    } else {
        alert('Enter nick, email and password.');
    }
}

function login() {
    var nick = document.getElementById('nickInputLogin').value;
    var password = document.getElementById('passwordInputLogin').value;
    if (nick && password) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', hostAddress + '/login', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    var accessToken = response.access_token;
                    var refreshToken = response.refresh_token;
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', refreshToken);
                    scheduleRefreshToken(response.expiresIn)
                    window.location = "index.html";
                    
                } else {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        alert('Error: ' + response.error);
                    } catch (e) {
                        alert('Error parsing server response.');
                    }
                }
            }
        };

        xhr.send(JSON.stringify({ nick: nick, password: password }));
    } else {
        alert('Enter nick and password.');
    }
}

function goToRegister(){
    window.location = "register.html";
}

function goToLogin(){
    window.location = "authorize.html"
}

function verify() {
    var nick = document.getElementById('nickInputVerify').value;
    var code = document.getElementById('codeInputVerify').value;
    if (nick && code) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', hostAddress + '/verify', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    alert("Verification succesful")
                } else {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        alert('Error: ' + response.error);
                    } catch (e) {
                        alert('Error parsing server response.');
                    }
                }
            }
        };

        xhr.send(JSON.stringify({ nick: nick, code: code }));
    } else {
        alert('Enter nick and password.');
    }
}

function scheduleRefreshToken(expiresIn) {
    setTimeout(refreshAccessToken, (expiresIn - 60) * 1000);
}

function refreshAccessToken() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress + '/refresh_token', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken === null){
        console.error('Refresh token is null!');
        return
    }
    xhr.send(JSON.stringify({ refresh_token: refreshToken }));

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                accessToken = data.access_token;
                localStorage.setItem('accessToken', accessToken);
                scheduleRefreshToken(data.expires_in);
            } else {
                console.error('Token refresh error!');
            }
        }
    };
}

function home() {
    window.location = "index.html";
} 