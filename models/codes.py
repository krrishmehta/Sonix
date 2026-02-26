class Codes:
    def __init__(self):
        self.signup = '''
        <h2 class="login-text">Signup</h2>
        <div class="input-fields">
            <div class="email-field">
                <input type="text" class="email" id="email" placeholder="email" required>
                <i class="fa-solid fa-envelope" id="email-icon"></i>
            </div>
            <div class="username-field">
                <input type="text" class="username" id="username" placeholder="username" required>
                <i class="fa-solid fa-user" id="user-icon"></i>
            </div>
            <div class="password-field">
                <input type="password" class="password" id="password" placeholder="password" required>
                <i class="fa-solid fa-eye" id="password-icon" onclick="tooglepass()"></i>
            </div>
        </div>
        <div class="additional-links" style="margin-top: 10px;">
            <span onclick="fetchcode('login')">Already have account?</span>
        </div>
        <div class="signup-btn">
            <button type="submit" onclick="signup()">Signup</button>
        </div>
        '''
        
        self.login = '''
        <h2 class="login-text">Login</h2>
        <div class="input-fields">
            <div class="username-field">
                <input type="text" class="username" id="username" placeholder="username" required>
                <i class="fa-solid fa-user" id="user-icon"></i>
            </div>
            <div class="password-field">
                <input type="password" class="password" id="password" placeholder="password" required>
                <i class="fa-solid fa-eye" id="password-icon" onclick="tooglepass()"></i>
            </div>
        </div>
        <div class="additional-links">
            <span onclick="fetchcode('signup')">Don't have account?</span>
            <span>Forgot password</span>
        </div>
        <div class="login-btn">
            <button type="submit" onclick="login()">Login</button>
        </div>
        '''
    
    def get_code(self,type:str) -> str:
        if type == "login":
            return self.login
        elif type == "signup":
            return self.signup