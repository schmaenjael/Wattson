import { getConfig } from '~/config';

type DeviceFlowResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

type TokenErrorResponse = { error: string };

export type DeviceFlowResult = { success: true; sub: string } | { success: false; reason: 'timeout' | 'denied' | 'error' };

let m2mToken: string | null = null;
let m2mTokenExpiresAt = 0;

const endpoint = () => process.env.LOGTO_ENDPOINT!.replace(/\/$/, '');
const tokenEndpoint = () => `${endpoint()}/oidc/token`;

export const initiateDeviceFlow = async (): Promise<DeviceFlowResponse> => {
  const body = new URLSearchParams({ client_id: process.env.LOGTO_DEVICE_APP_ID!, scope: 'openid' });

  const resp = await fetch(`${endpoint()}/oidc/device/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    throw new Error(`LogTo device auth failed: ${resp.status}`);
  }

  return resp.json() as Promise<DeviceFlowResponse>;
};

export const pollForToken = async (deviceCode: string, expiresIn: number, interval: number = 5): Promise<DeviceFlowResult> => {
  const deadline = Date.now() + expiresIn * 1000;
  let pollMs = Math.max(getConfig().config.timeouts.logtoPollMs, interval * 1000);

  const body = new URLSearchParams({
    client_id: process.env.LOGTO_DEVICE_APP_ID!,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
  });

  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));

    const resp = await fetch(tokenEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });

    if (resp.ok) {
      const data = (await resp.json()) as { access_token: string };
      const userResp = await fetch(`${endpoint()}/oidc/me`, { headers: { Authorization: `Bearer ${data.access_token}` } });
      if (!userResp.ok) return { success: false, reason: 'error' };
      const user = (await userResp.json()) as { sub: string };
      return { success: true, sub: user.sub };
    }

    const err = (await resp.json()) as TokenErrorResponse;

    if (err.error === 'slow_down') {
      pollMs += 5_000;
      continue;
    }
    if (err.error === 'authorization_pending') {
      continue;
    }
    if (err.error === 'expired_token') {
      return { success: false, reason: 'timeout' };
    }
    if (err.error === 'access_denied') {
      return { success: false, reason: 'denied' };
    }
    return { success: false, reason: 'error' };
  }

  return { success: false, reason: 'timeout' };
};

const getManagementApiToken = async (): Promise<string> => {
  if (m2mToken && Date.now() < m2mTokenExpiresAt) {
    return m2mToken;
  }

  const basicAuth = Buffer.from(`${process.env.LOGTO_M2M_APP_ID}:${process.env.LOGTO_M2M_APP_SECRET}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials', resource: process.env.LOGTO_MANAGEMENT_API_RESOURCE!, scope: 'all' });

  const resp = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` },
    body,
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '(unreadable)');
    throw new Error(`LogTo M2M token request failed: ${resp.status} — ${errBody}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  m2mToken = data.access_token;
  m2mTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return m2mToken;
};

export const getLogtoUser = async (sub: string): Promise<{ isSuspended: boolean }> => {
  const token = await getManagementApiToken();
  const resp = await fetch(`${endpoint()}/api/users/${encodeURIComponent(sub)}`, { headers: { Authorization: `Bearer ${token}` } });

  if (!resp.ok) {
    throw new Error(`LogTo getUser failed: HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as { isSuspended?: boolean };
  return { isSuspended: data.isSuspended ?? false };
};
