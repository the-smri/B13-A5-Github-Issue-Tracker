const authKey = "phi-lab-issue-tracker-session";
const demoCrediantial = {
    username: "admin",
    password: "admin123"
};
document.addEventListener("DOMContentLoaded", function () {
    if (hasActiveSession()) {
        window.location.replace("./issues.html");
        return;
    }

    const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const demoButton = document.getElementById("demoButton");
const errorElement = document.getElementById("loginError");

    if (!form || !usernameInput || !passwordInput || !demoButton || !errorElement) {
        return;
    }
    demoButton.addEventListener("click", function () {
        usernameInput.value = demoCrediantial.username;
    passwordInput.value = demoCrediantial.password;
    errorElement.textContent = "";
        usernameInput.focus();
    usernameInput.setSelectionRange(usernameInput.value.length, usernameInput.value.length);
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
        if (!username || !password) {
            errorElement.textContent = "Enter the demo username and password to continue.";
            return;
        }
    if (username !== demoCrediantial.username || password !== demoCrediantial.password) {
            errorElement.textContent = "Use the default admin credentials shown below the form.";
            return;
        }

    const session = {
            username,
            signedInAt: new Date().toISOString()
        };

        localStorage.setItem(authKey, JSON.stringify(session));
        errorElement.textContent = "";
        window.location.assign("./issues.html");
    });
});

function hasActiveSession() {
    try {
        const session = localStorage.getItem(authKey);
        return Boolean(session);
    } catch (error) {
        return false;
    }
}
