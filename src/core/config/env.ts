/**
 * src/core/config/env.ts
 * 
 * Centralized environment configuration for Visa Autofill Extension.
 * Reads environment variables with explicit static access for Vite compile-time substitution,
 * and falls back to Node process.env in test environments.
 */

const RAW_VITE_BACKEND_URL =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL)
    : undefined

const RAW_NODE_BACKEND_URL =
  typeof process !== 'undefined' && process.env
    ? (process.env.VITE_BACKEND_URL || process.env.VITE_API_BASE_URL || process.env.BACKEND_URL)
    : undefined

export const BACKEND_URL: string = (
  RAW_VITE_BACKEND_URL ||
  RAW_NODE_BACKEND_URL ||
  'http://localhost:8000'
).replace(/\/$/, '')

export const BACKEND_API_BASE_URL: string = BACKEND_URL
export const BACKEND_AUTH_BASE_URL: string = BACKEND_URL

const RAW_VITE_PYTHON_URL =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_PYTHON_EXTRACTOR_URL
    : undefined

const RAW_NODE_PYTHON_URL =
  typeof process !== 'undefined' && process.env
    ? (process.env.VITE_PYTHON_EXTRACTOR_URL || process.env.PYTHON_EXTRACTOR_URL)
    : undefined

export const LOCAL_EXTRACTOR_URL: string = (
  RAW_VITE_PYTHON_URL ||
  RAW_NODE_PYTHON_URL ||
  'http://127.0.0.1:8001'
).replace(/\/$/, '')

const RAW_VITE_GOOGLE_CLIENT_ID =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID)
    : undefined

const RAW_NODE_GOOGLE_CLIENT_ID =
  typeof process !== 'undefined' && process.env
    ? (process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)
    : undefined

export const GOOGLE_CLIENT_ID: string =
  RAW_VITE_GOOGLE_CLIENT_ID ||
  RAW_NODE_GOOGLE_CLIENT_ID ||
  '478244875026-tpnqtk9ke8e1tpldgrsu40gft4r65ifu.apps.googleusercontent.com'

const RAW_VITE_GOOGLE_REDIRECT_URI =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_GOOGLE_REDIRECT_URI || import.meta.env.GOOGLE_REDIRECT_URI)
    : undefined

const RAW_NODE_GOOGLE_REDIRECT_URI =
  typeof process !== 'undefined' && process.env
    ? (process.env.VITE_GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI)
    : undefined

export const GOOGLE_REDIRECT_URI: string =
  RAW_VITE_GOOGLE_REDIRECT_URI ||
  RAW_NODE_GOOGLE_REDIRECT_URI ||
  'https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/'

const RAW_VITE_GEMINI_KEY =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_GEMINI_API_KEY
    : undefined

const RAW_NODE_GEMINI_KEY =
  typeof process !== 'undefined' && process.env
    ? (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
    : undefined

export const GEMINI_API_KEY: string =
  RAW_VITE_GEMINI_KEY ||
  RAW_NODE_GEMINI_KEY ||
  ''
