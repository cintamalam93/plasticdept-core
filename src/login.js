const users = [
  { username: "manager", password: "manager123", role: "manager" },
  { username: "asstman", password: "asstman", role: "asstman" },
  { username: "leader", password: "leader123", role: "team_leader" },
  { username: "spv", password: "spv123", role: "spv" },
  { username: "operator", password: "operator123", role: "operator" }
];

const app = document.getElementById('login-app');
app.innerHTML = `
  <div class="login-container">
    <h2>Login</h2>
    <form id="loginForm">
      <input id="username" placeholder="Username" required />
      <input id="password" type="password" placeholder="Password" required />
      <button type="submit">Login</button>
      <div id="error" class="error"></div>
    </form>
  </div>
`;

const form = document.getElementById('loginForm');
form.onsubmit = (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    // Redirect ke outbound app (bisa diubah sesuai role)
    window.location.href = '/outbound/index.html';
  } else {
    document.getElementById('error').textContent = 'Username/password salah';
  }
};
