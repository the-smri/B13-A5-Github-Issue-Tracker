const AUTH_STORAGE_KEY = "phi-lab-issue-tracker-session";
const DEMO_CREDENTIALS = {
    username: "admin",
    password: "admin123"
};

document.addEventListener("DOMContentLoaded", () => {
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

    demoButton.addEventListener("click", () => {
        usernameInput.value = DEMO_CREDENTIALS.username;
        passwordInput.value = DEMO_CREDENTIALS.password;
        errorElement.textContent = "";
        usernameInput.focus();
        usernameInput.setSelectionRange(usernameInput.value.length, usernameInput.value.length);
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorElement.textContent = "Enter the demo username and password to continue.";
            return;
        }

        if (username !== DEMO_CREDENTIALS.username || password !== DEMO_CREDENTIALS.password) {
            errorElement.textContent = "Use the default admin credentials shown below the form.";
            return;
        }

        const session = {
            username,
            signedInAt: new Date().toISOString()
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        errorElement.textContent = "";
        window.location.assign("./issues.html");
    });
});

function hasActiveSession() {
    try {
        return Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
    } catch (error) {
        return false;
    }
}
