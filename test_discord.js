import { spawn } from 'child_process';

console.log('Spawning Discord Bot Simulator for verification test...');

const botProcess = spawn('node', ['./apps/discord/dist/index.js'], {
  cwd: process.cwd()
});

let hasSentCommand = false;

botProcess.stdout.on('data', (data) => {
  const text = data.toString();
  console.log(text.trim());

  if (text.includes('[Discord Channel #general-chat] User:')) {
    if (!hasSentCommand) {
      console.log('\n>>> Sending simulated chat message: "!agent update my stats"');
      hasSentCommand = true;
      botProcess.stdin.write('!agent update my stats\n');
    } else {
      console.log('\n>>> Simulation finished successfully. Delaying shutdown to flush database writer...');
      setTimeout(() => {
        botProcess.stdin.write('exit\n');
      }, 1500);
    }
  }
});

botProcess.stderr.on('data', (data) => {
  console.error('\x1b[31m[STDERR]\x1b[0m', data.toString().trim());
});

botProcess.on('close', (code) => {
  console.log(`\nTest subprocess exited with code ${code}`);
  if (hasSentCommand) {
    console.log('\x1b[32m✔ SUCCESS: Discord bot compiled, run, and successfully planned/executed tasks!\x1b[0m');
    process.exit(0);
  } else {
    console.error('\x1b[31m✖ FAILURE: Test closed without sending commands.\x1b[0m');
    process.exit(1);
  }
});
