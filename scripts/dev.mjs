#!/usr/bin/env node
/**
 * scripts/dev.mjs
 * 
 * Unified development runner for Visa Autofill Chrome Extension.
 * Automatically orchestrates:
 * 1. Local Python OCR FastAPI service on http://127.0.0.1:8001
 * 2. Vite development server for the React workspace / extension
 * 
 * Rules:
 * - If Python server is already running and healthy on port 8001, it is reused (no duplicate process).
 * - If Python server is NOT running, it is started with cwd = python-extractor.
 * - If port 8001 is occupied by an unrecognized process, fails clearly with an actionable message.
 * - On Ctrl+C (SIGINT/SIGTERM): Vite is stopped, and Python is stopped ONLY IF started by this runner.
 */

import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const pythonExtractorDir = path.join(projectRoot, 'python-extractor')

const isWin = process.platform === 'win32'
const pythonExe = isWin
  ? path.join(pythonExtractorDir, '.venv', 'Scripts', 'python.exe')
  : path.join(pythonExtractorDir, '.venv', 'bin', 'python')

const HEALTH_URL = 'http://127.0.0.1:8001/health'
const PORT = 8001
const HOST = '127.0.0.1'

// CLI Flags
const isPythonOnly = process.argv.includes('--python-only')
const isWebOnly = process.argv.includes('--web-only')

let pythonProcess = null
let viteProcess = null
let startedPythonByUs = false
let isShuttingDown = false

function logDev(msg) {
  console.log(`\x1b[36m[dev]\x1b[0m ${msg}`)
}

function logPython(msg) {
  console.log(`\x1b[35m[python]\x1b[0m ${msg}`)
}

function logVite(msg) {
  console.log(`\x1b[34m[vite]\x1b[0m ${msg}`)
}

function logError(prefix, msg) {
  console.error(`\x1b[31m[${prefix}]\x1b[0m ${msg}`)
}

/**
 * Checks whether port 8001 is open.
 */
function isPortListening(port = PORT, host = HOST) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(800)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      resolve(false)
    })
    socket.connect(port, host)
  })
}

/**
 * Performs a health check against http://127.0.0.1:8001/health.
 */
async function checkHealth(timeoutMs = 1500) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(HEALTH_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return { healthy: false, status: res.status }
    const data = await res.json()
    if (data && data.status === 'ok') {
      return { healthy: true, data }
    }
    return { healthy: false, data }
  } catch (err) {
    return { healthy: false, error: err }
  }
}

/**
 * Pipes a readable stream with a colored prefix per line.
 */
function pipeStreamWithPrefix(stream, prefixFn) {
  if (!stream) return
  const rl = readline.createInterface({ input: stream })
  rl.on('line', (line) => {
    const trimmed = line.trimEnd()
    if (trimmed) {
      prefixFn(trimmed)
    }
  })
}

/**
 * Kills a process and its child tree reliably across Windows and POSIX.
 */
function killProcessTree(pid) {
  if (!pid) return
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGTERM')
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Process already dead
    }
  }
}

/**
 * Graceful cleanup handler.
 */
function shutdown(exitCode = 0) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log('')
  logDev('Shutting down development servers...')

  // 1. Terminate Vite if running
  if (viteProcess && !viteProcess.killed) {
    killProcessTree(viteProcess.pid)
    logDev('Stopped Vite development server.')
  }

  // 2. Terminate Python ONLY if started by this script
  if (startedPythonByUs && pythonProcess && !pythonProcess.killed) {
    killProcessTree(pythonProcess.pid)
    logDev('Stopped local Python OCR server.')
  } else if (!startedPythonByUs && !isWebOnly) {
    logDev('Preserved pre-existing Python OCR server.')
  }

  process.exit(exitCode)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('SIGHUP', () => shutdown(0))

/**
 * Main development runner.
 */
async function run() {
  logDev('Initializing Visa Autofill development environment...')

  // Step A: Handle Python server (unless running with --web-only)
  if (!isWebOnly) {
    const portOpen = await isPortListening(PORT, HOST)

    if (portOpen) {
      const health = await checkHealth()
      if (health.healthy) {
        logPython(`OCR server is already running and healthy at ${HEALTH_URL} (reusing existing process)`)
      } else {
        logError(
          'python',
          `Port ${PORT} is occupied by an unrecognized process, but ${HEALTH_URL} did not return status 'ok'.`
        )
        logError(
          'python',
          `Please free port ${PORT} before running npm run dev, as the extension requires this port.`
        )
        process.exit(1)
      }
    } else {
      // Verify Python interpreter exists in .venv
      if (!fs.existsSync(pythonExe)) {
        logError('python', 'OCR server failed to start.')
        logError('python', `Expected interpreter not found: ${path.relative(projectRoot, pythonExe)}`)
        logError(
          'python',
          'Please set up the virtual environment in python-extractor first:\n' +
          '  cd python-extractor\n' +
          '  python -m venv .venv\n' +
          '  .\\.venv\\Scripts\\pip install -r requirements.txt\n'
        )
        process.exit(1)
      }

      logPython(`Starting OCR server on http://${HOST}:${PORT}...`)

      pythonProcess = spawn(
        pythonExe,
        ['-m', 'uvicorn', 'app.main:app', '--host', HOST, '--port', String(PORT)],
        {
          cwd: pythonExtractorDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
          },
        }
      )

      startedPythonByUs = true

      pipeStreamWithPrefix(pythonProcess.stdout, logPython)
      pipeStreamWithPrefix(pythonProcess.stderr, logPython)

      pythonProcess.on('error', (err) => {
        logError('python', `Failed to start Python process: ${err.message}`)
        shutdown(1)
      })

      pythonProcess.on('exit', (code, signal) => {
        if (!isShuttingDown) {
          logError('python', `OCR server stopped unexpectedly with code ${code ?? signal}`)
          shutdown(code || 1)
        }
      })

      // Poll until /health responds
      let isReady = false
      const pollStart = Date.now()
      const MAX_WAIT_MS = 30000

      while (Date.now() - pollStart < MAX_WAIT_MS) {
        if (pythonProcess.exitCode !== null) {
          break
        }
        await new Promise((r) => setTimeout(r, 400))
        const h = await checkHealth(800)
        if (h.healthy) {
          isReady = true
          break
        }
      }

      if (!isReady) {
        logError('python', `OCR server did not become ready at ${HEALTH_URL} within 30 seconds.`)
        shutdown(1)
        return
      }

      logPython(`OCR server ready at ${HEALTH_URL}`)
    }
  }

  if (isPythonOnly) {
    logDev('Running in --python-only mode. Press Ctrl+C to stop.')
    return
  }

  // Step B: Start Vite
  logVite('Starting Vite development server...')

  const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  if (fs.existsSync(viteBin)) {
    viteProcess = spawn(process.execPath, [viteBin], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    })
  } else {
    const cmd = isWin ? 'npx.cmd' : 'npx'
    viteProcess = spawn(cmd, ['vite'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    })
  }

  viteProcess.on('error', (err) => {
    logError('vite', `Failed to launch Vite: ${err.message}`)
    shutdown(1)
  })

  viteProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      logDev(`Vite process exited with code ${code}`)
      shutdown(code || 0)
    }
  })
}

run().catch((err) => {
  logError('dev', `Fatal launcher error: ${err.message}`)
  shutdown(1)
})
