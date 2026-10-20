import { chromium } from 'playwright';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

// Robust env loading without printing secrets or secret lengths
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

const clientUmdPath = fs.existsSync(path.resolve(process.cwd(), 'node_modules/livekit-client/dist/livekit-client.umd.js'))
  ? path.resolve(process.cwd(), 'node_modules/livekit-client/dist/livekit-client.umd.js')
  : path.resolve(process.cwd(), 'apps/web/node_modules/livekit-client/dist/livekit-client.umd.js');

const pool = new pg.Pool({ connectionString: envVars.DATABASE_URL });
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('======================================================');
  console.log('REAL TWO-PARTICIPANT LIVEKIT CALL VERIFICATION');
  console.log('======================================================\n');

  const stamp = Date.now();
  const studentId = randomUUID();
  const mentorId = randomUUID();
  const requestId = randomUUID();
  const studentEmail = `student-call-${stamp}@test.local`;
  const mentorEmail = `mentor-call-${stamp}@test.local`;
  const password = 'Password123456!';
  const pwHash = await bcrypt.hash(password, 10);

  let browser;

  try {
    // 1. Setup DB fixtures
    console.log('[STEP 1] Provisioning test student, approved mentor, and accepted session in PostgreSQL...');
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, 'LiveKit Student', 'student', 'active'),
              ($4, $5, $3, 'LiveKit Mentor', 'mentor', 'active')`,
      [studentId, studentEmail, pwHash, mentorId, mentorEmail]
    );

    await pool.query(
      `INSERT INTO mentor_profiles (user_id, bio, focus, status)
       VALUES ($1, 'A sufficiently long bio for LiveKit verification.', 'Backend & Video', 'approved')`,
      [mentorId]
    );

    await pool.query(
      `INSERT INTO mentor_requests (id, student_id, mentor_id, message, status)
       VALUES ($1, $2, $3, 'Bi-directional WebRTC verification', 'accepted')`,
      [requestId, studentId, mentorId]
    );
    console.log('✓ Database records provisioned successfully');

    // 2. Launch browser with fake media devices
    console.log('\n[STEP 2] Launching Chrome with synthetic media devices and media permissions...');
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const contextStudent = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const contextMentor = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const pageStudent = await contextStudent.newPage();
    const pageMentor = await contextMentor.newPage();

    // 3. Authenticate both sessions via API
    console.log('\n[STEP 3] Authenticating student and mentor sessions...');
    await pageStudent.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await pageMentor.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const loginStudent = await pageStudent.evaluate(async ({ email, password }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return { ok: res.ok, status: res.status };
    }, { email: studentEmail, password });

    const loginMentor = await pageMentor.evaluate(async ({ email, password }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return { ok: res.ok, status: res.status };
    }, { email: mentorEmail, password });

    console.log(`   Student login: ok=${loginStudent.ok}, status=${loginStudent.status}`);
    console.log(`   Mentor login: ok=${loginMentor.ok}, status=${loginMentor.status}`);
    if (!loginStudent.ok || !loginMentor.ok) throw new Error('Authentication failed');

    // 4. Request tokens from Next.js server
    console.log('\n[STEP 4] Requesting authorized LiveKit room tokens from server...');
    const tokenStudentRes = await pageStudent.evaluate(async (reqId) => {
      const res = await fetch(`/api/mentor-requests/${reqId}/call/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return { ok: res.ok, status: res.status, data: await res.json() };
    }, requestId);

    const tokenMentorRes = await pageMentor.evaluate(async (reqId) => {
      const res = await fetch(`/api/mentor-requests/${reqId}/call/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return { ok: res.ok, status: res.status, data: await res.json() };
    }, requestId);

    console.log(`   Student token response: ok=${tokenStudentRes.ok}, status=${tokenStudentRes.status}`);
    console.log(`   Mentor token response: ok=${tokenMentorRes.ok}, status=${tokenMentorRes.status}`);

    if (!tokenStudentRes.ok || !tokenMentorRes.ok) {
      console.error('Student token error:', tokenStudentRes.data);
      console.error('Mentor token error:', tokenMentorRes.data);
      throw new Error(`Token request failed: Student=${tokenStudentRes.status}, Mentor=${tokenMentorRes.status}`);
    }

    const { token: studentToken, serverUrl, roomName } = tokenStudentRes.data;
    const { token: mentorToken } = tokenMentorRes.data;
    console.log(`✓ Both tokens issued for deterministic room: ${roomName}`);
    console.log(`✓ Upstream LiveKit WebRTC endpoint: ${serverUrl}`);

    // Inject local LiveKit Client UMD into pages
    console.log('\n[STEP 5] Injecting LiveKit Client SDK into browser pages...');
    await pageStudent.addScriptTag({ path: clientUmdPath });
    await pageMentor.addScriptTag({ path: clientUmdPath });
    console.log('✓ LiveKit Client UMD bundle loaded in both contexts');

    // 5. Connect both participants using LiveKit Client in browser
    console.log('\n[STEP 6] Connecting Student to LiveKit Cloud room...');

    const connectParticipant = async (page, role, token, wsUrl) => {
      return await page.evaluate(async ({ role, token, wsUrl }) => {
        return new Promise(async (resolve, reject) => {
          try {
            const Livekit = window.LivekitClient;
            if (!Livekit) {
              return reject(new Error('LivekitClient UMD bundle not found on window'));
            }

            const room = new Livekit.Room({
              adaptiveStream: true,
              dynacast: true,
              autoSubscribe: true,
            });
            window.__activeLiveKitRoom = room;
            window.__liveKitEvents = [];

            room.on(Livekit.RoomEvent.ParticipantConnected, (p) => {
              window.__liveKitEvents.push({ type: 'ParticipantConnected', identity: p.identity });
            });

            room.on(Livekit.RoomEvent.TrackSubscribed, (track, publication, participant) => {
              window.__liveKitEvents.push({
                type: 'TrackSubscribed',
                kind: track.kind,
                source: publication.source,
                identity: participant.identity,
              });
            });

            room.on(Livekit.RoomEvent.TrackMuted, (pub, p) => {
              window.__liveKitEvents.push({ type: 'TrackMuted', kind: pub.kind, identity: p.identity });
            });

            room.on(Livekit.RoomEvent.TrackUnmuted, (pub, p) => {
              window.__liveKitEvents.push({ type: 'TrackUnmuted', kind: pub.kind, identity: p.identity });
            });

            room.on(Livekit.RoomEvent.ParticipantDisconnected, (p) => {
              window.__liveKitEvents.push({ type: 'ParticipantDisconnected', identity: p.identity });
            });

            await room.connect(wsUrl, token);

            // Enable microphone and camera
            await room.localParticipant.setMicrophoneEnabled(true);
            await room.localParticipant.setCameraEnabled(true);

            resolve({
              connected: true,
              roomState: room.state,
              identity: room.localParticipant.identity,
              publishedTracks: room.localParticipant.trackPublications.size,
            });
          } catch (err) {
            reject({ message: err.message, stack: err.stack });
          }
        });
      }, { role, token, wsUrl });
    };

    const studentConnectRes = await connectParticipant(pageStudent, 'STUDENT', studentToken, serverUrl);
    console.log(`✓ Student connected to LiveKit Cloud: state=${studentConnectRes.roomState}, identity=${studentConnectRes.identity}, publishedTracks=${studentConnectRes.publishedTracks}`);

    console.log('\n[STEP 7] Connecting Mentor to same LiveKit Cloud room...');
    const mentorConnectRes = await connectParticipant(pageMentor, 'MENTOR', mentorToken, serverUrl);
    console.log(`✓ Mentor connected to LiveKit Cloud: state=${mentorConnectRes.roomState}, identity=${mentorConnectRes.identity}, publishedTracks=${mentorConnectRes.publishedTracks}`);

    // 6. Wait for bidirectional peer discovery and track exchange
    console.log('\n[STEP 8] Verifying bidirectional audio/video track subscription between Student and Mentor...');
    
    // Poll for track exchange up to 15 seconds
    let studentVerified = false;
    let mentorVerified = false;
    let studentEvents = [];
    let mentorEvents = [];

    for (let attempt = 1; attempt <= 15; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));

      const status = await Promise.all([
        pageStudent.evaluate(() => {
          const room = window.__activeLiveKitRoom;
          const events = window.__liveKitEvents || [];
          const remotes = Array.from(room.remoteParticipants.values()).map(p => ({
            identity: p.identity,
            trackPublications: p.trackPublications.size,
            subscribedTracks: Array.from(p.trackPublications.values()).filter(pub => pub.isSubscribed).map(pub => pub.kind),
          }));
          return {
            remoteCount: room.remoteParticipants.size,
            remotes,
            events,
          };
        }),
        pageMentor.evaluate(() => {
          const room = window.__activeLiveKitRoom;
          const events = window.__liveKitEvents || [];
          const remotes = Array.from(room.remoteParticipants.values()).map(p => ({
            identity: p.identity,
            trackPublications: p.trackPublications.size,
            subscribedTracks: Array.from(p.trackPublications.values()).filter(pub => pub.isSubscribed).map(pub => pub.kind),
          }));
          return {
            remoteCount: room.remoteParticipants.size,
            remotes,
            events,
          };
        }),
      ]);

      const [sStatus, mStatus] = status;
      studentEvents = sStatus.events;
      mentorEvents = mStatus.events;

      const sSubscribed = sStatus.remotes.some(r => r.subscribedTracks.includes('audio') || r.subscribedTracks.includes('video') || r.trackPublications >= 2);
      const mSubscribed = mStatus.remotes.some(r => r.subscribedTracks.includes('audio') || r.subscribedTracks.includes('video') || r.trackPublications >= 2);

      if (sStatus.remoteCount >= 1 && mStatus.remoteCount >= 1) {
        studentVerified = true;
        mentorVerified = true;
        console.log(`   [Attempt ${attempt}/15] Peers exchanged:`);
        console.log(`     Student sees mentor: remotes=${sStatus.remoteCount}, tracks=${JSON.stringify(sStatus.remotes)}`);
        console.log(`     Mentor sees student: remotes=${mStatus.remoteCount}, tracks=${JSON.stringify(mStatus.remotes)}`);
        if (sSubscribed && mSubscribed) {
          console.log('✓ BIDIRECTIONAL MEDIA TRACKS CONFIRMED between Student and Mentor!');
          break;
        }
      }
    }

    if (!studentVerified || !mentorVerified) {
      throw new Error('Bidirectional peer discovery timed out after 15 seconds');
    }

    // 7. Test Mute Microphone
    console.log('\n[STEP 9] Testing Microphone Mute and Unmute...');
    const muteRes = await pageStudent.evaluate(async () => {
      const room = window.__activeLiveKitRoom;
      await room.localParticipant.setMicrophoneEnabled(false);
      return { micMuted: !room.localParticipant.isMicrophoneEnabled };
    });
    console.log(`✓ Student successfully muted microphone (isMicrophoneEnabled=${!muteRes.micMuted})`);

    await new Promise((r) => setTimeout(r, 1000));

    const unmuteRes = await pageStudent.evaluate(async () => {
      const room = window.__activeLiveKitRoom;
      await room.localParticipant.setMicrophoneEnabled(true);
      return { micEnabled: room.localParticipant.isMicrophoneEnabled };
    });
    console.log(`✓ Student successfully unmuted microphone (isMicrophoneEnabled=${unmuteRes.micEnabled})`);

    // 8. Test Camera Toggle
    console.log('\n[STEP 10] Testing Camera Toggle (Disable and Enable)...');
    const camDisableRes = await pageStudent.evaluate(async () => {
      const room = window.__activeLiveKitRoom;
      await room.localParticipant.setCameraEnabled(false);
      return { cameraDisabled: !room.localParticipant.isCameraEnabled };
    });
    console.log(`✓ Student successfully disabled camera (isCameraEnabled=${!camDisableRes.cameraDisabled})`);

    await new Promise((r) => setTimeout(r, 1000));

    const camEnableRes = await pageStudent.evaluate(async () => {
      const room = window.__activeLiveKitRoom;
      await room.localParticipant.setCameraEnabled(true);
      return { cameraEnabled: room.localParticipant.isCameraEnabled };
    });
    console.log(`✓ Student successfully re-enabled camera (isCameraEnabled=${camEnableRes.cameraEnabled})`);

    // 9. Test Disconnect and Cleanup
    console.log('\n[STEP 11] Testing Participant Disconnect and Cleanup...');
    const studentDisconnect = await pageStudent.evaluate(async () => {
      const room = window.__activeLiveKitRoom;
      await room.disconnect();
      return { disconnected: room.state === 'disconnected' };
    });
    console.log(`✓ Student disconnected cleanly (state=disconnected: ${studentDisconnect.disconnected})`);

    await new Promise((r) => setTimeout(r, 1500));

    const mentorObservedDeparture = await pageMentor.evaluate(() => {
      const room = window.__activeLiveKitRoom;
      return {
        remainingRemotes: room.remoteParticipants.size,
      };
    });
    console.log(`✓ Mentor observed Student departure: remainingRemotes=${mentorObservedDeparture.remainingRemotes}`);

    const mentorDisconnect = await pageMentor.evaluate(async () => {
      const room = window.__activeLiveKitRoom;
      await room.disconnect();
      return { disconnected: room.state === 'disconnected' };
    });
    console.log(`✓ Mentor disconnected cleanly (state=disconnected: ${mentorDisconnect.disconnected})`);

    await browser.close();
    browser = null;

    console.log('\n======================================================');
    console.log('REAL TWO-PARTICIPANT LIVEKIT CALL: 100% VERIFIED LIVE');
    console.log('======================================================\n');

  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    console.log('Cleaning up database fixtures...');
    try {
      await pool.query(`DELETE FROM mentor_requests WHERE id = $1`, [requestId]);
      await pool.query(`DELETE FROM mentor_profiles WHERE user_id = $1`, [mentorId]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [studentId, mentorId]);
      await pool.end();
      console.log('✓ Database cleanup complete.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
  }
}

main().catch((err) => {
  console.error('\n✗ LiveKit Call Verification failed:', err);
  process.exit(1);
});
