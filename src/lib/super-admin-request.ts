import { firebaseConfig } from '@/firebase/config';
import { requireRequestAuth } from '@/lib/request-auth';

type SuperAdminAuthContext = {
  uid: string;
  email?: string;
  emailVerified: boolean;
};

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function hasSuperAdminRoleDoc(request: Request, uid: string): Promise<boolean> {
  const token = getBearerToken(request);
  if (!token) return false;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (!projectId) return false;

  const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/roles_super_admin/${encodeURIComponent(uid)}`;

  const response = await fetch(docUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  return response.ok;
}

async function hasSuperAdminUserDoc(request: Request, uid: string): Promise<boolean> {
  const token = getBearerToken(request);
  if (!token) return false;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (!projectId) return false;

  const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

  const response = await fetch(docUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) return false;

  const payload = (await response.json()) as {
    fields?: {
      role?: {
        stringValue?: string;
      };
    };
  };

  const role = payload.fields?.role?.stringValue?.toLowerCase();
  return role === 'super_admin' || role === 'super-admin';
}

export async function isRequestSuperAdmin(request: Request, uid: string): Promise<boolean> {
  const roleDocExists = await hasSuperAdminRoleDoc(request, uid);
  if (roleDocExists) return true;

  return hasSuperAdminUserDoc(request, uid);
}

export async function requireSuperAdminRequest(request: Request): Promise<SuperAdminAuthContext> {
  const authUser = await requireRequestAuth(request);

  const isSuperAdmin = await isRequestSuperAdmin(request, authUser.uid);
  if (!isSuperAdmin) {
    throw new Error('FORBIDDEN_SUPERADMIN_ROLE');
  }

  return authUser;
}
