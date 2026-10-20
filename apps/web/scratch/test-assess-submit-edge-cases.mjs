import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.local'))
  ? path.resolve(process.cwd(), '.env.local')
  : path.resolve(process.cwd(), 'apps/web/.env.local');

const env = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of env.split(/\r?\n/)) {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}

const pool = new pg.Pool({ connectionString: envVars.DATABASE_URL });
const BASE_URL = 'http://localhost:3003';

async function main() {
  const stamp = Date.now();
  const studentId = randomUUID();
  const studentEmail = `edge-student-${stamp}@test.local`;
  const password = 'Password123456!';
  const pwHash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, 'Edge Case Student', 'student', 'active')`,
      [studentId, studentEmail, pwHash]
    );

    // Login via API to get session cookie
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
      body: JSON.stringify({ email: studentEmail, password }),
    });

    const cookie = loginRes.headers.get('set-cookie');
    console.log(`Login status: ${loginRes.status}, hasCookie: ${Boolean(cookie)}`);

    // Start assessment
    const startRes = await fetch(`${BASE_URL}/api/assess/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': BASE_URL },
      body: JSON.stringify({ focus: 'problem-solving' }),
    });

    const startData = await startRes.json();
    console.log('Start assessment response:', startData);

    const aid = startData.assessmentId;
    const qid = startData.question.id;

    // First submit: choice 0
    console.log(`\nSubmitting Question 1 (choice: 0)...`);
    const sub1 = await fetch(`${BASE_URL}/api/assess/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': BASE_URL },
      body: JSON.stringify({ assessmentId: aid, questionId: qid, choice: 0 }),
    });
    console.log(`Sub1 status: ${sub1.status}`, await sub1.json());

    // Duplicate submit: choice 1 (different choice, e.g. student changed mind or clicked again)
    console.log(`\nDuplicate submitting Question 1 with DIFFERENT choice (choice: 1)...`);
    const sub2 = await fetch(`${BASE_URL}/api/assess/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': BASE_URL },
      body: JSON.stringify({ assessmentId: aid, questionId: qid, choice: 1 }),
    });
    const sub2Data = await sub2.json();
    console.log(`Sub2 status: ${sub2.status}`, sub2Data);

    // Duplicate submit: choice 0 (same choice)
    console.log(`\nDuplicate submitting Question 1 with SAME choice (choice: 0)...`);
    const sub3 = await fetch(`${BASE_URL}/api/assess/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': BASE_URL },
      body: JSON.stringify({ assessmentId: aid, questionId: qid, choice: 0 }),
    });
    const sub3Data = await sub3.json();
    console.log(`Sub3 status: ${sub3.status}`, sub3Data);

    // Now submit Question 2 (final question)
    const qid2 = 'ps-2a';
    console.log(`\nSubmitting Question 2 (final question)...`);
    const subQ2_1 = await fetch(`${BASE_URL}/api/assess/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': BASE_URL },
      body: JSON.stringify({ assessmentId: aid, questionId: qid2, choice: 1 }),
    });
    console.log(`SubQ2_1 status: ${subQ2_1.status}`, await subQ2_1.json());

    // Duplicate submit of final question
    console.log(`\nDuplicate submitting Question 2 (final question)...`);
    const subQ2_2 = await fetch(`${BASE_URL}/api/assess/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': BASE_URL },
      body: JSON.stringify({ assessmentId: aid, questionId: qid2, choice: 1 }),
    });
    console.log(`SubQ2_2 status: ${subQ2_2.status}`, await subQ2_2.json());

  } finally {
    await pool.query(`DELETE FROM assessment_items WHERE assessment_id IN (SELECT id FROM assessments WHERE user_id = $1)`, [studentId]);
    await pool.query(`DELETE FROM assessments WHERE user_id = $1`, [studentId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [studentId]);
    await pool.end();
  }
}

main().catch(console.error);
