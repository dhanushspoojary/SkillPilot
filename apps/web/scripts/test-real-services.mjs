import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

console.log('======================================================');
console.log('REAL SERVICE CONNECTIVITY & INTEGRATION VERIFICATION');
console.log('======================================================\n');

// 1. NEON POSTGRESQL CONNECTIVITY
console.log('[SERVICE 1] Neon PostgreSQL Connectivity...');
try {
  const { db } = await import('../lib/db.ts');
  const res = await db().query('SELECT NOW() as current_time, count(*) as user_count FROM users');
  console.log(`✓ Neon PostgreSQL connected successfully! Server time: ${res.rows[0].current_time}, User count: ${res.rows[0].user_count}`);
} catch (err) {
  console.error(`✗ Neon PostgreSQL failed: ${err.message}`);
}

// 2. GEMINI CONNECTIVITY
console.log('\n[SERVICE 2] Google Gemini API Connectivity...');
try {
  const { getActiveLLMProvider } = await import('../lib/llm-provider.ts');
  const activeLLM = getActiveLLMProvider();
  console.log(`Configured LLM provider: ${activeLLM.providerName}, isReal: ${activeLLM.isReal}, fastModel: ${activeLLM.fastModel}`);
  if (activeLLM.provider) {
    const text = await activeLLM.provider.generateText('Respond with strictly valid JSON: {"status": "ok", "message": "hello"}', {
      systemPrompt: 'You are a test assistant. Answer with strictly valid JSON only.',
      temperature: 0.1,
    });
    console.log(`✓ Gemini (${activeLLM.providerName}) returned text: ${text.slice(0, 100)}`);
  } else {
    console.log('  Gemini provider is not configured or disabled.');
  }
} catch (err) {
  console.error(`✗ Gemini failed: ${err.message}`);
}

// 3. CODE EXECUTION PROVIDER (PISTON / JUDGE0)
console.log('\n[SERVICE 3] Code Execution Provider Connectivity...');
const pistonUrl = process.env.PISTON_API_URL;
const judge0Url = process.env.JUDGE0_API_URL;
console.log(`Configured Piston URL: ${pistonUrl ? pistonUrl : 'none'}`);
console.log(`Configured Judge0 URL: ${judge0Url ? judge0Url : 'none'}`);

try {
  const { getActiveExecutionProvider, executePracticeSubmission } = await import('../lib/code-execution/index.ts');
  const provider = getActiveExecutionProvider();
  console.log(`Active Provider instance: ${provider ? provider.name : 'null (Drafting Mode)'}`);

  if (provider) {
    const health = await provider.checkHealth();
    console.log(`Provider health check: ok=${health.ok}, message=${health.message}`);

    console.log(`Testing real program execution via ${provider.name}...`);
    
    // Test 3a: Valid Python program
    console.log('  Testing 3a: Valid Python program...');
    const pythonCode = `
def solution(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`;
    const testCases = [
      { id: 't1', input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]' },
      { id: 't2', input: '[3, 2, 4], 6', expectedOutput: '[1, 2]', isHidden: true }
    ];

    const runRes = await executePracticeSubmission({
      problemId: 'two-sum-target',
      language: 'python',
      code: pythonCode,
      testCases,
      isSubmission: true,
    });
    console.log(`  3a Result: status=${runRes.status}, isRunnerAvailable=${runRes.isRunnerAvailable}, success=${runRes.success}`);
    console.log(`  3a Test results: passedCount=${runRes.testCaseResults?.filter(t => t.passed).length}/${runRes.testCaseResults?.length}`);

    // Test 3b: Syntax / Compilation error
    console.log('  Testing 3b: Python syntax error...');
    const syntaxErrorCode = `def solution(nums, target) print("syntax error missing colon")`;
    const errRes = await executePracticeSubmission({
      problemId: 'two-sum-target',
      language: 'python',
      code: syntaxErrorCode,
      testCases,
      isSubmission: true,
    });
    console.log(`  3b Result: status=${errRes.status}, success=${errRes.success}`);
    if (errRes.compileOutput || errRes.runtimeError) {
      console.log(`  3b Diagnostic: ${(errRes.compileOutput || errRes.runtimeError || '').slice(0, 120)}...`);
    }

    // Test 3c: Wrong Answer
    console.log('  Testing 3c: Incorrect answer...');
    const wrongCode = `def solution(nums, target): return [0, 0]`;
    const wrongRes = await executePracticeSubmission({
      problemId: 'two-sum-target',
      language: 'python',
      code: wrongCode,
      testCases,
      isSubmission: true,
    });
    console.log(`  3c Result: status=${wrongRes.status}, success=${wrongRes.success}`);

    // Test 3d: Runtime Exception
    console.log('  Testing 3d: Runtime error (division by zero)...');
    const runtimeErrCode = `def solution(nums, target): return 1 / 0`;
    const rtRes = await executePracticeSubmission({
      problemId: 'two-sum-target',
      language: 'python',
      code: runtimeErrCode,
      testCases,
      isSubmission: true,
    });
    console.log(`  3d Result: status=${rtRes.status}, success=${rtRes.success}, error=${(rtRes.runtimeError || '').slice(0, 80)}`);

    // Test 3e: Infinite Loop / Timeout
    console.log('  Testing 3e: Infinite loop / Timeout...');
    const timeoutCode = `
def solution(nums, target):
    while True:
        pass
    return []
`;
    const toRes = await executePracticeSubmission({
      problemId: 'two-sum-target',
      language: 'python',
      code: timeoutCode,
      testCases,
      isSubmission: true,
      timeLimitSec: 2.0,
    });
    console.log(`  3e Result: status=${toRes.status}, success=${toRes.success}`);
  } else {
    console.log('  No external execution provider configured; verifying drafting mode behavior...');
  }
} catch (err) {
  console.error(`✗ Code Execution test failed: ${err.message}`, err);
}

// 4. LIVEKIT CONNECTIVITY & TOKEN VERIFICATION
console.log('\n[SERVICE 4] LiveKit Server & Token Connectivity...');
const livekitUrl = process.env.LIVEKIT_URL;
const livekitKey = process.env.LIVEKIT_API_KEY;
const livekitSecret = process.env.LIVEKIT_API_SECRET;
console.log(`Configured LiveKit URL: ${livekitUrl ? livekitUrl : 'none'}`);
console.log(`LiveKit API Key present: ${Boolean(livekitKey)}`);
console.log(`LiveKit API Secret present: ${Boolean(livekitSecret)}`);

try {
  const { isLiveKitConfigured, createLiveKitToken, deriveLiveKitRoomName } = await import('../lib/livekit.ts');
  console.log(`isLiveKitConfigured(): ${isLiveKitConfigured()}`);

  if (isLiveKitConfigured()) {
    const testRequestId = '550e8400-e29b-41d4-a716-446655440000';
    const roomName = deriveLiveKitRoomName(testRequestId);
    
    // Generate token for Student
    const studentToken = await createLiveKitToken({
      requestId: testRequestId,
      userId: 'student-user-123',
      userName: 'Alice Student',
      role: 'student'
    });
    console.log(`✓ Generated Student LiveKit token: length=${studentToken.length}`);

    // Generate token for Mentor
    const mentorToken = await createLiveKitToken({
      requestId: testRequestId,
      userId: 'mentor-user-456',
      userName: 'Bob Mentor',
      role: 'mentor'
    });
    console.log(`✓ Generated Mentor LiveKit token: length=${mentorToken.length}`);

    // Verify both tokens using livekit-server-sdk TokenVerifier
    const { TokenVerifier } = await import('livekit-server-sdk');
    const verifier = new TokenVerifier(livekitKey, livekitSecret);
    const studentClaims = await verifier.verify(studentToken);
    const mentorClaims = await verifier.verify(mentorToken);

    console.log(`✓ Verified student token claims: sub=${studentClaims.sub}, room=${studentClaims.video?.room}`);
    console.log(`✓ Verified mentor token claims: sub=${mentorClaims.sub}, room=${mentorClaims.video?.room}`);
    console.log(`✓ Both tokens join identical room: ${studentClaims.video?.room === mentorClaims.video?.room}`);

    // Test RoomServiceClient if livekit URL is live
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      // Convert ws/wss to http/https for REST API
      const httpUrl = livekitUrl.replace('ws://', 'http://').replace('wss://', 'https://');
      console.log(`Testing LiveKit RoomServiceClient REST API ping to ${httpUrl}...`);
      const roomClient = new RoomServiceClient(httpUrl, livekitKey, livekitSecret);
      const rooms = await roomClient.listRooms();
      console.log(`✓ LiveKit RoomServiceClient connected! Active rooms count: ${rooms.length}`);
    } catch (restErr) {
      console.log(`  LiveKit REST API check: ${restErr.message}`);
    }
  }
} catch (err) {
  console.error(`✗ LiveKit verification failed: ${err.message}`, err);
}

console.log('\n======================================================');
console.log('DIAGNOSTIC TEST COMPLETE');
console.log('======================================================');
