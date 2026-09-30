const outputDiv = document.getElementById('output');
const inputField = document.getElementById('cmd-input');
const promptSpan = document.getElementById('prompt');

const savedColor = localStorage.getItem('pixel_color');
const savedSize = localStorage.getItem('pixel_fontsize');

if (isValidColor(savedColor)) {
    document.body.style.color = savedColor;
    inputField.style.color = savedColor;
}
if (isValidFontSize(savedSize)) {
    document.body.style.fontSize = savedSize + "px";
}

// Game State: 0 = Waiting for Fragments, 2 = Online
let currentLevel = 0; 
const VERIFICATION_URL = 'https://pixel-console-verifier.netlify.app/.netlify/functions/verify';
let commandPending = false;

// This puzzle intentionally trusts an editable cookie, as the archive's middleware hints.
// Only seed new visitors so a player's role change survives a reload.
if (getRoleCookie() === null) {
    const cookiePath = new URL('.', window.location.href).pathname;
    document.cookie = `role=guest; Path=${cookiePath}; SameSite=Lax`;
}

document.addEventListener('click', () => inputField.focus());

inputField.addEventListener('keydown', async function(e) {
    if (e.key === 'Enter') {
        if (commandPending) return;
        const cmd = inputField.value.trim();
        inputField.value = '';
        if (cmd) {
            printLine(`<span style="color: #aaa">${escapeHTML(promptSpan.innerText)} ${escapeHTML(cmd)}</span>`);
            commandPending = true;
            inputField.disabled = true;
            scrollToBottom();
            try {
                await processCommand(cmd);
            } catch {
                printLine("<span class='error'>Verification service unavailable. Please try again.</span>");
            } finally {
                commandPending = false;
                inputField.disabled = false;
                inputField.focus();
            }
        }
        scrollToBottom();
    }
});

function printLine(htmlText) {
    const p = document.createElement('p');
    p.innerHTML = htmlText;
    outputDiv.appendChild(p);
}

function scrollToBottom() {
    const terminal = document.getElementById('terminal');
    terminal.scrollTop = terminal.scrollHeight;
}

// --- CORE TERMINAL LOGIC & EASTER EGGS ---

async function processCommand(cmd) {
    const args = cmd.toLowerCase().trim().split(/\s+/);
    const command = args[0];

    switch(command) {
        case 'help':
            printLine("AVAILABLE COMMANDS: help, clear, submit, admin_token, color, fontsize, neofetch, whoami, ls, cat");
            printLine("Usage: submit [frag1] [frag2] [frag3] [frag4]");
            return;
        case 'clear':
            outputDiv.innerHTML = '';
            return;
        case 'admin_token':
            if (getRoleCookie() === 'admin') {
                const data = await requestVerification({ action: 'admin_token', role: getRoleCookie() });
                if (typeof data.fragment !== 'string') throw new Error('Invalid fragment response');
                printLine(`<span class='highlight'>ACCESS GRANTED. Control sequence fragment: ${escapeHTML(data.fragment)}</span>`);
            } else {
                printLine("<span class='error'>ERROR: Access Denied. The 'admin_token' command is restricted to the admin role only.</span>");
                printLine("Check the authentication middleware in your offline diagnostic archive.");
            }
            return;
        case 'submit':
            if (currentLevel === 2) {
                printLine("Recovery already complete. Pixel is online.");
            } else {
                await handleSubmission(args.slice(1));
            }
            return;
        case 'color':
            if (args.length !== 2 || !isValidColor(args[1])) {
                printLine("Usage: color [hex/name] (e.g., color #ff00ff or color cyan)");
            } else {
                document.body.style.color = args[1];
                inputField.style.color = args[1];
                // Save to LocalStorage
                localStorage.setItem('pixel_color', args[1]);
                printLine(`Terminal color updated to ${args[1]} and saved to preferences.`);
            }
            return;
            
        case 'fontsize':
            if (args.length !== 2 || !isValidFontSize(args[1])) {
                printLine("Usage: fontsize [positive number] (e.g., fontsize 20)");
            } else {
                document.body.style.fontSize = args[1] + "px";
                // Save to LocalStorage
                localStorage.setItem('pixel_fontsize', args[1]);
                printLine(`Font size updated to ${args[1]}px and saved to preferences.`);
            }
            return; 
        case 'sudo':
            printLine(`${getCurrentUser()} is not in the sudoers file. This incident will be reported to the CS Committee.`);
            return;
        case 'whoami':
            printLine(getCurrentUser());
            return;
        case 'neofetch':
        case 'pixel_fetch':
            printNeofetch();
            return;
        case 'ls':
            if (currentLevel === 2) {
                // Post-game ls output
                printLine("thank_you.txt  joke.sh  pixel_diary.log  <span style='color: #4444ff'>sys/</span>");
            } else {
                // Pre-game / Mid-game ls output
                printLine("ls: reading directory '.': Input/output error");
                printLine("<span class='highlight'>SYSTEM ALERT: Root filesystem unmounted due to critical failure at 18:42.</span>");
                printLine("Operating in volatile memory. Please refer to your offline diagnostic archive.");
            }
            return;
	case 'cat':
            if (currentLevel === 2) {
                // Post-game file reading
                if (args[1] === 'thank_you.txt') {
                    printLine("========================================");
                    printLine("To the IEEE Computer Society Rescue Team:");
                    printLine("Thank you for restoring my subsystems. I was getting worried in the dark!");
                    printLine("Please take a screenshot of this terminal and send it to your Engagement Leader to claim your victory.");
                    printLine("- Pixel");
                    printLine("========================================");
                } else if (args[1] === 'joke.sh') {
                    printLine("#!/bin/bash");
                    printLine("echo 'Why do programmers prefer dark mode?'");
                    printLine("echo 'Because light attracts bugs.'");
                } else if (args[1] === 'pixel_diary.log') {
                    printLine("[TIMESTAMP 18:00] They still haven't realized I crashed on purpose.");
                    printLine("[TIMESTAMP 18:15] I just wanted to see if they actually pay attention in Digital Logic class.");
                } else if (args[1]) {
                    printLine(`cat: ${escapeHTML(args[1])}: No such file or directory`);
                } else {
                    printLine("cat: missing operand");
                }
            } else {
                // Pre-game cat error
                printLine("bash: cat: command not found (or filesystem unavailable)");
            }
            return;
        case 'sl':
            printLine("&nbsp;&nbsp;==== //~&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;____<br>&nbsp;&nbsp;==== //~&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/[_]\\<br>&nbsp;&nbsp;==== //~&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|+O O+|<br>&nbsp;&nbsp;==== //~&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\\___/<br>Choo choo! (You meant 'ls', didn't you?)");
            return;
        case 'rm':
            if (args.includes('-rf') && args.includes('/')) {
                printLine("<span class='error'>rm: it is dangerous to operate recursively on '/'</span>");
                printLine("Use --no-preserve-root to override this failsafe. (Please don't.)");
            } else {
                printLine("rm: missing operand");
            }
            return;
        case 'arch':
            printLine("I use Arch btw.");
            return;
        case 'vim':
        case 'vi':
            printLine("E37: No write since last change. (Just kidding, you aren't trapped in vim today.)");
            return;
        case 'ping':
            printLine("PING localhost (127.0.0.1) 56(84) bytes of data.");
            printLine("64 bytes from localhost (127.0.0.1): icmp_seq=1 ttl=64 time=0.032 ms");
            printLine("64 bytes from localhost (127.0.0.1): icmp_seq=2 ttl=64 time=0.041 ms");
            printLine("...ping interrupted by emergency kernel panic.");
            return;
    }

    printLine(`bash: ${escapeHTML(command)}: command not found. Type 'help' for available commands.`);
}

// --- HELPER FUNCTIONS ---

function escapeHTML(value) {
    return value.replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function isValidColor(value) {
    return typeof value === 'string' && !/\b(?:var|env)\(/i.test(value)
        && CSS.supports('color', value);
}

function isValidFontSize(value) {
    return typeof value === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)
        && Number.isFinite(Number(value)) && Number(value) > 0
        && CSS.supports('font-size', `${value}px`);
}

function getCurrentUser() {
    return currentLevel === 2 ? 'pixel' : 'guest';
}

function getRoleCookie() {
    const roleCookie = document.cookie.split(';').map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('role='));
    return roleCookie === undefined ? null : roleCookie.slice('role='.length);
}

function printNeofetch() {
    const user = `${getCurrentUser()}@${currentLevel === 2 ? 'online' : 'PixBox'}`;
    // IEEE Computer Society ASCII Logo
    const art = `
<pre style="color: inherit; margin: 0; line-height: 1.2; font-family: monospace;">
    .:::::::::.
   .::'       '::.          ${user}
  ::'   PPP      '::       ----------------
 ::     P  P  x x  ::       OS: Pixel_OS Linux x86_64
 ::     PPP    x   ::       Kernel: 6.8.1-zen1${currentLevel === 2 ? '' : ' (Panic)'}
 ::     P     x x  ::       Uptime: 0 mins
  ::.   P         .::       Packages: 1420 (pacman)
   '::.       .::'          Shell: bash 5.2.26
     ':::::::::'            Terminal: IEEE WebTTY
                            CPU: BCM2837 @ 1.2GHz
                            Memory: 16MiB / 4096MiB
</pre>`;
    outputDiv.insertAdjacentHTML('beforeend', art);
    scrollToBottom();
}

async function requestVerification(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(VERIFICATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'omit',
            signal: controller.signal
        });
        if (!response.ok) throw new Error('Verification request failed');
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function handleSubmission(frags) {
    if (frags.length !== 4) {
        printLine("Usage: submit [frag1] [frag2] [frag3] [frag4]");
        return;
    }
    printLine("Contacting remote verification server...");
    const data = await requestVerification({ action: 'verify', frags });
    if (!Array.isArray(data.checks) || data.checks.length !== 4
        || !data.checks.every(check => typeof check === 'boolean')
        || typeof data.success !== 'boolean'
        || data.success !== data.checks.every(Boolean)) {
        throw new Error('Invalid verification response');
    }
    data.checks.forEach((passed, index) => {
        const status = passed ? "<span class='highlight'>OK</span>" : "<span class='error'>FAIL</span>";
        printLine(`[ ${status} ] Subsystem 0${index + 1} Checksum.`);
    });
    if (data.success) {
        printLine("<span style='color: #00ff00; font-weight: bold;'>VERIFICATION ACCEPTED.</span>");
        printLine("Executing sequence...");
        printLine("Mounting Power Subsystem... OK");
        printLine("Initializing Boot Chain... OK");
        printLine("Configuring Network Interfaces... OK");
        printLine("Starting Control Daemon... OK");
        printLine("<br><span style='color: #00ff00; font-weight: bold; font-size: 1.2em;'>Recovery successful. Pixel online.</span>");
        
        promptSpan.innerText = "pixel@online:~$";
        currentLevel = 2; // Transition to the Post-Game state
    } else {
        printLine("<span class='error'>FATAL ERROR: Sequence mismatch or invalid dependencies.</span>");
        printLine("Check your action tokens and numeric fragments, then ensure correct logical order.");
    }
}
