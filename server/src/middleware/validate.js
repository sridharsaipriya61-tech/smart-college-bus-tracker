import { HttpError } from '../services/supabaseAdmin.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,24}$/;

export const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

export function validateSignup({ email, username, password, confirmPassword, full_name }) {
  const errors = {};
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (!USERNAME_RE.test(username)) errors.username = 'Username must be 3–24 characters (letters, numbers, . _ -)';
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (password && !/[a-zA-Z]/.test(password)) errors.password = 'Password must contain a letter';
  if (password && !/[0-9]/.test(password)) errors.password = 'Password must contain a number';
  if (confirmPassword !== undefined && confirmPassword !== password)
    errors.confirmPassword = 'Passwords do not match';
  if (!str(full_name) || str(full_name).length < 2) errors.full_name = 'Enter your full name';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);
  return { email: email.toLowerCase(), username, password, full_name: str(full_name) };
}

export function requireBody(body, fields) {
  const errors = {};
  for (const f of fields) {
    const v = body?.[f];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) errors[f] = 'This field is required';
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fill in all required fields', errors);
}
