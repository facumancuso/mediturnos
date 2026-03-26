import { firebaseConfig } from '@/firebase/config';
import { requireRequestAuth } from '@/lib/request-auth';

type SuperAdminAuthContext = {
  uid: string;
  email?: string;
  emailVerified: boolean;
};

function isSuperAdminEmail(email?: string | null) {
  const normalized = (email || '').toLowerCase();
  const configured = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'admin@mediturnos.com').toLowerCase();
  return normalized !== '' && normalized === configured;
}

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

async function hasAdminUserDoc(request: Request, uid: string): Promise<boolean> {
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
  return role === 'admin';
}

export async function requireSuperAdminRequest(request: Request): Promise<SuperAdminAuthContext> {
  const authUser = await requireRequestAuth(request);

  if (isSuperAdminEmail(authUser.email)) {
    return authUser;
  }

  const roleExists = await hasSuperAdminRoleDoc(request, authUser.uid);
  if (roleExists) {
    return authUser;
  }

  const hasAdminRole = await hasAdminUserDoc(request, authUser.uid);
  if (!hasAdminRole) {
    throw new Error('FORBIDDEN_SUPERADMIN_ROLE');
  }

  return authUser;
}
