import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

let firestoreDb: Firestore | null = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK if credentials exist
 */
export function initFirebase(): boolean {
  if (isInitialized && firestoreDb) return true;
  if (getApps().length > 0) {
    firestoreDb = getFirestore();
    isInitialized = true;
    return true;
  }

  try {
    // 1. Try service account file path
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    if (keyPath) {
      const resolvedPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        initializeApp({
          credential: cert(serviceAccount),
        });
        firestoreDb = getFirestore();
        isInitialized = true;
        logger.info('Firebase Firestore initialized using service account file', { projectId: serviceAccount.project_id });
        return true;
      }
    }

    // 2. Try JSON string in environment variable
    const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (keyJson) {
      const serviceAccount = JSON.parse(keyJson);
      initializeApp({
        credential: cert(serviceAccount),
      });
      firestoreDb = getFirestore();
      isInitialized = true;
      logger.info('Firebase Firestore initialized using FIREBASE_SERVICE_ACCOUNT_KEY', { projectId: serviceAccount.project_id });
      return true;
    }

    // 3. Try individual env variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      firestoreDb = getFirestore();
      isInitialized = true;
      logger.info('Firebase Firestore initialized using individual env variables', { projectId });
      return true;
    }

    logger.debug('Firebase not configured. Add FIREBASE_PROJECT_ID or service account key to .env to enable cloud sync.');
    return false;
  } catch (err) {
    logger.warn('Failed to initialize Firebase Admin SDK', { error: (err as Error).message });
    return false;
  }
}

/**
 * Check if Firebase is active
 */
export function isFirebaseConfigured(): boolean {
  if (!isInitialized) {
    initFirebase();
  }
  return isInitialized && firestoreDb !== null;
}

/**
 * Sync registration record directly into Firebase Firestore in real-time
 */
export async function syncRegistrationToFirebase(reg: {
  registrationId: string;
  domainSlug: string;
  domainName: string;
  teamName: string;
  teamLeaderName: string;
  email: string;
  phone: string | null;
  values: Record<string, unknown>;
  createdAt: Date;
}) {
  if (!isFirebaseConfigured() || !firestoreDb) {
    return { synced: false, reason: 'Firebase not configured' };
  }

  try {
    const docData = {
      registrationId: reg.registrationId,
      trackSlug: reg.domainSlug,
      trackName: reg.domainName,
      teamName: reg.teamName,
      teamLeaderName: reg.teamLeaderName,
      email: reg.email,
      phone: reg.phone || null,
      formAnswers: reg.values,
      registeredAt: reg.createdAt.toISOString(),
      syncedAt: new Date().toISOString(),
    };

    // Store in global "registrations" collection with registrationId as document ID
    await firestoreDb.collection('registrations').doc(reg.registrationId).set(docData, { merge: true });

    // Also store under track subcollection for organized viewing in Firebase console
    await firestoreDb
      .collection('tracks')
      .doc(reg.domainSlug)
      .collection('registrations')
      .doc(reg.registrationId)
      .set(docData, { merge: true });

    logger.info('Registration synced to Firebase Firestore', {
      registrationId: reg.registrationId,
      track: reg.domainSlug,
    });

    return { synced: true, docId: reg.registrationId };
  } catch (err) {
    logger.error('Failed to sync registration to Firebase Firestore', {
      registrationId: reg.registrationId,
      error: (err as Error).message,
    });
    return { synced: false, error: (err as Error).message };
  }
}
